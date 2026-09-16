#!/bin/sh
# Egress gate (PreToolUse, Bash). Denies any command that can send data off
# this machine. Belt-and-braces alongside the deny rules in .claude/settings.json;
# this catches forms the rule globs miss (env prefixes, $(...), pipes).
# Auto mode ignores "ask" from rules and hooks (verified 2026-09-16), so this
# is a hard deny. To push or call aws, the human lifts the rule for that step.
# This hook never rewrites tool input.
set -eu
INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
[ "$TOOL" = "Bash" ] || exit 0
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
[ -n "$CMD" ] || exit 0

# Match at the start of the command or after a separator (;, &&, ||, |, newline, $( ).
SEP='(^|[;&|(`]|\$\(|\n)[[:space:]]*'
# Optional prefixes: VAR=value assignments, env, command, exec, nohup, sudo, time, nice, timeout N.
PFX='(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*|env|command|exec|nohup|sudo|time|nice|timeout[[:space:]]+[0-9]+[smh]?)[[:space:]]+)*'
PATTERN="${SEP}${PFX}(git[[:space:]]+(push|fetch|pull|clone|remote|ls-remote)|aws|curl|wget|ssh|scp|sftp|rsync|gh|npm[[:space:]]+publish)([[:space:]]|$)"

if printf '%s\n' "$CMD" | grep -qE "$PATTERN"; then
  jq -n --arg r "Egress gate: this command can send data off the machine. Ask the human to lift the rule for this step." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
fi
exit 0
