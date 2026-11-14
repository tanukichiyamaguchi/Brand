#!/usr/bin/env bash
# 見出し書体（Shippori Mincho B1 / SIL OFL）を、このサイトで使う文字だけに絞った woff2 にする。
#
# index.html・css/lp.css・js/lp.js に出てくる文字＋かな・英数・記号だけを収録するため、
# 文言に新しい漢字を足した時は必ず再実行すること（未収録の文字は端末の明朝体に置き換わる）。
#
# 必要なもの: curl、Python 3 と fonttools・brotli（pip install fonttools brotli）
# 使い方    : リポジトリのルートで  bash tools/build-fonts.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
WEIGHTS="600 800"

# 1. 使用文字の一覧を作る
python3 - "$ROOT" "$WORK/chars.txt" <<'PY'
import sys, pathlib
root, out = pathlib.Path(sys.argv[1]), sys.argv[2]
chars = set()
for rel in ('index.html', 'css/lp.css', 'js/lp.js'):
    chars.update(root.joinpath(rel).read_text(encoding='utf-8'))
for lo, hi in ((0x20, 0x7E), (0x3041, 0x3096), (0x30A1, 0x30FC), (0xFF01, 0xFF5E)):
    chars.update(chr(c) for c in range(lo, hi + 1))
chars.update('、。・「」『』（）〜…ー―—※×％＋￥¥“”‘’〒々〈〉【】／＼')
chars = sorted(c for c in chars if c >= ' ')
pathlib.Path(out).write_text(''.join(chars), encoding='utf-8')
print(len(chars), 'characters')
PY

# 2. 元のフォント（単一TTF）を Google Fonts から取得する。古いUAを名乗ると分割されていないTTFのURLが返る
curl -sS --max-time 30 -H 'User-Agent: Mozilla/4.0' \
  "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@$(echo $WEIGHTS | tr ' ' ';')&display=swap" -o "$WORK/legacy.css"

# 3. ウェイトごとにサブセット化して assets/fonts に置く
mkdir -p "$ROOT/assets/fonts"
for w in $WEIGHTS; do
  url="$(grep -A6 "font-weight: $w" "$WORK/legacy.css" | grep -oE 'https://[^)]+' | head -1)"
  curl -sS --max-time 180 -o "$WORK/src-$w.ttf" "$url"
  pyftsubset "$WORK/src-$w.ttf" --text-file="$WORK/chars.txt" --flavor=woff2 \
    --output-file="$ROOT/assets/fonts/shippori-mincho-b1-$w-subset.woff2"
  ls -l "$ROOT/assets/fonts/shippori-mincho-b1-$w-subset.woff2"
done
