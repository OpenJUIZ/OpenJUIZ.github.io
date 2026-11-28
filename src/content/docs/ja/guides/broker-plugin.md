---
title: ブローカーのプラグイン
description: juiz broker コマンドでブローカーを後から入れる方法と、ブローカーのプラグインの C ABI で自分のブローカーを作る方法を説明します。
sidebar:
  order: 9.6
---

ブローカーは、`juiz` コマンドに組み込まれているものと、**プラグインとして後から入れるもの** があります。

| 種類 | ブローカー | 入れ方 |
|---|---|---|
| 組み込み | HTTP(`http`)・IPC(`ipc`)・QUIC(`qmp`) | 要りません。`juiz` を入れればそのまま使えます |
| 後から入れる | Zenoh(`zenoh`) | `juiz broker install zenoh` |

後から入れるブローカーは、**ブローカーのプラグインの C ABI** で作られています。読み込む `juiz` と違う rustc・違う版の juiz でビルドしたものでも、ABI の版が同じなら読み込めます。そのため、OS ごとにビルド済みのアーカイブを配り、`juiz broker install` で入れるだけで使えます。重い依存(Zenoh など)を `juiz` 本体に入れずに済みます。

:::note[juiz 0.3.7 の次の版から使えます]
`juiz broker` コマンドとブローカーのプラグインの C ABI は、juiz 0.3.7 の次の版から使えます。juiz 0.3.7 までの Zenoh ブローカーの入れ方は [Zenoh ブローカー](/ja/guides/zenoh-broker/#juiz-037-までの入れ方) を見てください。
:::

## `juiz broker` コマンド

```text
juiz broker install <名前> [--version <版>] [--from <URL|パス>] [--force]
juiz broker list
juiz broker path <名前> [--version <版>]
juiz broker remove <名前> [--version <版>]
```

### 入れる: `install`

```sh
juiz broker install zenoh
# => looking for releases in https://github.com/OpenJUIZ/juiz_zenoh_broker
#    downloading https://github.com/OpenJUIZ/juiz_zenoh_broker/releases/download/v0.4.0/juiz_broker-zenoh-0.4.0-abi1-x86_64-unknown-linux-gnu.tar.gz
#    installed zenoh broker 0.4.0 (juiz_zenoh_broker, broker ABI 1) to /home/me/.juiz/brokers/zenoh/0.4.0
#    Use it with 'type_name: zenoh' in the conf, or IDs like zenoh://<host>:<port>/…
```

`juiz` は、名前から取得先のリポジトリを引く小さな表を持っています。今あるのは `zenoh`(→ [OpenJUIZ/juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker))だけです。

- 版を省くと、そのリポジトリの GitHub Releases を新しい順に見て、**その `juiz` が読める ABI の版** で、その OS・CPU 向けのアーカイブがある最初のリリースを入れます。もっと新しいリリースが別の ABI の版を必要とするときは、飛ばしたことを `note:` で知らせます。
- `--version <版>` で版を決められます(`0.4.0` でも `v0.4.0` でも)。
- `--from` で、表に無いブローカーや手元のアーカイブを入れられます。`https://…`・`file://…`・ただのパスを受け付けます。`https://` では隣に `<アーカイブ>.sha256` が無ければエラーにします。手元のファイルは `.sha256` があれば照合し、無ければ警告を出して続けます。
- どのときも、アーカイブを sha256 で照合し、中の `juiz-broker.json`(種類名・ABI の版・OS と CPU・ライブラリの場所)とライブラリの印を確かめてから置きます。合わなければ何も残しません。
- 同じ版がもう入っていれば何もしません。入れ直すときは `--force` を付けます。
- GitHub の API の回数制限にかかるときは、環境変数 `GITHUB_TOKEN` を設定してください。

アーカイブがあるのは次の 5 つです。

| OS・CPU | ターゲット |
|---|---|
| Linux x86_64 / arm64 | `x86_64-unknown-linux-gnu` / `aarch64-unknown-linux-gnu` |
| macOS Intel / Apple シリコン | `x86_64-apple-darwin` / `aarch64-apple-darwin` |
| Windows x86_64 | `x86_64-pc-windows-msvc` |

### 見る: `list`

組み込みの種類と、入れたものを並べます。

```sh
juiz broker list
# => TYPE   VERSION  PLUGIN                     STATUS   PATH
#    http   -        -                          builtin  -
#    ipc    -        -                          builtin  -
#    qmp    -        -                          builtin  -
#    zenoh  0.4.0    juiz_zenoh_broker (ABI 1)  used     /home/me/.juiz/brokers/zenoh/0.4.0
```

`STATUS` は次のどれかです。

| STATUS | 意味 |
|---|---|
| `builtin` | `juiz` に組み込まれている |
| `used` | この版が読み込まれる |
| `older` | もっと新しい版が入っているので、この版は使われない |
| `ABI <n> is not supported by this juiz` | この `juiz` が読めない ABI の版。`juiz` を上げるか、読める版を入れる |
| `invalid (<理由>)` | `juiz-broker.json` が無い・壊れている、ほかの OS・CPU 向け、ライブラリが無い、など |
| `not used (builtin)` | 組み込みと同じ名前なので、組み込みの方が使われる |

### 場所を出す・消す: `path`・`remove`

```sh
juiz broker path zenoh                    # 読み込まれる版のディレクトリ
juiz broker path zenoh --version 0.4.0    # その版のディレクトリ
juiz broker remove zenoh --version 0.4.0  # その版だけ消す
juiz broker remove zenoh                  # 全部の版を消す
```

`path` は、読み込める版が無ければエラー(終了コード 1)になります。

## 入れたブローカーを使う

入れた後は、ほかのブローカーと同じく、設定ファイルに `type_name` を書くか、ID の先頭に種類名を書くだけです。`plugins` に書く必要はありません。

```yaml
brokers:
  - type_name: zenoh
    port: 7448
```

```sh
juiz -s zenoh://127.0.0.1:7448 process list
```

[名前の登録](/ja/guides/naming/)で名前から接続先を引くときも、入れてあるブローカー(`used` の版があるもの)につなぎます。

### どのブローカーが使われるか

`juiz` は、ある種類名のブローカーを次の順で探し、最初に見つかったものを使います。

1. 設定ファイルの `plugins.broker_factories` で読み込んだプラグイン
2. 組み込み(`http`・`ipc`・`qmp`)
3. `juiz broker install` で入れたもの

3 は、1・2 に無い種類が要るようになったときにだけ読み込みます。どこにも無ければ、次のように入れ方を案内するエラーになります。

```text
The broker type 'zenoh' is not installed. Install it with 'juiz broker install zenoh'.
```

表に無い種類なら、`plugins.broker_factories` で読み込むか `juiz broker install <名前> --from <URL>` で入れるように案内します。

### 置き場所

入れたものは `~/.juiz/brokers/<種類名>/<版>/` に置かれます(Windows は `%USERPROFILE%\.juiz\brokers`)。環境変数 `JUIZ_BROKER_HOME` で場所を変えられます。

```text
~/.juiz/brokers/
  zenoh/
    0.4.0/
      juiz-broker.json
      lib/libjuiz_zenoh_broker.so      (macOS は .dylib、Windows は juiz_zenoh_broker.dll)
      LICENSE-MIT, LICENSE-APACHE, …
```

いくつかの版を入れておくと、その `juiz` が読める ABI の版で、その OS・CPU 向けのうち、いちばん新しい版を使います。

### 版を固定する

決まった版を使いたいときは、`juiz broker path` で場所を調べ、設定ファイルの `plugins.broker_factories` にそのライブラリの場所を書きます。順番の 1 なので、入れてある新しい版より優先されます。

```sh
juiz broker path zenoh --version 0.4.0
# => /home/me/.juiz/brokers/zenoh/0.4.0
```

```yaml
plugins:
  broker_factories:
    juiz_zenoh_broker:
      path: "/home/me/.juiz/brokers/zenoh/0.4.0/lib"
```

### アプリ(`.juizapp`)で使う

[アプリの配布](/ja/guides/app-package/)では、次のどちらかにします。

- **同梱しない**: 設定ファイルに `type_name: zenoh` だけを書きます。受け取った人の `juiz` に入っていなければ、上の案内(`juiz broker install zenoh`)が出ます。
- **同梱する**: ほかのプラグインと同じく `plugins/<target>/` にライブラリを置き、`plugins.broker_factories` に `path`(`{target}` を含む)を書きます。`juiz pack` は C ABI のブローカーを Rust のプラグインとして扱わず(rustc・juiz_sdk の一致を求めません)、ABI の版を manifest の `broker_abi` に書きます。`juiz run` は、その版を読めない `juiz` なら `Update juiz.` と案内して止めます。

## ブローカーを作る

ブローカーのプラグインの C ABI は、**フレームのバイト列を運ぶだけ** の小さな口です。要求と応答のフレーム(先頭が `JZF1` のバイト列)の組み立て・読み取り、ID の書き換え、Process の呼び出しはすべて `juiz` の側でします。プラグインは、受け取ったフレームを `juiz` に渡し、`juiz` が書いた応答を相手に送り返すだけです。フレームの中身を読む必要はありません。

Rust では、juiz_sdk の `broker_cabi` の trait を実装し、マクロを 1 つ書けば入口ができます。プラグインは juiz_core に依存しません。

```toml title="Cargo.toml"
[package]
name = "my_broker"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "x.y.z"     # juiz 0.3.7 の次の版以降(broker_cabi があるもの)
serde_json = "1"
```

```rust title="src/lib.rs"
use juiz_sdk::broker_cabi::{
    BrokerError, BrokerPlugin, ClientHandle, FrameReceiver, FrameSource, ServerHandle, ServerHost,
};
use serde_json::Value;

pub struct MyBroker;

impl BrokerPlugin for MyBroker {
    const TYPE_NAME: &'static str = "mytcp";      // conf の type_name と ID の先頭 (mytcp://…)
    const DEFAULT_PORT: Option<u16> = Some(7500);
    type Server = MyServer;
    type Client = MyClient;

    /// 待ち受けを始め、実際の住所 (<host>:<port>) と一緒に返す。失敗したらエラーを返す
    fn start(manifest: Value, host: ServerHost) -> Result<(MyServer, String), BrokerError> {
        // manifest は conf の brokers の項目 (host・port など)。
        // 要求が来たら、自分のスレッドから
        //   host.handle(&peer_addr, &mut reader, Some(len), |response: FrameSource<'_>| {
        //       /* 長さなどの区切りを付けて response.write_to(&mut stream) で送る */
        //   })
        // を呼ぶ。handle は Process の実行が終わるまで戻らず、同時にいくつ呼んでもよい
        todo!()
    }

    /// 繋ぎ先 (manifest の name = <host>:<port>) の口を作る。接続は最初の request まで遅らせてよい
    fn connect(manifest: Value) -> Result<MyClient, BrokerError> {
        todo!()
    }
}

pub struct MyServer { /* … */ }

impl ServerHandle for MyServer {
    /// 受け取りをやめ、処理中の host.handle(...) がすべて戻るまで待つ
    fn stop(self) { todo!() }
}

pub struct MyClient { /* … */ }

impl ClientHandle for MyClient {
    /// 要求を request.write_to(...) で送り、届いた応答を response.receive(&mut reader, Some(len)) で渡す
    fn request(&self, request: FrameSource<'_>, response: FrameReceiver<'_>) -> Result<(), BrokerError> {
        todo!()
    }
}

juiz_sdk::export_broker_plugin!(MyBroker);   // 入口 broker_factory_cabi を作る
```

守ること:

- `MyServer`・`MyClient` は `Send + Sync` にします。`juiz` は、同じクライアントの `request` も、サーバーの `host.handle` も、同時にいくつも呼びます。
- `host.handle` と `request` はブロックします。非同期のランタイムのワーカーの中ではなく、ブロックしてよいスレッドから呼んでください。プラグインの中で tokio を使っても、`juiz` の tokio とは別のものなので干渉しません。
- ストリーム(TCP など)で送るときは、フレームの区切りをプラグインが自分で付けます(長さを前に付けるなど)。フレームの中身の形は `juiz` だけが知っているので、形が変わってもプラグインを作り直す必要はありません。
- `FrameSource::write_to` は `std::io::Write` に、`FrameReceiver::receive` は `std::io::Read` から読みます。共有メモリの領域を `Write` にして渡せば、余計な写しをせずに送れます。
- 失敗は `BrokerError` で返します。`BrokerError::error`(待ち受け・接続・送信の失敗、設定が合わない)、`BrokerError::timeout`(応答が来ない)、`BrokerError::unavailable`(相手につながらない・接続が切れた)を使い分けると、呼び出し元に `<種類名>://<名前>: <文>` の形で伝わります。
- ログは `juiz_sdk::log` の `info!`・`warn!` などで `juiz` のログに出せます。
- 入口の中の panic は `juiz` が受け止め、エラーにします。

全部を書いた例は、juiz のリポジトリの [brokers/tcp_test_broker](https://github.com/OpenJUIZ/juiz/tree/main/brokers/tcp_test_broker)(長さを前に付けたフレームを TCP で送るだけの試験用のブローカー、約 300 行)と、[OpenJUIZ/juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker) にあります。

### 試す

ビルドしたライブラリは、待ち受ける側の設定ファイルの `plugins.broker_factories` で読み込めます。キーはライブラリの名前(`libmy_broker.so` なら `my_broker`)です。

```yaml title="server.conf"
plugins:
  broker_factories:
    my_broker:
      path: "./target/release"
brokers:
  - type_name: mytcp
    port: 7500
```

```sh
juiz -f server.conf -d
```

`juiz -s mytcp://127.0.0.1:7500 process list` のように ID で呼び出す側は、`juiz broker install` で入れたものを使います。次の「配る」のアーカイブを作り、`juiz broker install mytcp --from ./juiz_broker-mytcp-….tar.gz` で入れてから試してください。入れた後は、待ち受ける側も `plugins` を書かずに `type_name: mytcp` だけで動きます。

### 配る

`juiz broker install --from` で入れられるアーカイブを作ります。中身は置き場所の `<版>/` の下と同じ並びにします(先頭にディレクトリを置きません)。

```text
juiz_broker-mytcp-0.1.0-abi1-x86_64-unknown-linux-gnu.tar.gz   (Windows は .zip)
  juiz-broker.json
  lib/libmy_broker.so
  LICENSE-MIT, LICENSE-APACHE, …
```

```json title="juiz-broker.json"
{
  "format": 1,
  "type_name": "mytcp",
  "plugin_name": "my_broker",
  "version": "0.1.0",
  "abi_version": 1,
  "target": "x86_64-unknown-linux-gnu",
  "library": "lib/libmy_broker.so"
}
```

- アーカイブの名前は `juiz_broker-<種類名>-<版>-abi<ABI の版>-<ターゲット>.tar.gz` です。ABI の版は今は `1` です(ライブラリの中に `juiz_broker_abi=1;` という印があり、`juiz broker install` はそれも確かめます)。
- 隣に `sha256sum` の形の `<アーカイブ名>.sha256` を置きます。
- GitHub Releases の `v<版>` のリリースに置けば、使う人は `juiz broker install mytcp --from https://github.com/<owner>/<repo>/releases/download/v0.1.0/juiz_broker-mytcp-0.1.0-abi1-x86_64-unknown-linux-gnu.tar.gz` で入れられます。
- 版はプラグイン自身の版で、juiz の版とそろえる必要はありません。合わせるのは ABI の版だけです。

アーカイブを作るスクリプトと、5 つのターゲットでビルドして Releases に置くワークフローは、[juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker) の `scripts/package.sh` と `.github/workflows/release.yml` が参考になります。

C ABI の細かな決まり(入口の表、エラーコード、フレームの受け渡し)は、juiz のリポジトリの仕様書 [docs/spec/broker-plugin-abi.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/broker-plugin-abi.md) にあります。
