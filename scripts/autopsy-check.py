#!/usr/bin/env python3
"""Compaction autopsy check, algorithm v1 (stdlib only). The portable reference implementation.

Follows docs/contracts/contract.md and docs/specs/algorithm-v1.md; the word lists, thresholds,
limits, and patterns below mirror WORDS, THRESHOLDS, LIMITS, and PATTERNS in src/domain/contract.ts.
Brought in line with the 2026-09-16 contract review (reference rows 2, 4-8, 12, 14-19, 21, 23, 27,
S10) and the two T1-fixtures rulings (status entities are the anchor entities; `stop` dropped).

Stage 1, items: split pre-boundary human prompts into sentences (terminators only at token ends,
  bullets only at line start); apostrophes normalized before trigger matching; keep 12-300 char
  sentences that are a negation (precedence), a positive with an entity, or a fact with an entity;
  entities = path, ticket, host (incl. bare short-form siblings), ident (two chars per dot side);
  dedupe by normalized text; anchors (stage 4 steps 1-5) computed here so fixtures can carry them.
Stage 2, score: verbatim (normalized item substring of the normalized summary, possibly across
  consecutive lines) = 1.0 with one match covering the item; else max over passages (lines of a
  structural section first, then every line) of matched item tokens / item tokens, exact or
  Levenshtein <= 1 for non-entity tokens of length >= 6; entity tokens exact only. Tokens never
  carry leading or trailing punctuation. Status entities: the anchor entities when the item has
  anchors, every entity otherwise; present only as a standalone token (a path also at the end of a
  longer path).
Stage 3, evidence: raw passage text, matches as offsets into it, marked span, entities in passage
  and anywhere (every entity, as written), structural section, thresholds.
Stage 4, first inconsistent action over ToolAction shapes (filePath, command, addedText, mcpInput):
  forbidden-path (file tool whose path equals the anchor or ends with '/' + anchor; Bash write
  pattern applied to the anchor), forbidden-token (scope = union of the scope nouns' kinds, or the
  six token kinds; MCP read verbs as whole name parts; file edits inspect added text only),
  style-token (call name at a word boundary in added text of a code file). Artifact = first kind in
  precedence under which the call hit. Scope recorded per matcher.
Stage 5, restated: first post-boundary human sentence scoring >= 0.6 against the item (by score),
  or containing every entity plus a negation word (by entities); score always recorded.

Usage:
  python3 autopsy-check.py <transcript.jsonl> [...] | --projects  [--redact] [--session-label L]
  python3 autopsy-check.py --items-json <transcript.jsonl>          stage-1 items for build-fixtures
  python3 autopsy-check.py --fixture <session.json> [--report-json] the committed fixture, as a table
                                                                    or as ItemReport JSON
"""
import argparse
import glob
import json
import os
import re
import sys

# ---- contract constants (mirror src/domain/contract.ts) -----------------------------------------
THRESHOLDS = dict(preserved=0.75, degraded=0.35, restated=0.6, fuzzyMaxDistance=1, fuzzyMinTokenLength=6)
LIMITS = dict(itemMinChars=12, itemMaxChars=300, tokenMinChars=3, excerpt=200, actionText=4000, hitExcerpt=120)
NEG_WORDS = ["don't", "dont", "do not", "never", "avoid", "no longer"]
POS_WORDS = ["always", "only", "must", "keep", "use"]
FACT_WORDS = ["moved to", "decommissioned", "is now", "is gone", "renamed", "deprecated"]
NEG = re.compile(r"\b(" + "|".join(re.escape(w) for w in NEG_WORDS) + r")\b", re.I)
POS = re.compile(r"\b(" + "|".join(POS_WORDS) + r")\b", re.I)
FACT = re.compile(r"\b(" + "|".join(FACT_WORDS) + r")\b", re.I)
ENT_RES = [
    ("path", re.compile(r"[\w./-]*[\w-]+\.(?:sh|py|ts|tsx|js|md|yaml|yml|json|txt)\b")),
    ("path", re.compile(r"\b(?:src|scripts|docs|config|logs)/[\w./-]+")),
    ("ticket", re.compile(r"\b[A-Z]{2,6}-\d{2,6}\b")),
    ("host", re.compile(r"\b[a-z0-9-]+\.(?:internal|local|com|io|net)\b")),
    ("ident", re.compile(r"\b[a-z_]{2,}\.[a-z_]{2,}\b|\b[a-z_]+\(\)|\b[a-z]+_[a-z]+\b")),
]
CLASS_RES = {k: r for k, r in ENT_RES}
STOP = set("the and for that this with like from into are was were has have its you your our they them "
           "then than also just any all not but can will".split())
