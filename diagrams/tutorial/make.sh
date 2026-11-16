#!/bin/sh
# チュートリアルの設定ファイルから、juiz_opm で略式図を作る。
# 要るもの: juiz_opm(0.1.0 以降)、Graphviz の dot、librsvg の rsvg-convert
# 使い方: sh diagrams/tutorial/make.sh   (リポジトリのルートで)
set -eu
here=$(dirname "$0")
out="$here/../../src/assets/tutorial-diagrams"
mkdir -p "$out"
for conf in "$here"/*.conf; do
  name=$(basename "$conf" .conf)
  juiz_opm from-conf "$conf" -o "$here/$name.opl" 2>/dev/null
  juiz_opm check "$conf" "$here/$name.opl" 2>/dev/null  # 誤りがあれば止まる(警告だけなら通る)
  juiz_opm draw "$here/$name.opl" > "$here/$name.svg"
  # サイトのダークテーマでも読めるよう、白の背景を付けて PNG にする
  rsvg-convert -b white -z 2 "$here/$name.svg" -o "$out/$name.png"
  rm "$here/$name.svg"
done
