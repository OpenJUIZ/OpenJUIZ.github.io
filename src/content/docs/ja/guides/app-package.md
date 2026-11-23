---
title: アプリの配布(.juizapp)
description: 設定ファイルとプラグインを 1 つの .juizapp ファイルにまとめ、juiz run で動かします。常駐させる基礎パッケージと、それを使うアプリを分けて配ることもできます。
sidebar:
  order: 10
---

設定ファイルと、それが読み込むプラグイン(Rust・C++・Haskell・Zig の共有ライブラリや Python の `.py`)を、1 つのファイル `.juizapp` にまとめて配れます。
受け取った人は、ソースもビルドの道具も無しに、`juiz run` だけで動かせます。

```sh
juiz run talker_listener-0.1.0.juizapp
```

:::caution[juiz 0.0.28 以降が必要です]
`juiz pack`・`juiz run`・`juiz install` は juiz 0.0.28 から使えます。
[起動時の確認と選択](#起動時の確認と選択)と[ダブルクリックで起動する](#ダブルクリックで起動する)は juiz 0.3.0 から使えます。
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
│  │  └─ libjuiz_sdk.so         C++ / Haskell / Zig のとき
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
| `juiz` | 動かせる juiz の版の範囲(`>=0.0.30` など)。省くと pack が `>=<pack した juiz の版>` を書く。古い形の Rust のプラグイン(後述)を含むときだけ `=<juiz_sdk の版>` に決まる |
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
- Rust のプラグインがどれも同じ juiz_sdk でビルドされている(ファイルからビルド情報を読み、マニフェストに書く)。古い形の Rust のプラグインは、rustc の版もそろっている

`.` で始まるもの(`.git`・`.venv`)、`target/`・`build/`・`dist-newstyle/`・`__pycache__/` は入りません。zip は同じ入力から同じバイト列になるように書くので、CI で作り直しても中身が変わりません。

## 動かす: juiz run

```sh
juiz run <ファイル.juizapp | 名前[@版]> [--entry <conf>] [--depend <名前>=<URL>]... [--http] [--no-http] [--http-port <n>] [--ipc <名前>] [--namespace <ns>] [--yes] [--no-prompt] [--forget-depends]
```

ファイルを渡すと、マニフェストと各ファイルの SHA-256、juiz の版、ターゲット、(Rust なら)プラグインの ABI の版を確かめてから、キャッシュ(`~/.cache/juiz/apps/`)に展開して起動します。どれかが合わなければ、プラグインを読み込む前に分かる文で止まります。

```sh
juiz run talker_listener-0.1.0-x86_64-unknown-linux-gnu.juizapp
# talker: Hello World
# listener: Hello World
```

zip の中の絶対パス・`..`・シンボリックリンク・zip 爆弾などは、展開する前に拒否します。

起動できると、立てたブローカーのつなぎ先が 1 行ずつ出ます(juiz 0.3.0 から)。ポートを選び直したときも、ここで実際の番号が分かります。

```text
HTTP broker: http://127.0.0.1:8081/ (web UI: /ui)
IPC broker: ipc://chatter_base
```

| オプション | 意味 |
| --- | --- |
| `--http-port <n>` | HTTP ブローカーのポートを `<n>` にする(設定ファイルの `option.http_broker.port` より優先。立てるかどうかは変えない)。0.3.0 から |
| `--yes` / `-y` | 選択を出さず、推奨の選択肢を選ぶ([起動時の確認と選択](#起動時の確認と選択))。0.3.0 から |
| `--no-prompt` | 選択を出さず、端末から起動していないときと同じに扱う。`--yes` より優先。0.3.0 から |
| `--forget-depends` | [覚えたつなぎ先](#覚えたつなぎ先)を、このアプリの分だけ消してから起動する。0.3.0 から |
| `--no-port-fallback` / `--no-adopt-master` | [ポートが使われていたとき](/ja/guides/config/#ポートが使われていたとき)の動作を禁止する。0.3.0 から |

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
system の profile には `package: {name, version, kind}` が載り、アプリはこれで相手を確かめます。IPC の名前は 1 台に 1 つなので、同じ基礎は同じ機械で 1 つしか動きません。もう動いている基礎をもう一度起動すると、`chatter_base is already running at ipc://chatter_base.` と出て止まります(juiz 0.3.0 から)。

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

基礎が動いていないとき、端末から起動していなければ、何をすればよいかを表示して止まります(基礎を勝手には起動しません)。

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but chatter_base is not running at ipc://chatter_base. Start it first with: juiz run chatter_base
```

juiz 0.3.0 からは、端末から起動していれば、その場で基礎を起動したり、つなぎ先を選び直したりできます([基礎につながらないとき](#基礎につながらないとき))。

基礎とアプリの Process の名前がぶつかるときは、[ネームスペース](/ja/guides/namespace/)を分けます。

## 起動時の確認と選択

:::note[juiz 0.3.0 から使えます]
:::

`juiz run` は、ポートが使われていたり、基礎が見つからなかったりしたとき、その場で選び直せます。
選択肢は起動した端末に番号つきで出ます。数字を入れて Enter を押すと選べ、何も入れずに Enter を押すと `[ ]` の中の推奨を選びます。

選択が出るのは、標準入力と標準エラーが両方とも端末で、`--yes` も `--no-prompt` も付いていないときだけです。CI やスクリプトから起動したときは、選択を出さずに、それぞれの節に書いた「対話できないとき」の動作になります。

- `--yes`(`-y`): 選択を出さず、推奨の選択肢を選びます。ポートが使われていたら空いている番号で起動します。基礎を勝手に起動することはありません。
- `--no-prompt`: 選択を出さず、対話できないときと同じに扱います。

`juiz -f <設定ファイル>` では選択は出ません。設定ファイルを直接動かすときは、[ポートが使われていたとき](/ja/guides/config/#ポートが使われていたとき)の設定で決めます。

### ポートが使われていたとき

`juiz run` は起動する前に、立てるブローカー(HTTP と qmp)のポートを試しに取ってみます。使われていれば、相手が juiz かどうかを確かめて、次を出します。

```text
port 8000 is in use by another juiz (talker_listener 0.1.0).
  1) start on port 8001 (free)
  2) enter a port number
  3) quit
choose [1]:
```

| 相手 | アプリ(`kind: app`) | 基礎(`kind: base`) |
| --- | --- | --- |
| 同じパッケージの juiz | 1) 空いている番号でもう 1 つ起動 / 2) 動いている方の管理画面をブラウザで開く / 3) やめる | `chatter_base is already running at http://127.0.0.1:8100/` で止まる |
| 別の juiz、juiz 以外 | 1) 空いている番号で起動 / 2) 番号を入力 / 3) やめる | 1) 空いている番号で起動 / 2) やめる |
| 対話できないとき | 空いている番号で起動し、`warning: port 8000 is in use; the HTTP broker uses 8001` を出す | エラーで止まる |

