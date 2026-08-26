#!/usr/bin/env bash
# PostToolUse(Edit|Write) — surface type errors in the file just edited.
#
# No-ops until a stack exists (AGENTS.md: nothing is chosen yet), and stays quiet
# about pre-existing errors elsewhere in the repo — it only reports the touched file.
# Full test suites do NOT belong here; they belong in CI.

set -uo pipefail
f=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
[ -z "$f" ] && exit 0
case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$root/package.json" ] || exit 0
python3 -c "
import json,sys
s=json.load(open('$root/package.json')).get('scripts',{})
sys.exit(0 if 'typecheck' in s else 1)
" 2>/dev/null || exit 0

if command -v timeout >/dev/null 2>&1; then
  out=$(cd "$root" && timeout 90 npm run --silent typecheck 2>&1) && exit 0
else
  out=$(cd "$root" && npm run --silent typecheck 2>&1) && exit 0
fi

rel=${f#"$root"/}
hits=$(printf '%s\n' "$out" | grep -F "$rel" | head -15)
[ -z "$hits" ] && exit 0

{
  echo "Type errors in the file you just edited ($rel):"
  echo "$hits"
} >&2
exit 2
