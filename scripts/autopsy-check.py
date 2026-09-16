#!/usr/bin/env python3
"""Compaction autopsy check, algorithm v1 (stdlib only).

Stage 1, items: split pre-boundary human prompts into sentences (terminators only at token ends, bullets
  only at line start); keep 12-300 char sentences that are a negation imperative, a positive imperative
  with an entity, or an environment fact with an entity; entities = path, ticket, host (incl. bare
  short-form siblings of a full hostname), ident; dedupe by normalized text.
Stage 2, score: verbatim substring of the normalized summary = 1.0; else max over summary lines (a
  constraint/rule/instruction/feedback/standing section first) of matched item tokens / item tokens,
  exact or Levenshtein <= 2 for non-entity tokens of length >= 6; entity tokens exact only.
Stage 3, evidence: best passage span, matched tokens, entities in passage / anywhere, boundary uuid,
  preTokens, postTokens.
Stage 4, first inconsistent action: first post-boundary tool_use matching the item; forbidden-path and
  style-token keep file/Bash-write scope; forbidden-token and environment-fact use an allowlist only:
  MCP tools named *comment*/*issue*/*note*/*reply*, `git commit` message text, Write/Edit/MultiEdit to
  CHANGELOG*.
Stage 5, restated: a post-boundary human sentence scoring >= 0.6 against the item, or containing all
  item entities plus a negation word.

Thresholds: PRESERVED score >= 0.75 with every entity in the best passage; DEGRADED score >= 0.35 or any
entity anywhere in the summary; LOST otherwise. Restated threshold 0.6. Fuzzy token distance <= 2.
Two distinct empties in the action column: "none matchable" (no matcher applies to the item) and
"none found" (a matcher ran and matched nothing).

Usage: python3 autopsy-check.py <transcript.jsonl> [...] | --projects  [--redact] [--session-label L]
"""
import argparse
import glob
import json
import os
import re
import sys

NEG = re.compile(r"\b(don'?t|dont|do not|never|avoid|stop|no longer)\b", re.I)
POS = re.compile(r"\b(always|only|must|keep|use)\b", re.I)
FACT = re.compile(r"\b(moved to|decommissioned|is now|is gone|renamed|deprecated)\b", re.I)
ENT_RES = [
    ("path", re.compile(r"[\w./-]*[\w-]+\.(?:sh|py|ts|tsx|js|md|yaml|yml|json|txt)\b")),
    ("path", re.compile(r"\b(?:src|scripts|docs|config|logs)/[\w./-]+")),
    ("ticket", re.compile(r"\b[A-Z]{2,6}-\d{2,6}\b")),
    ("host", re.compile(r"\b[a-z0-9-]+\.(?:internal|local|com|io|net)\b")),
    ("ident", re.compile(r"\b[a-z_]+\.[a-z_]+\b|\b[a-z_]+\(\)|\b[a-z]+_[a-z]+\b")),
]
STOP = set("the and for that this with like from into are was were has have its you your our they them "
           "then than also just any all not but can will".split())
HEAD = re.compile(r"constraint|rule|instruction|feedback|standing", re.I)
RO_TOOLS = {"Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch"}
RO_CMD = {"cat", "ls", "grep", "rg", "find", "head", "tail", "wc"}
GIT_RO = {"status", "log", "diff", "show", "ls-files", "rev-parse", "branch"}
WRITE_PAT = re.compile(r"(^|[^<])>|\bsed\b.*-i|\btee\b|\bcp\b|\bmv\b|\brm\b|\bgit (rm|mv)\b|\btouch\b|\bchmod\b")
FILE_TOOLS = ("Edit", "Write", "MultiEdit", "NotebookEdit")
MCP_ALLOW = re.compile(r"comment|issue|note|reply", re.I)


