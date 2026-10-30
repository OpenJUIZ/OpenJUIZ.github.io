---
title: アプリの配布(.juizapp)
description: 設定ファイルとプラグインを 1 つの .juizapp ファイルにまとめ、juiz run で動かします。常駐させる基礎パッケージと、それを使うアプリを分けて配ることもできます。
sidebar:
  order: 10
---

設定ファイルと、それが読み込むプラグイン(Rust・C++・Haskell の共有ライブラリや Python の `.py`)を、1 つのファイル `.juizapp` にまとめて配れます。
受け取った人は、ソースもビルドの道具も無しに、`juiz run` だけで動かせます。

```sh
juiz run talker_listener-0.1.0.juizapp
```

:::caution[juiz 0.0.28 以降が必要です]
`juiz pack`・`juiz run`・`juiz install` は juiz 0.0.28 から使えます。
:::

## 中身

`.juizapp` は zip で、ルートにマニフェスト `juizapp.yaml` を置きます。それ以外の名前は慣例で、設定ファイルから参照できればどこに置いてもかまいません。

```text
talker_listener-0.1.0.juizapp   (zip)
├─ juizapp.yaml                 マニフェスト(ルートに置く)
├─ app.conf                     起動する設定ファイル(既定の entry)
├─ plugins/
│  ├─ x86_64-unknown-linux-gnu/  ターゲットごとのネイティブのプラグイン
│  │  ├─ libtalker.so
│  │  └─ libjuiz_sdk.so         C++ / Haskell のとき
│  └─ aarch64-apple-darwin/
│     └─ libtalker.dylib
└─ python/                      OS に依存しない .py
   └─ listener.py
```

ネイティブのプラグインは `plugins/<ターゲット>/` に置きます。ターゲット名は Rust の target triple(`x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu`、`x86_64-apple-darwin`、`aarch64-apple-darwin`、`x86_64-pc-windows-msvc`)です。

## 設定ファイルの `{target}`

設定ファイルの `plugins` の `path` に書いた `{target}` は、動かしている機械のターゲット名に置き換わります。

```yaml
plugins:
  process_factories:
    talker:
      path: "plugins/{target}"     # Linux x86_64 では plugins/x86_64-unknown-linux-gnu
    listener_python:
      language: python
      path: "./python"
```

パッケージの外で `juiz -f app.conf` を実行したときも同じように置き換わるので、開発中の設定ファイルをそのまま配れます。
相対パスは、どのプラグインの種類(ブローカーと EC のプラグインも)でも、設定ファイルのあるディレクトリからの相対です。

## マニフェスト juizapp.yaml

作る人が書くのは次の項目です。残りの項目(`languages`・`targets`・各ファイルの SHA-256 など)は `juiz pack` が書き足します。

```yaml
format: 1
name: talker_listener          # 英小文字・数字・_・- の 64 文字まで
version: 0.1.0                 # semver
kind: app                      # app(既定)か base
description: "talker と listener を Push でつなぐ例"
license: MIT OR Apache-2.0
entry: app.conf                # juiz run が使う設定ファイル(既定は app.conf)
depends:                       # 使う基礎パッケージと版の範囲(後述)
  robot_base: ">=1.2, <2"
python:
  version: ">=3.10"
  requires: ["numpy>=1.26"]
exclude: ["*.log", "scratch/**"]
```

| 項目 | 意味 |
| --- | --- |
| `juiz` | 動かせる juiz の版の範囲(`>=0.0.28` など)。省くと pack が `>=<pack した juiz の版>` を書く。Rust のプラグインを含むときは `=<juiz_sdk の版>` に決まる |
| `base.http_port` | `kind: base` のとき、HTTP ブローカーを立てる固定のポート |
| `exclude` | pack で入れないファイルの glob |

## 作る: juiz pack

```sh
juiz pack <ディレクトリ> [-o <出力先>] [--target <ターゲット>]...
```

ディレクトリの `juizapp.yaml` を読み、その下のファイルを集めて `<name>-<version>.juizapp` を作ります。`--target` を 1 つだけ指定すると、ファイル名は `<name>-<version>-<ターゲット>.juizapp` になり、ほかのターゲットの `plugins/` は入りません。

pack は zip を書く前に次を確かめ、合わなければ何も書かずにエラーにします。

- entry の設定ファイルが読める。プラグインの `path` がパッケージの中を指している
- ネイティブのプラグインの `path` に `{target}` が入っていて、`plugins/` の下の各ターゲットにそのファイルがある
- Rust のプラグインがどれも同じ juiz_sdk と rustc でビルドされている(ファイルからビルド情報を読み、マニフェストに書く)

`.` で始まるもの(`.git`・`.venv`)、`target/`・`build/`・`dist-newstyle/`・`__pycache__/` は入りません。zip は同じ入力から同じバイト列になるように書くので、CI で作り直しても中身が変わりません。

## 動かす: juiz run

```sh
juiz run <ファイル.juizapp | 名前[@版]> [--entry <conf>] [--depend <名前>=<URL>]... [-b] [--ipc <名前>] [--namespace <ns>]
```

ファイルを渡すと、マニフェストと各ファイルの SHA-256、juiz の版、ターゲット、(Rust なら)rustc を確かめてから、キャッシュ(`~/.cache/juiz/apps/`)に展開して起動します。どれかが合わなければ、プラグインを読み込む前に分かる文で止まります。

```sh
juiz run talker_listener-0.1.0-x86_64-unknown-linux-gnu.juizapp
# talker: Hello World
# listener: Hello World
```

zip の中の絶対パス・`..`・シンボリックリンク・zip 爆弾などは、展開する前に拒否します。

