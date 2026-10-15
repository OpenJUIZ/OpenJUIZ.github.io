# OpenJUIZ.github.io

juiz の公式サイト (https://openjuiz.github.io) のソースです。[Astro Starlight](https://starlight.astro.build/) で作っています。

## ローカルで動かす

```sh
npm install
npm run dev      # http://localhost:4321 でプレビュー
npm run build    # ./dist に出力
```

## ページの追加

- 英語のページ(サイトのトップ、既定の言語)は `src/content/docs/` に、日本語のページは `src/content/docs/ja/` に Markdown (`.md` / `.mdx`) で置きます。
- サイドバーは `astro.config.mjs` の `sidebar` で、ディレクトリごとに自動生成しています。
- 日本語訳がないページは、英語のページが表示されます。英語と日本語で同じパス(`/tutorial/...` と `/ja/tutorial/...`)にそろえてください。

## 公開

`main` ブランチに push すると、GitHub Actions (`.github/workflows/deploy.yml`) がビルドして GitHub Pages に公開します。