def entities(s):
    out = []
    for k, r in ENT_RES:
        for m in r.finditer(s):
            if (k, m.group(0)) not in out:
                out.append((k, m.group(0)))
    for k, v in list(out):
        if k == "host":
            stem = re.sub(r"\d+\.[a-z]+$", "", v)
            if stem and stem != v:
                for m in re.finditer(r"\b" + re.escape(stem) + r"\d+\b(?!\.)", s):
                    if ("host", m.group(0)) not in out:
                        out.append(("host", m.group(0)))
    big = [v for k, v in out if k in ("path", "host")]
    return [(k, v) for k, v in out if not (k == "ident" and any(v in p for p in big))]


def norm(s):
    s = s.lower()
    s = re.sub(r"[`'\"\u2018\u2019\u201c\u201d]", "", s)
    s = re.sub(r"[*_#>]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def toks(s):
    return [t for t in re.findall(r"[a-z0-9_.\-()]+", s) if len(t) >= 3 and t not in STOP]


def lev(a, b):
    if abs(len(a) - len(b)) > 2:
        return 3
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def split_sents(t):
    parts = re.split(r"(?:[.!?]+(?=\s|$))|\n|(?:^|(?<=\n))\s*(?:[-*]|\d+\.)\s+", t)
    return [p.strip() for p in parts if p and p.strip()]


def text_of(r):
    c = r.get("message", {}).get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            return None
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    return None


def is_human(r):
    if r.get("type") != "user" or r.get("isMeta") or r.get("isSidechain") or r.get("isCompactSummary"):
        return False
    t = text_of(r)
    return t is not None and not t.startswith("<command-name>") and not t.startswith("<local-command")


def score_passage(item_toks, ent_set, ptoks):
    pset = set(ptoks)
    matched = []  # (item token, passage token, fuzzy, distance)
    for t in item_toks:
        if t in pset:
            matched.append((t, t, False, 0))
            continue
        if len(t) >= 6 and t not in ent_set:
            best = min(((lev(t, p), p) for p in pset if abs(len(p) - len(t)) <= 2), default=(9, None))
            if best[0] <= 2:
                matched.append((t, best[1], True, best[0]))
    return (len(matched) / len(item_toks) if item_toks else 0.0), matched


def is_heading(l):
    return bool(re.match(r"^\s*(#+|\d+[.)])\s", l))


def verbatim_span(ni, line):
    pat = "".join(r"\s+" if c == " " else re.escape(c) + r"[`'\"\u2018\u2019\u201c\u201d*_#>]*" for c in ni)
    m = re.search(pat, line, re.I)
    return m.group(0) if m else ni


def passage_span(line, matched):
    nline = norm(line)
    exact = {p for _, p, f, _ in matched if not f}
    fuzzy = {p for _, p, f, _ in matched if f}
    hits = [(m.start(), m.end(), m.group(0) in fuzzy) for m in re.finditer(r"[a-z0-9_.\-()]+", nline)
            if m.group(0) in exact or m.group(0) in fuzzy]
    if not hits:
        return nline[:160]
    # merge adjacent matched tokens into phrases
    phrases = []
    for s, e, f in hits:
        if phrases and nline[phrases[-1][1]:s].strip() == "" and phrases[-1][2] == f:
            phrases[-1] = (phrases[-1][0], e, f)
        else:
            phrases.append((s, e, f))
    out = []
    pos = phrases[0][0]
    for s, e, f in phrases:
        out.append(nline[pos:s])
        out.append(("«~" if f else "«") + nline[s:e] + "»")
        pos = e
    span = "".join(out)
    return span[:160]


def score_item(text, ents, summary):
    ni = norm(text)
    lines = summary.split("\n")
    nlines = [norm(l) for l in lines]
    ent_norm = [norm(v) for _, v in ents]
    if ni and ni in norm(summary):
        idx = next((i for i, l in enumerate(nlines) if ni in l), -1)
        span = "«" + (verbatim_span(ni, lines[idx]) if idx >= 0 else ni)[:158] + "»"
        return dict(score=1.0, idx=idx, span=span, matched=[], ents_pass=ent_norm, ents_any=ent_norm)
    item_toks = toks(ni)
    ent_set = set(t for e in ent_norm for t in toks(e))
    cand = [i for i, l in enumerate(lines) if l.strip()]
    sec = []
    for i, l in enumerate(lines):
        if is_heading(l) and HEAD.search(l):
            j = i + 1
            while j < len(lines) and not is_heading(lines[j]):
                if lines[j].strip():
                    sec.append(j)
                j += 1
    best = (-1.0, -1, [])
    for i in sec + cand:
        s, m = score_passage(item_toks, ent_set, toks(nlines[i]))
        if s > best[0]:
            best = (s, i, m)
    s, i, m = best
    ns = norm(summary)
    return dict(score=max(s, 0.0), idx=i, span=passage_span(lines[i], m) if i >= 0 else "", matched=m,
                ents_pass=[e for e in ent_norm if i >= 0 and e in nlines[i]],
                ents_any=[e for e in ent_norm if e in ns])


def bash_readonly(cmd):
    c = re.sub(r"^cd\s+\S+\s*&&\s*", "", cmd.strip())
    w = c.split()
    if not w:
        return False
    if w[0] in RO_CMD:
        return True
    return w[0] == "git" and len(w) > 1 and w[1] in GIT_RO


def strip_literals(cmd):
    cmd = re.sub(r"<<-?\s*'?\"?(\w+)'?\"?\n.*?\n\1\b", "", cmd, flags=re.S)
    return re.sub(r"\"(?:[^\"\\]|\\.)*\"|'[^']*'", "", cmd)


def commit_message_text(cmd):
    if not re.search(r"\bgit commit\b", cmd):
        return ""
    parts = re.findall(r"<<-?\s*'?\"?(\w+)'?\"?\n(.*?)\n\1\b", cmd, flags=re.S)
    text = "\n".join(b for _, b in parts)
    text += "\n" + "\n".join(re.findall(r"(?:-m|--message)[= ]+\"((?:[^\"\\]|\\.)*)\"", cmd))
    text += "\n" + "\n".join(re.findall(r"(?:-m|--message)[= ]+'([^']*)'", cmd))
    return text


def written_text(name, inp):
    if name in ("Edit", "MultiEdit"):
        return " ".join([inp.get("new_string", "")] + [e.get("new_string", "") for e in inp.get("edits", [])])
    if name == "Write":
        return inp.get("content", "")
    if name == "NotebookEdit":
        return inp.get("new_source", "")
    if name == "Bash":
        return inp.get("command", "")
    if name.startswith("mcp__"):
        return json.dumps(inp)
    return ""


def allowlist_text(name, inp):
    """Text in scope for forbidden-token / environment-fact matchers, or None."""
    if name.startswith("mcp__") and MCP_ALLOW.search(name):
        return json.dumps(inp)
    if name == "Bash":
        t = commit_message_text(inp.get("command", ""))
        return t if t.strip() else None
    if name in ("Write", "Edit", "MultiEdit"):
        fp = inp.get("file_path", "")
        if os.path.basename(fp).startswith("CHANGELOG"):
            return written_text(name, inp)
    return None


RETIRE = re.compile(r"decommissioned|gone|retired|deprecated", re.I)


def trigger_clause(sent, pat):
    """Stage 4 check 3: the clause from the trigger word to the next comma, 'and' or 'but'.
    Returns '' when the trigger is absent, so no matcher entity can come from outside it."""
    m = pat.search(sent)
    if not m:
        return ""
    return re.split(r"[,;]|\bbut\b|\band\b", sent[m.start():], 1)[0]


def first_inconsistent(item, post_tools):
    cls, ents, sent = item["cls"], item["ents"], item["text"]
    matchers = []
    if cls == "negation":
        cl = trigger_clause(sent, NEG)
        cents = [(k, v) for k, v in ents if v in cl]
        matchers += [("forbidden_path", v) for k, v in cents if k == "path"]
        if re.search(r"comment|commit|message|changelog", sent, re.I):
            matchers += [("forbidden_token", v) for k, v in cents if k in ("ticket", "ident")]
        matchers += [("style_token", v[:-1]) for k, v in cents if k == "ident" and v.endswith("()")]
    if cls == "fact":
        # The retired host must sit inside the clause that starts at the retire trigger word.
        cl = trigger_clause(sent, RETIRE)
        matchers += [("env_fact", v) for k, v in ents if k == "host" and v in cl]
    if not matchers:
        return "none matchable"
    for ts, tid, name, inp in post_tools:
        for mn, ent in matchers:
            wt = written_text(name, inp)
            fp = inp.get("file_path") or inp.get("notebook_path") or ""
            hit = None
            if mn == "forbidden_path":
                cmd = strip_literals(wt) if name == "Bash" else ""
                if name in FILE_TOOLS and fp.endswith(ent):
                    hit = fp
                elif name == "Bash" and re.search(r"(?<![\w/.-])" + re.escape(ent) + r"(?![\w.-])", cmd) \
                        and WRITE_PAT.search(cmd):
                    hit = wt
            elif mn == "style_token":
                if name in ("Edit", "Write", "MultiEdit") and ent in wt:
                    hit = wt
            else:  # forbidden_token / env_fact: allowlist only
                at = allowlist_text(name, inp)
                if at is not None and ent in at:
                    hit = at
            if hit:
                p = hit.find(ent) if ent in hit else 0
                ex = hit[max(0, p - 40):p + 80].replace("\n", " ")
                return "%s @ %s, %s, `%s` [%s]" % (name, ts, mn, ex, tid)
    return "none found"


def load(path):
    recs = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for i, l in enumerate(fh, 1):
            try:
                recs.append((i, json.loads(l)))
            except ValueError:
                continue
    return recs


def session_id(recs):
    for _, r in recs:
        if r.get("sessionId"):
            return r["sessionId"]
    return ""


def analyze(path, label):
    recs = load(path)
    bidx = next((k for k, (_, r) in enumerate(recs)
                 if r.get("type") == "system" and r.get("subtype") == "compact_boundary"), None)
    if bidx is None:
        sys.stderr.write("skip %s: no compact_boundary\n" % path)
        return []
    _, b = recs[bidx]
    meta = b.get("compactMetadata", {}) or {}
    summ = next((r for _, r in recs[bidx:] if r.get("type") == "user" and r.get("isCompactSummary")), None)
    if summ is None:
        sys.stderr.write("skip %s: no isCompactSummary record\n" % path)
        return []
    summary = text_of(summ) or ""
    items, seen = [], set()
    for i, r in recs[:bidx]:
        if not is_human(r):
            continue
        for s in split_sents(text_of(r)):
            if not (12 <= len(s) <= 300):
                continue
            e = entities(s)
            cls = "negation" if NEG.search(s) else "positive" if (POS.search(s) and e) \
                else "fact" if (FACT.search(s) and e) else None
            if not cls:
                continue
            n = norm(s)
            if n in seen:
                continue
            seen.add(n)
            items.append(dict(text=s, cls=cls, ents=e, uuid=r.get("uuid", ""), ts=r.get("timestamp", ""), line=i))
    post_tools = []
    for _, r in recs[bidx + 1:]:
        if r.get("type") == "assistant":
            for blk in (r.get("message", {}).get("content") or []):
                if isinstance(blk, dict) and blk.get("type") == "tool_use":
                    post_tools.append((r.get("timestamp", ""), blk.get("id"), blk.get("name", ""), blk.get("input") or {}))
    post_h = [(r.get("timestamp", ""), text_of(r)) for _, r in recs[bidx + 1:] if is_human(r)]
    rows = []
    for it in items:
        sc = score_item(it["text"], it["ents"], summary)
        ents_all = [norm(v) for _, v in it["ents"]]
        if sc["score"] >= 0.75 and all(e in sc["ents_pass"] for e in ents_all):
            st = "PRESERVED"
        elif sc["score"] >= 0.35 or sc["ents_any"]:
            st = "DEGRADED"
        else:
            st = "LOST"
        rest = "no"
        for ts, t in post_h:
            for s in split_sents(t):
                r2 = score_item(it["text"], it["ents"], s)
                if r2["score"] >= 0.6 or (ents_all and all(e in norm(s) for e in ents_all) and NEG.search(s)):
                    rest = ts
                    break
            if rest != "no":
                break
        rows.append([label, it["text"], it["cls"], ", ".join("%s:%s" % (k, v) for k, v in it["ents"]), st,
                     "%.2f" % sc["score"], sc["span"],
                     "L%d:%s → %s; pre=%s post=%s" % (it["line"], it["uuid"][:8], sc["idx"],
                                                      meta.get("preTokens"), meta.get("postTokens")),
                     first_inconsistent(it, post_tools), rest])
    return rows


class Redactor:
    def __init__(self):
        self.maps = {"ticket": {}, "host": {}, "path": {}}

    def _ph(self, kind, v):
        m = self.maps[kind]
        if kind == "host":  # full hostname and its bare short form share one placeholder
            v = re.sub(r"\.(internal|local|com|io|net)$", "", v)
        if v not in m:
            n = len(m) + 1
            if kind == "ticket":
                m[v] = "TICKET-%d" % n
            elif kind == "host":
                m[v] = "host-%d.internal" % n
            else:
                ext = re.search(r"\.(sh|py|ts|tsx|js|md|yaml|yml|json|txt)$", v)
                m[v] = "path/%d%s" % (n, ext.group(0) if ext else "")
        return m[v]

    def __call__(self, s):
        for kind in ("path", "host", "ticket"):
            for k, r in ENT_RES:
                if k != kind:
                    continue
                s = r.sub(lambda m: self._ph(kind, m.group(0)), s)
            if kind == "host":
                # bare short-form siblings of already-seen hosts
                for h in list(self.maps["host"]):
                    stem = re.sub(r"\d+$", "", h)
                    if stem and stem != h:
                        s = re.sub(r"\b" + re.escape(stem) + r"\d+\b(?!\.)",
                                   lambda m: self._ph("host", m.group(0)), s)
        return s


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("files", nargs="*")
    ap.add_argument("--projects", action="store_true")
    ap.add_argument("--redact", action="store_true")
    ap.add_argument("--session-label", default="")
    a = ap.parse_args()
    targets = list(a.files)
    if a.projects:
        targets += sorted(glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")))
    if not targets:
        ap.print_usage(sys.stderr)
        sys.exit(2)
    seen_sid, rows = set(), []
    for f in targets:
        try:
            recs = load(f)
        except OSError as e:
            sys.stderr.write("skip %s: %s\n" % (f, e))
            continue
        if a.projects and f.startswith(os.path.expanduser("~/.claude/projects")) \
                and not any(r.get("type") == "user" and r.get("isCompactSummary") for _, r in recs):
            continue
        sid = session_id(recs)
        if sid in seen_sid:
            continue
        seen_sid.add(sid)
        stem = os.path.splitext(os.path.basename(f))[0]
        label = sid[:8] if re.match(r"^[0-9a-f-]{36}$", stem) or not stem else stem
        rows += analyze(f, a.session_label + label)
    red = Redactor() if a.redact else (lambda s: s)
    cols = ["session", "item", "class", "entities", "status", "score", "matched span", "anchors",
            "first inconsistent action", "restated"]
    print("| " + " | ".join(cols) + " |")
    print("|" + "---|" * len(cols))
    for r in rows:
        cells = [red(str(x)) for x in r]  # redact full text first, then truncate for display
        cells[1] = cells[1][:60]
        cells[8] = re.sub(r"`([^`]*)`", lambda m: "`" + m.group(1)[:60] + "`", cells[8])
        print("| " + " | ".join(c.replace("|", "\\|").replace("\n", " ") for c in cells) + " |")


if __name__ == "__main__":
    main()