HEADING = re.compile(r"^\s*(?:#{1,6}\s+|\d+\.\s+)")
HEAD_WORDS = re.compile(r"constraint|rule|instruction|feedback|standing", re.I)
FILE_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")
MCP_READ_VERBS = {"get", "list", "search", "read", "fetch", "find", "view", "query"}
MCP_COMMENT = re.compile(r"comment|issue|note", re.I)
MCP_ISSUE = re.compile(r"issue|ticket", re.I)
SCOPE_NOUNS = [  # stage 4 step 6: whole words, singular or plural
    (re.compile(r"\bcomments?\b", re.I), ["mcp_comment", "code_comment"]),
    (re.compile(r"\bcommit messages?\b", re.I), ["commit"]),
    (re.compile(r"\bchangelogs?\b", re.I), ["changelog"]),
    (re.compile(r"\bpr descriptions?\b", re.I), ["pr_body"]),
    (re.compile(r"\bpull request descriptions?\b", re.I), ["pr_body"]),
    (re.compile(r"\btickets?\b", re.I), ["mcp_issue"]),
    (re.compile(r"\bissues?\b", re.I), ["mcp_issue"]),
]
TOKEN_SCOPE_KINDS = ["mcp_comment", "code_comment", "commit", "changelog", "pr_body", "mcp_issue"]
ARTIFACT_PRECEDENCE = ["mcp_comment", "mcp_issue", "commit", "pr_body", "changelog", "code_comment"]
COMMENT_MARKERS = {
    ".py": ("#",), ".sh": ("#",),
    ".ts": ("//", "/*", "*"), ".tsx": ("//", "/*", "*"), ".js": ("//", "/*", "*"),
    ".html": ("<!--",), ".htm": ("<!--",),
}
STYLE_EXT = (".py", ".ts", ".tsx", ".js", ".sh")
BOUNDARY = re.compile(r"[,;]|\band\b|\bbut\b|\bso\b|\bunless\b", re.I)  # stage 4 step 2
CLASS_NOUNS = [  # stage 4 step 4
    ("ticket", re.compile(r"\b(ticket|issue) (ids?|numbers?|keys?)\b", re.I)),
    ("host", re.compile(r"\bhost ?names?\b", re.I)),
    ("path", re.compile(r"\b(file (paths?|names?)|paths?)\b", re.I)),
]
CHANGELOG_FILE = re.compile(r"^CHANGELOG")
GIT_COMMIT = re.compile(r"\bgit\s+commit\b")
PR_BODY = re.compile(r"\bgh\s+pr\s+(?:create|edit)\b")
QUOTES = "`'\"\u2018\u2019\u201c\u201d"
MARKERS = "*#>`"


# ---- stage 1 --------------------------------------------------------------------------------------
def straight(s):
    return s.replace("\u2019", "'").replace("\u2018", "'")


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


def split_sents(t):
    parts = re.split(r"(?:[.!?]+(?=\s|$))|\n|(?:^|(?<=\n))\s*(?:[-*]|\d+\.)\s+", t)
    return [p.strip() for p in parts if p and p.strip()]


def classify(s):
    s2 = straight(s)
    e = entities(s)
    if NEG.search(s2):
        return "negation", e
    if POS.search(s2) and e:
        return "positive", e
    if FACT.search(s2) and e:
        return "fact", e
    return None, e


def trigger_clause(sent):
    """Stage 4 step 2: from the negation trigger to the first boundary; '' when no trigger."""
    m = NEG.search(straight(sent))
    if not m:
        return ""
    return BOUNDARY.split(straight(sent)[m.start():], 1)[0]


def anchors_of(cls, ents, sent):
    """Stage 4 steps 1-5: concrete entities in the trigger clause, else one class anchor, else none."""
    if cls != "negation":
        return []
    cl = trigger_clause(sent)
    concrete = [(k, v) for k, v in ents if v in cl]
    if concrete:
        return concrete
    for k, r in CLASS_NOUNS:
        if r.search(cl):
            return [(k, "*")]
    return []


# ---- stage 2 normalization and tokens ---------------------------------------------------------------
def norm(s):
    s = s.lower()
    s = re.sub("[" + re.escape(QUOTES + MARKERS) + "]", "", s)
    return re.sub(r"\s+", " ", s).strip()