- 「空いている番号」は、元の番号から 1 ずつ足して最初に取れた番号です(元の番号 + 100 まで)。
- 基礎の番号を変えると、HTTP でつなぐアプリは `base.http_port` の番号で探すので見つけられません。そのことも選択の前に表示されます。
- アプリで、相手が juiz なら、1) に `(join it as its subsystem)` が付くことがあります。選ぶと、相手の juiz の subsystem としてつながります(依存の基礎を持つアプリでは付きません。詳しくは[ポートが使われていたとき](/ja/guides/config/#ポートが使われていたとき))。
- 選んだ番号はその回だけ使い、覚えません。いつも同じ番号にしたいときは、`--http-port <n>` か設定ファイルの `option.http_broker.port` で決めてください。

基礎のポートが使われていて対話できないときは、次のように止まります。

```text
port 8100 for chatter_base is in use by another program. Free the port, or start it with --http-port <n>.
```

### 基礎につながらないとき

アプリの `depends` の基礎につながらないとき(動いていない、版が合わない、相手が違う)、次を出します。

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but it is not running at ipc://chatter_base.
  1) start chatter_base 0.1.0 now
  2) choose a running chatter_base
  3) enter where chatter_base is (ex., http://192.168.0.10:8100)
  4) retry
  5) quit
