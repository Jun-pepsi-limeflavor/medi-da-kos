#!/usr/bin/env bash
# PostToolUse(Edit|Write) — 원가가 어드민 밖으로 나가는 것을 막는다.
# 화이트리스트다. 블랙리스트는 새 디렉터리가 생길 때마다 구멍이 뚫린다.
set -uo pipefail
f=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
[ -z "$f" ] || [ ! -f "$f" ] && exit 0
case "$f" in *.ts|*.tsx|*.js|*.jsx|*.mjs) ;; *) exit 0 ;; esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
rel=${f#"$root"/}

# 원가를 다뤄도 되는 곳. 일반 딜 스키마·저장소는 허용하지 않는다.
case "$rel" in
  src/lib/schemas/deal-finance.ts|src/lib/repo/deal-finance.ts|src/app/admin/*|src/app/api/admin/*|functions-ingest/*|tests/*) exit 0 ;;
esac

SECRETS='unitCost|supplierCost|factoryPrice|internalCosts|supplierQuotes|grossProfit|margin|markup|fxSnapshot'
hits=$(grep -inE "$SECRETS" "$f" 2>/dev/null | head -10)
[ -z "$hits" ] && exit 0

{
  echo "COST LEAK RISK — $rel 는 어드민 경로 밖인데 원가·제조사 필드를 참조한다:"
  echo "$hits"
  echo
  echo "허용 경로: deal-finance 스키마·저장소 · src/app/admin/** · src/app/api/admin/** · functions-ingest/** · tests/**"
  echo "여기서 다뤄야 한다면 이 훅의 화이트리스트를 넓히되, 넓힌 이유를 커밋 메시지에 남긴다."
} >&2
exit 2