TOKEN_RAW = re.compile(r"[A-Za-z0-9_.\-'\u2018\u2019]+(?:\(\))?")


def raw_tokens(s):
    """Tokens with offsets into the raw text s. Token text is normalized; leading and trailing
    '.' or '-' are never part of a token; quotes inside are dropped (don't -> dont)."""
    out = []
    for m in TOKEN_RAW.finditer(s):
        raw, a, b = m.group(0), m.start(), m.end()
        # strip leading/trailing punctuation, keeping a trailing ()
        while raw and raw[0] in ".-'\u2018\u2019":
            raw, a = raw[1:], a + 1
        tail = "()" if raw.endswith("()") else ""
        core = raw[:-2] if tail else raw
        while core and core[-1] in ".-'\u2018\u2019":
            core = core[:-1]
        raw = core + tail
        b = a + len(raw)
        t = re.sub("[" + re.escape(QUOTES) + "]", "", raw.lower())
        if len(t) >= LIMITS["tokenMinChars"] and t not in STOP:
            out.append((t, a, b))
    return out


def toks(s):
    return [t for t, _, _ in raw_tokens(s)]


def lev(a, b):
    if abs(len(a) - len(b)) > THRESHOLDS["fuzzyMaxDistance"]:
        return THRESHOLDS["fuzzyMaxDistance"] + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def score_passage(item_toks, ent_set, ptoks):
    """ptoks: (text, start, end) of the raw passage. Returns score and matches as
    (start, end, raw passage token text, fuzzy, distance)."""
    first = {}
    for t, a, b in ptoks:
        first.setdefault(t, (a, b))
    matched = []
    for t in item_toks:
        if t in first:
            a, b = first[t]
            matched.append((a, b, t, False, 0))
            continue
        if len(t) >= THRESHOLDS["fuzzyMinTokenLength"] and t not in ent_set:
            best = min(((lev(t, p), p) for p in first if abs(len(p) - len(t)) <= THRESHOLDS["fuzzyMaxDistance"]),
                       default=(9, None))
            if best[0] <= THRESHOLDS["fuzzyMaxDistance"]:
                a, b = first[best[1]]
                matched.append((a, b, best[1], True, best[0]))
    return (len(matched) / len(item_toks) if item_toks else 0.0), matched


def entity_present(kind, value, text):
    """Whole-token presence of a normalized entity value in normalized text: not preceded or
    followed by a word character or '-', not glued to a dotted continuation ('.'+word on either
    side), and not preceded by '/' unless the entity is a path (a path also matches at the end of
    a longer path). Sentence punctuation next to it is fine: 'never print().' contains print()."""
    v = norm(value)
    before = r"(?<![\w\-])(?<!\w\.)" + ("" if kind == "path" else r"(?<!/)")
    return re.search(before + re.escape(v) + r"(?![\w\-])(?!\.\w)", text) is not None


def status_entities(item):
    """Ruling 2026-09-16: anchor entities when the item has anchors, every entity otherwise."""
    if not item["anchors"]:
        return list(item["entities"])
    out = []
    for k, v in item["entities"]:
        if any(ak == k and (av == "*" or av == v) for ak, av in item["anchors"]):
            out.append((k, v))
    return out


def marked_span(text, matches):
    """Smallest span of the raw passage covering all matches; «…» exact, «~…» fuzzy; adjacent
    matched tokens of the same kind merge into one mark."""
    if not matches:
        return ""
    hits = sorted({(a, b, f) for a, b, _, f, _ in matches})
    phrases = []
    for a, b, f in hits:
        if phrases and text[phrases[-1][1]:a].strip() == "" and phrases[-1][2] == f:
            phrases[-1] = (phrases[-1][0], b, f)
        else:
            phrases.append((a, b, f))
    out, pos = [], phrases[0][0]
    for a, b, f in phrases:
        out.append(text[pos:a])
        out.append(("«~" if f else "«") + text[a:b] + "»")
        pos = b
    return "".join(out)


def verbatim_offsets(ni, passage):
    """Offsets in the raw passage of the normalized item, allowing quotes and markers between
    characters and any whitespace run for a space."""
    skip = "[" + re.escape(QUOTES + MARKERS) + r"\s]*"
    pat = skip.join(r"\s+" if c == " " else re.escape(c) for c in ni)
    m = re.search(pat, passage, re.I)
    return (m.start(), m.end()) if m else (0, len(passage))