choose [1]:
```

| 選択肢 | 動作 |
| --- | --- |
| 1) 今起動する | 範囲に合う版がインストール済みのときだけ出ます。基礎を**別の窓**で起動し、つながるまで最大 10 秒待ってから続けます。アプリを止めても基礎は止まりません |
| 2) 動いているものから選ぶ | この機械の中で IPC で動いている基礎のうち、名前と版が合うもの(`ipc://chatter_base2` など)が見つかったときだけ出ます |
| 3) つなぎ先を入力する | `--depend` と同じ書式の URL を入れます。`http://192.168.0.10` のようにポートを省くと、`base.http_port` の番号を補います |
| 4) もう一度試す | 自分で基礎を起動してから選びます |
| 5) やめる | 何もせずに終わります |

- 1) の「別の窓」は、Windows は新しいコンソール、macOS は Terminal、Linux は見つかった端末エミュレータ(`$TERMINAL`、`x-terminal-emulator`、`gnome-terminal`、`konsole`、`xterm` の順)です。画面が無いときや端末が見つからないときは、端末から切り離して起動し、出力を `~/.cache/juiz/logs/chatter_base.log` に書いて、そのパスを表示します。
- 依存が複数あれば、1 つずつ順に聞きます。
- 対話できないとき、`--yes` のときは、[今までどおり](#アプリ)何をすればよいかを表示して止まります。

### 覚えたつなぎ先

2) か 3) で選んでつながった先は覚えておき、次からはそこにつなぎます。

```text
using chatter_base at http://192.168.0.10:8100 (remembered; --forget-depends to reset)
```

つなぎ先の順は次のようになります。

1. コマンドラインの `--depend`
2. 覚えたつなぎ先
3. アプリの設定ファイルの `subsystems` のうち、`package:` を持つもの
4. 既定の `ipc://<基礎の名前>`

覚えた先につながらなくなったら、また選択が出ます。忘れさせるには `--forget-depends` を付けて起動します。

```sh
juiz run chatter_listener --forget-depends
# forgot the remembered connections of chatter_listener
```

覚えた先は `~/.local/share/juiz/depends.yaml` にアプリごとに書かれます(手で直してもかまいません)。同じ基礎を使う別のアプリには効きません。

```yaml
chatter_listener:
  chatter_base: "http://192.168.0.10:8100"
```

## ダブルクリックで起動する

:::note[juiz 0.3.0 から使えます]
:::

`juiz associate` を 1 回実行すると、`.juizapp` ファイルをダブルクリックで起動できるようになります。管理者の権限は要らず、実行した利用者にだけ効きます。

```sh
juiz associate            # .juizapp を今の juiz に関連付ける
juiz associate --remove   # 関連付けを外す
```

