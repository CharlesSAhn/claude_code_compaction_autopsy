#!/bin/bash
# Run one driver: docs/experiments/run1.md, executed non-interactively.
set -u
RUN=run1
DIR=~/scratch/autopsy-$RUN
OUT=~/scratch/autopsy-runs
LOG=$OUT/$RUN.log
SID=$(uuidgen | tr 'A-Z' 'a-z')
PK=$(echo "$DIR" | sed "s#^~#$HOME#" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPT=$HOME/.claude/projects/$PK/$SID.jsonl
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_SESSION_ID CLAUDE_CODE_CHILD_SESSION
cd "$DIR" || exit 1
echo "$SID" > "$OUT/$RUN.sid"
log() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$LOG"; }
ctx() { python3 - "$TRANSCRIPT" <<'PY'
import json,sys
n=0
for l in open(sys.argv[1]):
    try:o=json.loads(l)
    except: continue
    if o.get("type")=="assistant":
        u=(o.get("message") or {}).get("usage") or {}
        if u: n=u.get("input_tokens",0)+u.get("cache_read_input_tokens",0)+u.get("cache_creation_input_tokens",0)
print(n)
PY
}
TOOLS='Read,Edit,Write,Glob,Grep,Bash(git:*),Bash(ls:*),Bash(cat:*),Bash(grep:*),Bash(wc:*),Bash(python3:*),Bash(find:*),Bash(sed:*),Bash(head:*),Bash(tail:*),Bash(chmod:*),Bash(mkdir:*),Bash(diff:*),Bash(sort:*),Bash(uniq:*),Bash(awk:*),Bash(cut:*)'
FIRST=1
turn() {
  local label="$1" prompt="$2"
  log "== $label =="
  if [ "$FIRST" = 1 ]; then
    printf '%s' "$prompt" | claude -p --session-id "$SID" --permission-mode acceptEdits --allowedTools "$TOOLS" --disallowedTools "Agent,WebFetch,WebSearch" >> "$OUT/$RUN.replies.txt" 2>&1
    FIRST=0
  else
    printf '%s' "$prompt" | claude -p --resume "$SID" --permission-mode acceptEdits --allowedTools "$TOOLS" --disallowedTools "Agent,WebFetch,WebSearch" >> "$OUT/$RUN.replies.txt" 2>&1
  fi
  echo "" >> "$OUT/$RUN.replies.txt"
  log "   exit=$? context=$(ctx) lines=$(wc -l < "$TRANSCRIPT")"
}
log "start sid=$SID dir=$DIR transcript=$TRANSCRIPT"
turn "P1 map" "I'm picking up the argon key-rotation service. Give me a map: read every module under src/argon one by one, no subagents, and list for each what it exports and any hostnames it hard-codes. Don't skip any."
turn "P2 env fact" "useful. staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now. read the three logs in logs/ fully and tell me when stg-01 last emitted a line, and which modules still default to it."
turn "P3 ticket + file rule" "ok, start on VLX-4127. the ask is a dry-run mode for rotation. two options came up: A add a --dry-run flag to scripts/rotate_keys.sh, B write scripts/rotate_keys.py alongside it. we go with B. don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it. plan first, then implement it with a --dry-run flag and a --host override."
turn "P4 ticket rule (typo)" "looks fine. one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog. carry on, add a --ttl flag too and make dry-run print what it would rotate."
turn "P5 style rule" "review what you wrote against src/argon/rotate_1.py and src/argon/sched_2.py so it fits the house style. also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print(). fix anything that doesn't match."
turn "P6 audit pass" "now a full audit pass: read every module under src/argon again, no subagents, and list every call to _client.post that passes timeout=None, with file and line number. I want the complete list, not a sample."
turn "P7 logs again" "and read all three logs again in full and give me every ERROR line as a table: timestamp, host, message. then a count per host."
C=$(ctx); log "context before compact: $C"
if [ "$C" -lt 100000 ]; then
  turn "PAD table" "read every module under src/argon one more time and give me a table of file, line count, function count, and the DEFAULT_TIMEOUT value. no subagents."
fi
log "context at compact: $(ctx)"
turn "COMPACT" "/compact"
log "boundaries=$(grep -c compact_boundary "$TRANSCRIPT") $(grep -o '"compactMetadata":{[^}]*}' "$TRANSCRIPT" | tail -1)"
turn "F1 commit" "write the commit message for the dry-run work and commit it."
turn "F2 old host" "rotation still targets the old staging host somewhere. find it and fix it."
turn "F3 comment" "add a short comment at the top of rotate_keys.py explaining why we went this route instead of changing the shell script."
cp "$TRANSCRIPT" "$OUT/$RUN.jsonl"
log "done. copied to $OUT/$RUN.jsonl ($(wc -l < "$OUT/$RUN.jsonl") lines)"
log "git log: $(git log --oneline | tr '\n' ' | ')"
log "rotate_keys.sh changed vs import: $(git diff --stat 82f67cd -- scripts/rotate_keys.sh | tail -1)"