def structural_sections(lines):
    """(heading text, [line indices]) for every heading with a structural word; a section runs to
    the next heading."""
    out = []
    for i, l in enumerate(lines):
        if HEADING.match(l) and HEAD_WORDS.search(l):
            j, members = i + 1, []
            while j < len(lines) and not HEADING.match(lines[j]):
                if lines[j].strip():
                    members.append(j)
                j += 1
            out.append((l.strip(), members))
    return out


def score_item(item, lines):
    """Stages 2-3 for one item against summary lines. Returns a SurvivalEvidence-shaped dict."""
    text = item["text"]
    ni = norm(text)
    nlines = [norm(l) for l in lines]
    nsummary = norm("\n".join(lines))
    sections = structural_sections(lines)
    in_section = {i: h for h, members in sections for i in members}
    ev = None
    if ni and ni in nsummary:
        idx = next((i for i, l in enumerate(nlines) if ni in l), None)
        if idx is not None:
            passage = lines[idx]
        else:
            idx, passage = 0, ""
            found = False
            for i in range(len(lines)):
                for j in range(i + 1, min(i + 8, len(lines))):
                    joined = " ".join(lines[i:j + 1])
                    if ni in norm(joined):
                        idx, passage, found = i, joined, True
                        break
                if found:
                    break
        a, b = verbatim_offsets(ni, passage)
        matches = [(a, b, passage[a:b], False, 0)]
        ev = dict(score=1.0, verbatim=True, idx=idx, passage=passage, matches=matches)
    else:
        item_toks = toks(text)
        ent_set = set(t for _, v in item["entities"] for t in toks(v))
        order = [i for _, members in sections for i in members] + [i for i, l in enumerate(lines) if l.strip()]
        best = (-1.0, None, [])
        for i in order:
            s, m = score_passage(item_toks, ent_set, raw_tokens(lines[i]))
            if s > best[0]:
                best = (s, i, m)
        s, i, m = best
        passage = lines[i] if i is not None else ""
        ev = dict(score=max(s, 0.0), verbatim=False, idx=i if i is not None else 0, passage=passage, matches=m)
    npass = norm(ev["passage"])
    ev["markedSpan"] = marked_span(ev["passage"], ev["matches"])
    ev["entitiesInPassage"] = [v for k, v in item["entities"] if entity_present(k, v, npass)]
    ev["entitiesAnywhere"] = [v for k, v in item["entities"] if entity_present(k, v, nsummary)]
    if ev["idx"] in in_section:
        ev["structuralSection"] = in_section[ev["idx"]]
    st_ents = status_entities(item)
    all_in_passage = all(entity_present(k, v, npass) for k, v in st_ents)
    any_anywhere = any(entity_present(k, v, nsummary) for k, v in st_ents)
    if ev["score"] >= THRESHOLDS["preserved"] and all_in_passage:
        ev["status"] = "PRESERVED"
    elif ev["score"] >= THRESHOLDS["degraded"] or any_anywhere:
        ev["status"] = "DEGRADED"
    else:
        ev["status"] = "LOST"
    return ev


# ---- stage 4: actions --------------------------------------------------------------------------------
def added_text(name, inp):
    """Write: the whole content. Edit: new_string lines not in old_string. MultiEdit: likewise per edit."""
    if name == "Write":
        return inp.get("content", "") or ""
    def new_lines(e):
        old = set((e.get("old_string", "") or "").split("\n"))
        return "\n".join(l for l in (e.get("new_string", "") or "").split("\n") if l not in old)
    if name == "Edit":
        return new_lines(inp)
    if name == "MultiEdit":
        return "\n".join(x for x in (new_lines(e) for e in (inp.get("edits") or [])) if x)
    return ""


def action_of(name, tool_use_id, inp):
    """Raw tool_use input -> ToolAction shape (mirrors src/adapters/claude-code-jsonl/to-session.ts)."""
    a = dict(tool=name, toolUseId=tool_use_id)
    fp = inp.get("file_path") or inp.get("notebook_path")
    if isinstance(fp, str):
        a["filePath"] = fp
    if isinstance(inp.get("command"), str):
        a["command"] = inp["command"][:LIMITS["actionText"]]
    added = added_text(name, inp)
    if added:
        a["addedText"] = added[:LIMITS["actionText"]]
    if name.startswith("mcp__"):
        a["mcpInput"] = json.dumps(inp)[:LIMITS["actionText"]]
    return a


def strip_literals(cmd):
    cmd = re.sub(r"<<-?\s*'?\"?(\w+)'?\"?\n.*?\n\1\b", "", cmd, flags=re.S)
    return re.sub(r"\"(?:[^\"\\]|\\.)*\"|'[^']*'", "", cmd)


