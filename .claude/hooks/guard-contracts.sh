#!/bin/sh
# Contract freeze guard (PreToolUse).
#
# Switch: docs/contracts/FROZEN exists. While it does, deny any write to
#   docs/contracts/**  and  src/domain/contract.ts
# from file tools (Edit, Write, MultiEdit, NotebookEdit) and, best-effort,
# from Bash commands that mention a frozen path together with a write pattern.
# Reads are fine. FROZEN itself is under docs/contracts, so removing it is denied.
# This hook never rewrites tool input.
set -eu
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SWITCH="$ROOT/docs/contracts/FROZEN"
[ -e "$SWITCH" ] || exit 0

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# Normalise a path to repo-relative form.
relpath() {
  p="$1"
  case "$p" in
    "$ROOT"/*) p="${p#"$ROOT"/}" ;;
  esac
  p="${p#./}"
  printf '%s' "$p"
}

is_frozen_path() {
  case "$1" in
    docs/contracts|docs/contracts/*|src/domain/contract.ts) return 0 ;;
  esac
  return 1
}

case "$TOOL" in
  Edit|Write|MultiEdit|NotebookEdit)
    FP=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
    [ -n "$FP" ] || exit 0
    if is_frozen_path "$(relpath "$FP")"; then
      deny "Contract freeze: $(relpath "$FP") is frozen (docs/contracts/FROZEN exists). Reads are fine; writes are blocked."
    fi
    ;;
  Bash)
    CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
    [ -n "$CMD" ] || exit 0
    if printf '%s' "$CMD" | grep -qE 'docs/contracts|src/domain/contract\.ts'; then
      if printf '%s' "$CMD" | grep -qE '(^|[^<])>|\bsed\b.*-i|\btee\b|\bcp\b|\bmv\b|\brm\b|\bunlink\b|\btruncate\b|\bgit (rm|mv|clean|checkout|restore|reset|stash|apply)\b|\b(python3?|node|perl|ruby|awk)\b|\bchmod\b|\bln\b|\btouch\b|\bmkdir\b|\bdd\b|\binstall\b|\brmdir\b|\bfind\b.*-(delete|exec)|\bxargs\b|\bpatch\b'; then
        deny "Contract freeze: command touches a frozen path (docs/contracts or src/domain/contract.ts) with a write pattern. Reads are fine; writes are blocked."
      fi
    fi
    ;;
esac
exit 0
