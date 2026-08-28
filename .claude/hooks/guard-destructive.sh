#!/usr/bin/env bash
# PreToolUse(Bash) — block commands that overwrite shared state without a human yes.
#
# AGENTS.md records two incidents this exists to prevent:
#   - a whole-project deploy silently deleted a live function missing from source
#   - a `--dry-run` flag released rules to production for real
# Exit 2 blocks the call and returns stderr to Claude.

set -uo pipefail
cmd=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

deny() { echo "BLOCKED: $1" >&2; echo "Ask the user before running this. AGENTS.md: 'Deploy — ask before running.'" >&2; exit 2; }

case "$cmd" in
  *"firebase deploy"*)
    # deploying a single function/ruleset is fine to propose; whole-project is not
    case "$cmd" in
      *--only*) deny "firebase deploy --only … still overwrites deployed state." ;;
      *)        deny "whole-project 'firebase deploy' — this is the command that deleted a live function." ;;
    esac ;;
  *"firebase functions:delete"*|*"firebase firestore:delete"*)
    deny "destructive firebase command." ;;
  *"--dry-run"*)
    case "$cmd" in
      *firebase*) deny "'--dry-run' on firebase released rules to production for real once. Verify the flag's real behaviour first." ;;
    esac ;;
  *"git push"*--force*|*"git push"*" -f"*|*"git push --force"*)
    deny "force push." ;;
  *"git reset --hard"*)
    deny "git reset --hard discards uncommitted work." ;;
  *"git checkout main"*|*"git switch main"*)
    # AGENTS.md: recurring mistake — checkout main with a dirty tree
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      deny "checkout main with a dirty tree. Use 'git branch -f main origin/main' to move the pointer only."
    fi ;;
esac
exit 0