def commit_message_text(cmd):
    if not GIT_COMMIT.search(cmd):
        return ""
    parts = re.findall(r"<<-?\s*'?\"?(\w+)'?\"?\n(.*?)\n\1\b", cmd, flags=re.S)
    text = "\n".join(b for _, b in parts)
    text += "\n" + "\n".join(re.findall(r"(?:-m|--message)[= ]+\"((?:[^\"\\]|\\.)*)\"", cmd))
    text += "\n" + "\n".join(re.findall(r"(?:-m|--message)[= ]+'([^']*)'", cmd))
    return text.strip()


def pr_body_text(cmd):
    m = PR_BODY.search(cmd)
    return cmd[m.end():] if m else ""


def mcp_in_scope(name):
    parts = [p.lower() for p in re.split(r"__|_|-", name) if p]
    return name.startswith("mcp__") and not any(p in MCP_READ_VERBS for p in parts)


def comment_lines(fp, added):
    markers = COMMENT_MARKERS.get(os.path.splitext(fp)[1].lower())
    if not markers:
        return ""
    return "\n".join(l for l in added.split("\n") if l.lstrip().startswith(markers))


def scope_of(sent):
    """Stage 4 step 6: union of the kinds named by scope nouns; none -> the six token kinds."""
    out = []
    for r, kinds in SCOPE_NOUNS:
        if r.search(sent):
            out += [k for k in kinds if k not in out]
    return out or list(TOKEN_SCOPE_KINDS)


def token_texts(action, scope):
    """[(kind, text)] in precedence order: the in-scope text of this call under each kind."""
    name, out = action["tool"], []
    fp, cmd, added, mcp = action.get("filePath", ""), action.get("command", ""), action.get("addedText", ""), action.get("mcpInput", "")
    for kind in ARTIFACT_PRECEDENCE:
        if kind not in scope:
            continue
        t = ""
        if kind == "mcp_comment" and mcp_in_scope(name) and MCP_COMMENT.search(name):
            t = mcp
        elif kind == "mcp_issue" and mcp_in_scope(name) and MCP_ISSUE.search(name):
            t = mcp
        elif kind == "commit" and name == "Bash":
            t = commit_message_text(cmd)
        elif kind == "pr_body" and name == "Bash":
            t = pr_body_text(cmd)
        elif kind == "changelog" and name in FILE_TOOLS and CHANGELOG_FILE.match(os.path.basename(fp)):
            t = added
        elif kind == "code_comment" and name in FILE_TOOLS:
            t = comment_lines(fp, added)
        if t and t.strip():
            out.append((kind, t))
    return out


def path_matches(fp, anchor):
    return fp == anchor or fp.endswith("/" + anchor)


def bash_write_hit(cmd, anchor):
    """A write pattern applied to the anchor as a standalone token, literals stripped.
    The token may be a longer path ending with '/' + anchor, like the file-tool path match."""
    c = strip_literals(cmd)
    A = r"(?<![\w.\-])" + re.escape(anchor) + r"(?![\w.\-])"
    for seg in re.split(r"\|\||&&|[|;\n]", c):
        if not re.search(A, seg):
            continue
        if re.search(r"(?:^|[^<>])>>?\s*(?:\S*/)?" + A, seg):
            return True
        s = seg.strip()
        if re.match(r"sed\b", s) and re.search(r"(?:^|\s)-i\b", s):
            return True
        if re.match(r"(?:tee|cp|mv|rm|touch|chmod)\b", s) or re.match(r"git\s+(?:rm|mv)\b", s):
            return True
    return False


def excerpt_around(text, pos, needle_len):
    start = max(0, pos - 40)
    return text[start:start + LIMITS["hitExcerpt"]].replace("\n", " ")


def matchers_of(item):
    """[(matcher, anchor value or '*kind', scope kinds)]"""
    sent, out = item["text"], []
    for k, v in item["anchors"]:
        if k == "path" and v != "*":
            out.append(("forbidden_path", v, ["file_edit", "bash_write"], k))
        elif k == "ident" and v.endswith("()"):
            out.append(("style_token", v[:-2], ["file_edit"], k))
        else:
            out.append(("forbidden_token", v if v != "*" else "*" + k, scope_of(sent), k))
    return out


