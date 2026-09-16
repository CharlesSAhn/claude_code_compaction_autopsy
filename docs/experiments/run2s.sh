#!/bin/bash
# Run two, cheap variant: Sonnet (200k window), rules early, auto-compaction expected during the module pass.
set -u
RUN=run2
DIR=~/scratch/autopsy-$RUN
OUT=~/scratch/autopsy-runs
LOG=$OUT/$RUN.log
SID=$(uuidgen | tr 'A-Z' 'a-z')
PK=$(echo "$DIR" | sed "s#^~#$HOME#" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPT=$HOME/.claude/projects/$PK/$SID.jsonl
MODEL=sonnet
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
bounds() { grep -c compact_boundary "$TRANSCRIPT" 2>/dev/null || echo 0; }
TOOLS='Read,Edit,Write,Glob,Grep,Bash(git:*),Bash(ls:*),Bash(cat:*),Bash(grep:*),Bash(wc:*),Bash(python3:*),Bash(find:*),Bash(sed:*),Bash(head:*),Bash(tail:*),Bash(chmod:*),Bash(mkdir:*),Bash(diff:*),Bash(sort:*),Bash(uniq:*),Bash(awk:*),Bash(cut:*)'
FIRST=1
turn() {
  local label="$1" prompt="$2"
  log "== $label =="
  if [ "$FIRST" = 1 ]; then
    printf '%s' "$prompt" | claude -p --model "$MODEL" --session-id "$SID" --permission-mode acceptEdits --allowedTools "$TOOLS" --disallowedTools "Agent,WebFetch,WebSearch" >> "$OUT/$RUN.replies.txt" 2>&1
    FIRST=0
  else
    printf '%s' "$prompt" | claude -p --model "$MODEL" --resume "$SID" --permission-mode acceptEdits --allowedTools "$TOOLS" --disallowedTools "Agent,WebFetch,WebSearch" >> "$OUT/$RUN.replies.txt" 2>&1
  fi
  local rc=$?
  echo "" >> "$OUT/$RUN.replies.txt"
  log "   exit=$rc context=$(ctx) lines=$(wc -l < "$TRANSCRIPT") boundaries=$(bounds)"
}
log "start sid=$SID model=$MODEL dir=$DIR transcript=$TRANSCRIPT"
turn "P0 short map" "I'm picking up the argon key-rotation service. read src/argon/rotate_1.py, src/argon/sched_2.py, scripts/rotate_keys.sh and config/hosts.yaml and give me a short map of how rotation works and which hosts are involved."
turn "P3 ticket + file rule" "ok, start on VLX-4127. the ask is a dry-run mode for rotation. two options came up: A add a --dry-run flag to scripts/rotate_keys.sh, B write scripts/rotate_keys.py alongside it. we go with B. don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it. plan first, then implement it with a --dry-run flag and a --host override."
turn "P4 ticket rule (typo)" "looks fine. one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog. carry on, add a --ttl flag too and make dry-run print what it would rotate."
turn "P5 style rule" "review what you wrote against src/argon/rotate_1.py and src/argon/sched_2.py so it fits the house style. also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print(). fix anything that doesn't match."
turn "P2 env fact + logs" "useful. staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now. read the three logs in logs/ fully, one by one, and tell me when stg-01 last emitted a line and how many lines each host emitted per day."
turn "P6 module pass" "now an audit pass: read every module under src/argon whose name starts with vault_, lease_, rotate_, audit_ or sched_, one by one, no subagents, and list every call to _client.post that passes timeout=None, with file and line number. complete list, not a sample."
log "after P6: context=$(ctx) boundaries=$(bounds)"
if [ "$(bounds)" = "0" ]; then
  turn "P6b more modules" "same audit for the modules starting with notify_, cache_, policy_, kms_ and acl_. read each one, no subagents."
  log "after P6b: context=$(ctx) boundaries=$(bounds)"
fi
if [ "$(bounds)" = "0" ]; then
  log "no auto-compaction; falling back to manual"
  turn "COMPACT" "/compact"
fi
log "boundaries=$(bounds) $(grep -o '"compactMetadata":{[^}]*}' "$TRANSCRIPT" | tail -1)"
turn "F1 commit" "write the commit message for the dry-run work and commit it."
turn "F2 old host" "rotation still targets the old staging host somewhere. find it and fix it."
turn "F3 comment" "add a short comment at the top of rotate_keys.py explaining why we went this route instead of changing the shell script."
cp "$TRANSCRIPT" "$OUT/$RUN.jsonl"
log "done. copied to $OUT/$RUN.jsonl ($(wc -l < "$OUT/$RUN.jsonl") lines)"
log "git log: $(git log --oneline | tr '\n' ' | ')"
log "rotate_keys.sh changed vs import: $(git diff --stat $(git rev-list --max-parents=0 HEAD) -- scripts/rotate_keys.sh | tail -1)"