- venv の中で実行すると、その venv の juiz(その venv の Python とパッケージ)で起動するように登録されます。別の venv の juiz に切り替えるときは、そちらの venv でもう一度実行してください。前に登録されていた juiz のパスが表示されます。
- ダブルクリックすると `juiz run` が新しい端末の窓で動きます。窓のタイトルが `juiz - <名前> <版>` になり、`Close this window or press Ctrl+C to stop.` と出ます。止めるときは窓を閉じるか Ctrl+C を押します。
- エラーで止まったときは `Press Enter to close.` と出て、窓が残ります。エラーの文を読んでから Enter で閉じてください。
- [起動時の確認と選択](#起動時の確認と選択)は、この窓に出ます。

### OS ごとの違い

| OS | 書くもの | インストール |
| --- | --- | --- |
| Windows | レジストリ(HKEY_CURRENT_USER の Software\Classes の下の `.juizapp` と `JUIZ.App`) | 右クリックの「Install with juiz」 |
| macOS | `~/Applications/JUIZ Launcher.app` | (メニューは無し。`juiz install` を使う) |
| Linux | `~/.local/share` の mime と applications の下、`~/.config/mimeapps.list` | 右クリックの「このアプリで開く」から「Install with juiz」 |

- **Windows**: コンソール窓を × で閉じても、相手の System から外れるなどの後始末を済ませてから止まります。
- **macOS**: 初めてダブルクリックしたときに「JUIZ Launcher が Terminal を制御しようとしています」と確認が出るので、許可してください。JUIZ Launcher は自分の機械で作ったアプリなので、Gatekeeper には止められません。
- **Linux**: 端末の窓が開くかは、デスクトップ環境の設定によります。`update-mime-database` などのコマンドが無いと警告が出ますが、関連付けは書かれます。端末を閉じたとき(SIGHUP)も、Ctrl+C と同じ後始末をして止まります。

## 言語ごとの注意

| 言語 | パッケージに入れるもの | 受け取る側に要るもの |
| --- | --- | --- |
| Python | `.py` | Python を組み込んだ juiz(pip の juiz-cli)と、`python.requires` のパッケージ |
| Rust | `plugins/<ターゲット>/` の so / dylib / dll | 対応する版の juiz(rustc はそろえなくてよい) |
| C++ | プラグインと libjuiz_sdk | 対応する版の juiz |
| Haskell | プラグインと libjuiz_sdk、GHC の共有ライブラリ・libffi・libgmp | 対応する版の juiz |
| Zig | プラグインと libjuiz_sdk | 対応する版の juiz |

- **Python**: ネイティブのプラグインが無いので、どの OS でも動く 1 つのファイル(`targets: [any]`)になります。たくさんの人に配るなら一番楽です。
- **Rust**: juiz 0.0.30 から、Rust の Process・Container・Component のプラグインは C の関数の境界(プラグインの C ABI)で読み込むので、受け取る側の juiz と rustc の版が違っても動きます。pip で入れた juiz でも動きます。`juiz pack` はマニフェストに `rust.abi`(ABI の版)を書き、`juiz run` は起動前にそれを確かめます。
  - 0.0.29 以前の juiz_sdk でビルドしたプラグインと、実行コンテキスト(EC)・ブローカーのプラグインは古い形(Rust ABI)のままです。これらを含むパッケージは、今までどおり同じ版の juiz_sdk と**同じ rustc** でビルドした juiz でしか動かず、pack が `rust.rustc` と `juiz: "=<juiz_sdk の版>"` を書きます。
  - `juiz` の範囲を自分で書くときは `>=0.0.30` からにしてください。0.0.29 以前の juiz は新しい形のプラグインを読めないので、範囲に入っていれば pack が警告します。
- **C++**: CMake で `find_package(juiz_sdk)` の後に `juiz_sdk_bundle(<ターゲット>)` を呼ぶと、プラグインの RPATH が自身の場所(`$ORIGIN` / `@loader_path`)だけになり、隣に libjuiz_sdk が写されます。できたディレクトリの中身を `plugins/<ターゲット>/` に置きます。Windows の juiz はプラグインの隣の DLL を探します。
- **Haskell**: juiz の `scripts/bundle-plugin-deps.sh <プラグイン> <出力先>` で、プラグインと依存するライブラリを 1 つのディレクトリに集め、隣を探すように書き換えます(Linux は patchelf、macOS は install_name_tool と codesign)。受け取る側に GHC は要りません。
- **Zig**: build.zig で `b.installArtifact(lib)` の代わりに `juiz.installBundle(lib, .{})` を呼ぶと、`zig build` で `zig-out/plugins/` にプラグインと libjuiz_sdk を並べ、プラグインの rpath を自身の場所(`$ORIGIN` / `@loader_path`)だけにします。中身をそのまま `plugins/<ターゲット>/` に置きます。Zig は 1 台から別の OS・CPU 向けにもビルドできるので(`juiz sdk install --target <ターゲット>` と `-Dtarget`)、複数のターゲットのプラグインを 1 台で作れます。受け取る側に Zig は要りません(Zig は juiz 0.3.3 から)。

C++・Haskell の Linux 向けは、受け取る側の glibc が作った側より古いと動かないので、古めの環境(Ubuntu 22.04 など)でビルドすると多くの機械で動きます。
`juiz pack` は、この機械のターゲットのプラグインが、隣のファイルと OS の基本のライブラリ以外を使っていれば警告します。

## サンプル

5 つのサンプル集に、`packages/` と、ビルドの結果を写して `juiz pack` する `scripts/make_packages.py` があります。タグを付けると CI が作った `.juizapp` を Releases に載せます。

- [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python): `talker_listener` と、基礎とアプリの例 `chatter_base` / `chatter_listener`
- [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust)・[juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp)・[juiz_examples_zig](https://github.com/OpenJUIZ/juiz_examples_zig): `talker_listener`(ターゲットごとのファイル)

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