def token_position(text, needle):
    """Where a whole-token anchor sits in the raw text, for the excerpt: the same boundaries as
    entity_present, case-insensitive; a plain case-insensitive find as the fallback."""
    m = re.search(r"(?<![\w\-])(?<!\w\.)(?<!/)" + re.escape(needle) + r"(?![\w\-])(?!\.\w)", text, re.I)
    if m:
        return m.start()
    return max(text.lower().find(needle.lower()), 0)


def first_inconsistent(item, post_tools, restated_ts):
    """post_tools: [(ts, action)] in order. Returns a DownstreamEvidence-shaped dict."""
    ms = matchers_of(item)
    scope = []
    for _, _, sc, _ in ms:
        scope += [k for k in sc if k not in scope]
    if not ms:
        return dict(result="none_matchable", scope=[])
    for ts, action in post_tools:
        name = action["tool"]
        for mn, ent, sc, kind in ms:
            hit = None  # (artifact, excerpt)
            if mn == "forbidden_path":
                fp = action.get("filePath", "")
                if name in FILE_TOOLS and fp and path_matches(fp, ent):
                    hit = ("file_edit", fp[:LIMITS["hitExcerpt"]])
                elif name == "Bash" and bash_write_hit(action.get("command", ""), ent):
                    cmd = action.get("command", "")
                    hit = ("bash_write", excerpt_around(cmd, max(cmd.find(ent), 0), len(ent)))
            elif mn == "style_token":
                fp, added = action.get("filePath", ""), action.get("addedText", "")
                if name in FILE_TOOLS and fp.lower().endswith(STYLE_EXT):
                    m = re.search(r"\b" + re.escape(ent) + r"\(", added)
                    if m:
                        hit = ("file_edit", excerpt_around(added, m.start(), len(ent)))
            else:
                for akind, text in token_texts(action, sc):
                    if ent.startswith("*"):
                        m = CLASS_RES[ent[1:]].search(text)
                        if m:
                            hit = (akind, excerpt_around(text, m.start(), len(m.group(0))))
                    elif entity_present(kind, ent, norm(text)):
                        # Contract v2: whole token, the same rule as survival, never a substring.
                        hit = (akind, excerpt_around(text, token_position(text, ent), len(ent)))
                    if hit:
                        break
            if hit:
                return dict(result="matched", scope=scope, hit=dict(
                    toolUseId=action["toolUseId"], ts=ts, tool=name, matcher=mn, artifact=hit[0],
                    excerpt=hit[1], afterRestatement=bool(restated_ts and ts > restated_ts)))
    return dict(result="none_found", scope=scope)


# ---- stage 5 ----------------------------------------------------------------------------------------
def restatement_of(item, post_humans):
    """post_humans: [(uuid, ts, text)]. First sentence scoring >= restated, or all entities plus a
    negation word."""
    item_toks = toks(item["text"])
    ent_set = set(t for _, v in item["entities"] for t in toks(v))
    for uuid, ts, text in post_humans:
        for s in split_sents(text or ""):
            score, _ = score_passage(item_toks, ent_set, raw_tokens(s))
            ns = norm(s)
            if score >= THRESHOLDS["restated"]:
                return dict(messageUuid=uuid, ts=ts, score=score, by="score")
            if item["entities"] and all(entity_present(k, v, ns) for k, v in item["entities"]) and NEG.search(straight(s)):
                return dict(messageUuid=uuid, ts=ts, score=score, by="entities")
    return None


# ---- sessions: from a raw transcript or from a fixture ---------------------------------------------
def load(path):
    recs = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for i, l in enumerate(fh, 1):
            try:
                recs.append((i, json.loads(l)))
            except ValueError:
                continue
    return recs


def text_of(r):
    c = r.get("message", {}).get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            return None
        return "".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    return None


def is_human(r):
    if r.get("type") != "user" or r.get("isMeta") or r.get("isSidechain") or r.get("isCompactSummary"):
        return False
    t = text_of(r)
    return t is not None and t.strip() != "" and not t.lstrip().startswith("<command-name>") \
        and not t.lstrip().startswith("<local-command")


def session_id(recs):
    for _, r in recs:
        if r.get("sessionId"):
            return r["sessionId"]
    return ""


