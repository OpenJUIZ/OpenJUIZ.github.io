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

## ライセンス

このサイトのソースコードと文章は、次のどちらかのライセンスを選んで利用できます(デュアルライセンス)。

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) または <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT License ([LICENSE-MIT](LICENSE-MIT) または <https://opensource.org/licenses/MIT>)

Licensed under either of Apache License, Version 2.0 or MIT license at your option.

### コントリビューション

明示的に別の意思表示をしない限り、このリポジトリに提出されたコントリビューションは、Apache-2.0 ライセンスの定義に従い、追加の条件なしに上記と同じデュアルライセンスで提供されるものとします。

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