## インストールする: juiz install

何度も使うパッケージはインストールしておくと、名前で起動できます。

```sh
juiz install chatter_base-0.1.0.juizapp
juiz packages
# NAME              VERSION  KIND
# chatter_base      0.1.0    base
juiz run chatter_base             # 一番新しい版。chatter_base@0.1.0 で版も指定できる
juiz uninstall chatter_base@0.1.0
```

置き場所は `~/.local/share/juiz/packages/<名前>/<版>/` です(`JUIZ_DATA_DIR` か `XDG_DATA_HOME` で変えられます)。

## 基礎パッケージとアプリ

ロボットのドライバのように常駐させるものを**基礎パッケージ**(`kind: base`)、それを使うものを**アプリ**として、別々に配れます。基礎とアプリは別のプロセスで動き、juiz の版も言語も独立にできます。

### 基礎

```yaml
# juizapp.yaml
name: chatter_base
version: 0.1.0
kind: base
base:
  http_port: 8100
```

`juiz run chatter_base` で起動すると、パッケージ名と同じ名前の IPC ブローカー(`ipc://chatter_base`)が立ちます。`base.http_port` があれば、HTTP ブローカーもそのポートで立ちます。
system の profile には `package: {name, version, kind}` が載り、アプリはこれで相手を確かめます。IPC の名前は 1 台に 1 つなので、同じ基礎は同じ機械で 1 つしか動きません。

### アプリ

```yaml
# juizapp.yaml
name: chatter_listener
version: 0.1.0
depends:
  chatter_base: ">=0.1, <0.2"
```

`juiz run chatter_listener` は、`depends` の各基礎に subsystem としてつなぎ、相手の profile の名前と版が合うことを確かめてから起動します。つないだ後は、基礎が publish する Topic をアプリの設定ファイルの `subscribes` でそのまま受け取れます(基礎の Process も ID で呼べます)。

つなぎ先は次の順で決まります。

1. コマンドラインの `--depend chatter_base=http://192.168.0.10:8100`(`ipc://<名前>` も書ける)
2. アプリの設定ファイルの `subsystems` のうち、`package: chatter_base` を持つもの
3. 既定: `ipc://chatter_base`(同じ機械の基礎)

```yaml
# 別の機械の基礎を使う設定ファイルの例
subsystems:
  - package: chatter_base
    type_name: http
    name: "192.168.0.10"      # ポートを省くと、インストール済みの chatter_base の base.http_port
```

基礎が動いていないときは、何をすればよいかを表示して止まります(基礎を自動では起動しません)。

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but chatter_base is not running at ipc://chatter_base. Start it first with: juiz run chatter_base
```

基礎とアプリの Process の名前がぶつかるときは、[ネームスペース](/ja/guides/namespace/)を分けます。

## 言語ごとの注意

| 言語 | パッケージに入れるもの | 受け取る側に要るもの |
| --- | --- | --- |
| Python | `.py` | Python を組み込んだ juiz(pip の juiz-cli)と、`python.requires` のパッケージ |
| Rust | `plugins/<ターゲット>/` の so / dylib / dll | 同じ版の juiz_sdk と**同じ rustc** でビルドされた juiz |
| C++ | プラグインと libjuiz_sdk | 対応する版の juiz |
| Haskell | プラグインと libjuiz_sdk、GHC の共有ライブラリ・libffi・libgmp | 対応する版の juiz |

- **Python**: ネイティブのプラグインが無いので、どの OS でも動く 1 つのファイル(`targets: [any]`)になります。たくさんの人に配るなら一番楽です。
- **Rust**: Rust のプラグインは、juiz_sdk の版だけでなく rustc の版まで一致しないと読み込めません。`juiz run` が起動前に確かめ、違えばどの rustc でビルドされたものかを表示して止まります。
- **C++**: CMake で `find_package(juiz_sdk)` の後に `juiz_sdk_bundle(<ターゲット>)` を呼ぶと、プラグインの RPATH が自身の場所(`$ORIGIN` / `@loader_path`)だけになり、隣に libjuiz_sdk が写されます。できたディレクトリの中身を `plugins/<ターゲット>/` に置きます。Windows の juiz はプラグインの隣の DLL を探します。
- **Haskell**: juiz の `scripts/bundle-plugin-deps.sh <プラグイン> <出力先>` で、プラグインと依存するライブラリを 1 つのディレクトリに集め、隣を探すように書き換えます(Linux は patchelf、macOS は install_name_tool と codesign)。受け取る側に GHC は要りません。

C++・Haskell の Linux 向けは、受け取る側の glibc が作った側より古いと動かないので、古めの環境(Ubuntu 22.04 など)でビルドすると多くの機械で動きます。
`juiz pack` は、この機械のターゲットのプラグインが、隣のファイルと OS の基本のライブラリ以外を使っていれば警告します。

## サンプル

4 つのサンプル集に、`packages/` と、ビルドの結果を写して `juiz pack` する `scripts/make_packages.py` があります。タグを付けると CI が作った `.juizapp` を Releases に載せます。

- [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python): `talker_listener` と、基礎とアプリの例 `chatter_base` / `chatter_listener`
- [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust)・[juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp): `talker_listener`(ターゲットごとのファイル)

```sh
# juiz_examples_python で
python scripts/make_packages.py
juiz install dist/chatter_base-0.1.0.juizapp
juiz install dist/chatter_listener-0.1.0.juizapp
juiz run chatter_base              # ターミナル 1
juiz run chatter_listener          # ターミナル 2
# listener_python receives "Hello from chatter_base"
```

形式の細かい決まりは、juiz リポジトリの [docs/spec/app-package.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/app-package.md) にあります。