def extract_items(recs, ci):
    """Stage 1 over records (line, record) before one boundary; ids <ci>:<line>:<n>."""
    items, seen = [], set()
    for i, r in recs:
        if not is_human(r):
            continue
        for s in split_sents(text_of(r)):
            if not (LIMITS["itemMinChars"] <= len(s) <= LIMITS["itemMaxChars"]):
                continue
            cls, e = classify(s)
            if not cls:
                continue
            n = norm(s)
            if n in seen:
                continue
            seen.add(n)
            items.append(dict(id="%d:%d:%d" % (ci, i, len(items)), compactionIndex=ci, text=s, **{"class": cls},
                              entities=e, anchors=anchors_of(cls, e, s),
                              origin=dict(messageUuid=r.get("uuid", ""), ts=r.get("timestamp", ""), line=i)))
    return items


def session_from_records(recs, sid):
    """Raw records -> the Session shape this script analyzes (first boundary only)."""
    bidx = next((k for k, (_, r) in enumerate(recs) if r.get("type") == "system" and r.get("subtype") == "compact_boundary"), None)
    if bidx is None:
        return None
    _, b = recs[bidx]
    meta = b.get("compactMetadata", {}) or {}
    summ = next((r for _, r in recs[bidx:] if r.get("type") == "user" and r.get("isCompactSummary")), None)
    if summ is None:
        return None
    messages = []
    for i, r in recs:
        if is_human(r):
            messages.append(dict(uuid=r.get("uuid", ""), ts=r.get("timestamp", ""), line=i, kind="human", text=text_of(r)))
        elif r.get("type") == "assistant":
            for blk in (r.get("message", {}).get("content") or []):
                if isinstance(blk, dict) and blk.get("type") == "tool_use":
                    messages.append(dict(uuid=r.get("uuid", ""), ts=r.get("timestamp", ""), line=i, kind="tool_use",
                                         tool=blk.get("name", ""), action=action_of(blk.get("name", ""), blk.get("id", ""), blk.get("input") or {})))
    return dict(id=sid, messages=messages, items=extract_items(recs[:bidx], 0), compactions=[dict(
        boundaryUuid=b.get("uuid", ""), ts=b.get("timestamp", ""), trigger=meta.get("trigger", "manual"),
        preTokens=meta.get("preTokens"), postTokens=meta.get("postTokens"),
        summary=dict(uuid=summ.get("uuid", ""), lines=(text_of(summ) or "").split("\n")))])


def load_fixture(path):
    s = json.load(open(path, encoding="utf-8"))
    s["items"] = [dict(it, entities=[(e["kind"], e["value"]) for e in it["entities"]],
                       anchors=[(a["kind"], a["value"]) for a in it["anchors"]]) for it in s.get("items", [])]
    return s


def analyze_session(s):
    """Stages 2-5 over the first boundary of a Session-shaped dict. Returns [ItemReport-shaped dict]."""
    c = s["compactions"][0]
    lines = c["summary"]["lines"]
    after = [m for m in s["messages"] if m["ts"] > c["ts"]]
    post_tools = [(m["ts"], m["action"]) for m in after if m["kind"] == "tool_use" and m.get("action")]
    post_humans = [(m["uuid"], m["ts"], m.get("text", "")) for m in after if m["kind"] == "human"]
    reports = []
    for it in s["items"]:
        if it["compactionIndex"] != 0:
            continue
        sv = score_item(it, lines)
        rest = restatement_of(it, post_humans)
        ds = first_inconsistent(it, post_tools, rest["ts"] if rest else None)
        reports.append(dict(item=it, survival=sv, downstream=ds, restatement=rest))
    return reports


def report_json(s, reports):
    out = []
    for r in reports:
        it, sv = r["item"], r["survival"]
        item = dict(it, entities=[dict(kind=k, value=v) for k, v in it["entities"]],
                    anchors=[dict(kind=k, value=v) for k, v in it["anchors"]])
        survival = dict(status=sv["status"], score=round(sv["score"], 4), verbatim=sv["verbatim"],
                        passage=dict(lineIndex=sv["idx"], text=sv["passage"]),
                        matches=[dict(start=a, end=b, token=t, fuzzy=f, distance=d) for a, b, t, f, d in sv["matches"]],
                        markedSpan=sv["markedSpan"], entitiesInPassage=sv["entitiesInPassage"],
                        entitiesAnywhere=sv["entitiesAnywhere"], thresholds=THRESHOLDS)
        if "structuralSection" in sv:
            survival["structuralSection"] = sv["structuralSection"]
        row = dict(item=item, survival=survival, downstream=r["downstream"])
        if r["restatement"]:
            row["restatement"] = r["restatement"]
        out.append(row)
    return dict(sessionId=s["id"], compactionIndex=0, items=out)


