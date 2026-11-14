---
title: Zenoh ブローカー
description: Zenoh の TCP で別プロセス・別マシンの juiz を呼び出す Zenoh ブローカーの入れ方・設定・共有メモリでの高速化を説明します。
sidebar:
  order: 9.5
---

Zenoh ブローカーは、[Zenoh](https://zenoh.io/) の TCP で別プロセスや別マシンの juiz を呼び出すブローカーです。ブローカーの種類名(ID の先頭)は `zenoh` です。
QUIC ブローカー(`qmp`)と同じく別のマシンにも届き、画像を PNG にせず画素のまま送ります。そのうえで QUIC より 2.5〜3 倍ほど速く、同じマシンの相手には共有メモリで送るので、IPC ブローカーに近い速さが出ます。

:::note[juiz 0.2.9 から使えます]
Zenoh ブローカーは juiz 0.2.9 から使えます。
:::

## ほかのブローカーとの違い

| | QUIC(`qmp`) | Zenoh(`zenoh`) | IPC(`ipc`) |
|---|---|---|---|
| 範囲 | 別マシンも可 | 別マシンも可 | 同じマシンの中だけ |
| ID の先頭 | `qmp://127.0.0.1:5000` | `zenoh://127.0.0.1:7448` | `ipc://cam0` |
| 通り道 | QUIC(UDP) | TCP。同じマシンの相手には共有メモリ | Unix ドメインソケット / 名前付きパイプ |
| 暗号化 | あり(相手の確認はしない) | **なし**(平文の TCP) | なし(同じユーザーだけが繋げる) |
| 720p の画像を返す call | 約 7ms | TCP 約 2.4ms / 共有メモリ 約 1.3ms | 約 0.8ms |
| `juiz` への組み込み | 組み込み済み | pip の `juiz-cli` は組み込み済み。cargo では feature `zenoh-broker` | 組み込み済み |

目安は次のとおりです。

- **別のマシンへ画像を速く送りたい**ときは Zenoh。信頼できるネットワークの中で使ってください(暗号化しません)。
- **経路を暗号化したい**ときは QUIC。
- **同じマシンの中だけ**なら IPC が最も速く、ポートも開けません。同じマシンと別マシンの相手が混ざるときは、Zenoh 1 つで両方に繋げます。

ブローカー全体の選び方と、画像などの大きなデータの扱いは [ブローカーの選び方と大きなデータ](/ja/guides/large-data/) を見てください。

## 入れ方

`juiz` コマンドへの Zenoh の組み込みは、入れ方によって違います。

| 入れ方 | Zenoh ブローカー |
|---|---|
| `pip install juiz-cli` | 組み込み済み。そのまま使えます |
| `cargo install juiz_app` | 組み込まれません。`cargo install juiz_app --features zenoh-broker` で入れ直します |
| `juiz_zenoh_broker` をプラグインとして読む | feature なしの `juiz` でも、設定ファイルの `plugins.broker_factories.zenoh_broker` で読めます |

Zenoh はビルドに時間がかかる(`juiz` の初回ビルドが 2 倍ほどになる)ので、cargo では既定で外してあります。

```sh
cargo install juiz_app --features zenoh-broker
```

組み込まれていない `juiz` で `type_name: zenoh` を書いたり `-s zenoh://...` で繋ごうとしたりすると、知らないブローカーの種類としてエラーになり、上の 2 つの方法が案内されます。

プラグインとして読むときは、[juiz のリポジトリ](https://github.com/OpenJUIZ/juiz) で `cargo build -p juiz_zenoh_broker` を実行してできた `libzenoh_broker.so`(macOS は `.dylib`、Windows は `zenoh_broker.dll`)を、ほかのプラグインと同じく `plugins` に書きます。プラグインは Rust の ABI で読み込むので、読み込む `juiz` と同じ rustc・同じ版の juiz でビルドしてください。

```yaml
plugins:
  broker_factories:
    zenoh_broker:
      path: "./target/debug"
```

## 使い方

### 待ち受ける側

設定ファイルの `brokers` に `type_name: zenoh` を書きます。既定では TCP の 7448 番で待ち受けます(Zenoh のルーター zenohd が使う 7447 番と重ならないようにしています)。

```yaml title="listener_zenoh.conf"
name: listener_zenoh
brokers:
  - type_name: zenoh
    host: 0.0.0.0     # 省略すると 0.0.0.0
    port: 7448        # 省略すると 7448
```

```sh
juiz -f listener_zenoh.conf --process <listener のプラグイン> -d
```

ポートが使用中なら、ERROR をログに出して起動に失敗します(HTTP のように次の番号は試しません)。

### 呼び出す側

ID の先頭を `zenoh://` にすれば、http・qmp と同じように使えます。

```sh
juiz -s zenoh://127.0.0.1:7448 process list
# => ["zenoh://127.0.0.1:7448/process/listener0::listener", ...]
```

[第7章](/ja/tutorial/quic-broker/) の talker と listener も、設定ファイルの `qmp` を `zenoh` に、ID の `qmp://` を `zenoh://` に置き換えれば、そのまま Zenoh でつなげます。talker 側の juiz にも別のポートで Zenoh ブローカーを置き、`zenoh://` の ID どうしでつなぎます。

```yaml title="talker_zenoh.conf"
name: talker_zenoh
brokers:
  - type_name: zenoh
    port: 7449
```

```sh
juiz connection create -t push \
  "zenoh://127.0.0.1:7449/process/talker0::talker" \
  arg1 \
  "zenoh://127.0.0.1:7448/process/listener0::listener"
```

ほかの juiz をサブシステムやマスターシステムとして登録するときや、`broker_proxies` に書くときは、`type_name: zenoh` と `name: <host>:<port>` を書きます。

```yaml
subsystems:
  - type_name: zenoh
    name: 127.0.0.1:7448   # zenoh://127.0.0.1:7448 の juiz をサブシステムにする
```

Topic の push も、call と同じく Zenoh で相手の juiz に届きます。

### 設定の項目

ブローカー(`brokers`)とブローカープロキシ(`broker_proxies`・`subsystems`・`mastersystem`)に書ける項目です。

| 項目 | 既定 | 書ける所 | 意味 |
|---|---|---|---|
| `host` | `0.0.0.0` | ブローカー | 待ち受けるアドレス |
| `port` | `7448` | ブローカー | 待ち受ける TCP のポート |
| `name` | `<host>:<port>` | 両方 | ブローカーでは名前、プロキシでは繋ぎ先。IPv6 は `[<addr>]:<port>` |
| `timeout_ms` | `10000` | プロキシ | 応答を待つ時間の上限。長くかかる Process を呼ぶときは伸ばします |
| `max_frame_bytes` | 1 GiB | 両方 | 1 回の要求・応答の大きさの上限。超えるものは送る前にエラーになります |
| `shared_memory` | `true` | 両方 | 同じマシンの相手へ共有メモリで送るか([下](#共有メモリで速くする)) |
| `shm_pool_bytes` | 64 MiB | 両方 | 共有メモリの領域(pool)の大きさ |
| `zenoh_config` | なし | 両方 | Zenoh の設定に重ねるもの(`{"<キー>": <値>}`、例 `{"transport/link/tx/batch_size": 65535}`) |

### 注意すること

- **暗号化もアクセス制御もしません。** 平文の TCP なので、信頼できるネットワークの中で使ってください。
- 相手の自動発見(Zenoh の scouting)は切ってあり、`name` に書いた相手とだけ話します。zenohd を挟む構成や、ほかの Zenoh のアプリ・ROS 2(rmw_zenoh)とつなぐことはできません。
- Python から外の juiz を呼ぶ pyjuiz、C++・Haskell のクライアントには Zenoh はありません。HTTP か IPC を使ってください(Process を Python・C++・Haskell で書くことはできます)。
- 繋がらないとき、待ち時間を過ぎたとき、繋ぎ先が juiz の Zenoh ブローカーでないときは、`zenoh://127.0.0.1:7448: can not connect (...)`・`no response within 10000 ms`・`no juiz zenoh broker answered` のエラーになります。

## 共有メモリで速くする

相手が同じマシンにいるときは、64 KiB 以上の要求・応答(画像など)を Zenoh の共有メモリで渡します。設定は要りません。相手が別のマシンのときや、どちらかが `shared_memory: false` のときは、自動で TCP で送ります。

### `ulimit -l` を上げる(Linux・macOS)

Zenoh は共有メモリの領域(既定 64 MiB)をまるごと実メモリに固定(mlock)します。多くの Linux では、一般ユーザーが固定できる量の既定は 8 MiB で、そのままでは足りません。足りないときは、次の警告を 1 度だけ出して共有メモリを使わず、TCP で送ります(エラーにはならず、TCP の速さになるだけです)。

```
zenoh: shared memory is turned off. the shared memory pool (shm_pool_bytes = 67108864) can not be locked in memory (RLIMIT_MEMLOCK = 8388608 bytes). raise it (ulimit -l, or LimitMEMLOCK in systemd) or lower shm_pool_bytes. frames are sent over TCP
```

共有メモリを使うには、送る側と受ける側の両方で上限を 64 MiB より大きくしてから `juiz` を起動します。

```sh
ulimit -l          # 今の上限 (KiB)
ulimit -l 131072   # 128 MiB にする。ハードの上限を超えるときは /etc/security/limits.conf などで上げる
```

- systemd のサービスで動かすときは、ユニットに `LimitMEMLOCK=128M` などを書きます。
- Docker では `--ulimit memlock=-1` を付けます。コンテナの `/dev/shm` の既定(64 MB)も足りないことがあるので、`--shm-size=256m` なども付けてください。
- ソフトの上限が足りなくてもハードの上限が足りていれば、juiz が自分で上げます。
- 上限を上げられないときは、`shm_pool_bytes` を上限より小さくしても使えます。ただし、pool より大きな要求・応答(4K の画像なら約 25 MB)は TCP で送ります。
- Windows は mlock しないので、この設定は要りません。

### 切るとき

共有メモリを使いたくないときは `shared_memory: false` を書きます。CPU の負荷がとても高い環境で、受け手がフレームを読めずにエラーや待ち時間切れになるときも、切ってください(Zenoh の既知の問題です)。

```yaml
brokers:
  - type_name: zenoh
    shared_memory: false
```

## 速さの目安

同じマシンで別プロセスの Process を呼んだときの、1 回あたりの時間です(クラウドの 4 vCPU、release ビルド、ms)。

| 画像 | 方式 | 戻り値で受け取る | 引数で送る | Topic の push |
|---|---|---|---|---|
| 720p(2.8 MB) | Zenoh 共有メモリ | 1.2〜1.4 | 1.2〜1.4 | 1.1〜1.6 |
| 720p | Zenoh TCP | 2.4 | 2.3 | 2.4 |
| 720p | IPC | 0.8 | 1.7 | 1.0 |
| 720p | QUIC | 6.5 | 7.3 | – |
| 4K(24.9 MB) | Zenoh 共有メモリ | 8.1〜8.9 | 7.4〜8.2 | 9.5〜10.7 |
| 4K | Zenoh TCP | 19.2 | 22.4 | 21.7 |
| 4K | IPC | 9.1 | 100.2 | 11.5 |
| 4K | QUIC | 66.3 | 62.8 | – |

- Zenoh の Topic の push は、受け手の Process の実行が終わって応答が返るまでの時間です。IPC の Topic は共有メモリのリング(届くまで)の値です。
- 共有メモリは TCP より 720p で約 1.8 倍、4K で約 2.5 倍速く、4K の戻り値は IPC と同じくらいです。引数で大きな画像を送るときは、IPC より Zenoh の方が速くなります。
- 別のマシンへは TCP で送るので、回線の速さ(1 Gbps で 720p は約 22ms)の方が効きます。

手元で測るときは、juiz のリポジトリで次を実行してください。

```sh
cargo test --release -p juiz_zenoh_broker --test zenoh_bench_test -- --ignored --nocapture --test-threads=1
```