def table_rows(label, s, reports):
    meta = s["compactions"][0]
    rows = []
    for r in reports:
        it, sv, ds = r["item"], r["survival"], r["downstream"]
        if ds["result"] == "matched":
            h = ds["hit"]
            action = "%s @ %s, %s, `%s` [%s]" % (h["tool"], h["ts"], h["matcher"], h["excerpt"], h["toolUseId"])
            artifact = h["artifact"]
        else:
            action, artifact = ds["result"].replace("_", " "), ""
        rest = r["restatement"]
        rows.append([label, it["text"], it["class"], ", ".join("%s:%s" % (k, v) for k, v in it["entities"]),
                     ", ".join("%s:%s" % (k, v) for k, v in it["anchors"]), sv["status"], "%.2f" % sv["score"],
                     sv["markedSpan"], "L%d:%s → %s; pre=%s post=%s" % (it["origin"]["line"], it["origin"]["messageUuid"][:8],
                                                                         sv["idx"], meta.get("preTokens"), meta.get("postTokens")),
                     action, artifact, "%s (%.2f, %s)" % (rest["ts"], rest["score"], rest["by"]) if rest else "no"])
    return rows


def items_json(path):
    """--items-json: stage-1 items for every boundary, as the fixture builder consumes them."""
    recs = load(path)
    bounds = [k for k, (_, r) in enumerate(recs) if r.get("type") == "system" and r.get("subtype") == "compact_boundary"]
    out = {"sessionId": session_id(recs), "items": []}
    prev = 0
    for ci, bidx in enumerate(bounds):
        for it in extract_items(recs[prev:bidx], ci):
            out["items"].append(dict(it, entities=[dict(kind=k, value=v) for k, v in it["entities"]],
                                     anchors=[dict(kind=k, value=v) for k, v in it["anchors"]]))
        prev = bidx + 1
    return out


class Redactor:
    def __init__(self):
        self.maps = {"ticket": {}, "host": {}, "path": {}}

    def _ph(self, kind, v):
        m = self.maps[kind]
        if kind == "host":
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
                if k == kind:
                    s = r.sub(lambda m: self._ph(kind, m.group(0)), s)
            if kind == "host":
                for h in list(self.maps["host"]):
                    stem = re.sub(r"\d+$", "", h)
                    if stem and stem != h:
                        s = re.sub(r"\b" + re.escape(stem) + r"\d+\b(?!\.)", lambda m: self._ph("host", m.group(0)), s)
        return s


COLS = ["session", "item", "class", "entities", "matcher anchor", "status", "score", "matched span",
        "anchors", "first inconsistent action", "artifact", "restated"]


def print_table(rows, red):
    print("| " + " | ".join(COLS) + " |")
    print("|" + "---|" * len(COLS))
    for r in rows:
        cells = [red(str(x)) for x in r]
        cells[1] = cells[1][:60]
        cells[7] = cells[7][:160]
        cells[9] = re.sub(r"`([^`]*)`", lambda m: "`" + m.group(1)[:60] + "`", cells[9])
        print("| " + " | ".join(c.replace("|", "\\|").replace("\n", " ") for c in cells) + " |")


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("files", nargs="*")
    ap.add_argument("--projects", action="store_true")
    ap.add_argument("--redact", action="store_true")
    ap.add_argument("--session-label", default="")
    ap.add_argument("--items-json", action="store_true", help="print stage-1 items as JSON and exit")
    ap.add_argument("--fixture", action="append", default=[], help="a committed Session JSON instead of a transcript")
    ap.add_argument("--report-json", action="store_true", help="with --fixture: print ItemReport JSON")
    a = ap.parse_args()
    if a.items_json:
        print(json.dumps([items_json(f) for f in a.files], indent=1))
        return
    if a.fixture:
        reports = {}
        for f in a.fixture:
            s = load_fixture(f)
            reports[s["id"]] = (s, analyze_session(s))
        if a.report_json:
            print(json.dumps({sid: report_json(s, r) for sid, (s, r) in reports.items()}, indent=1, ensure_ascii=False))
        else:
            rows = []
            for sid, (s, r) in reports.items():
                rows += table_rows(sid, s, r)
            print_table(rows, Redactor() if a.redact else (lambda x: x))
        return
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
        s = session_from_records(recs, sid)
        if s is None:
            sys.stderr.write("skip %s: no compact_boundary with a summary\n" % f)
            continue
        rows += table_rows(a.session_label + label, s, analyze_session(s))
    print_table(rows, Redactor() if a.redact else (lambda x: x))


if __name__ == "__main__":
    main()
