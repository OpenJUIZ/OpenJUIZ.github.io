---
title: ブローカーの選び方と大きなデータ
description: HTTP・QUIC・IPC のブローカーの使い分けと、カメラ画像などの大きなデータを別プロセスへ速く渡す方法(IPC ブローカーと共有メモリ)を説明します。
sidebar:
  order: 9
---

juiz の Process は、ブローカーを通して別のプロセスや別のマシンから呼び出せます。
このページでは、3 種類のブローカー(HTTP・QUIC・IPC)の使い分けと、カメラ画像のような大きなデータを速く渡す方法を説明します。

:::caution[juiz 0.1.0 以降が必要です]
IPC ブローカー、QUIC ブローカーでの画像の生バイト転送、共有メモリ、pyjuiz の `IpcProxy`、C++・Haskell の画像の引数と戻り値は juiz 0.1.0 から使えます。
0.1.0 の QUIC ブローカーは、それより前の版の QUIC ブローカーとはつながりません(通信の形式を変えたため)。QUIC でつなぐ juiz は、すべて 0.1.0 以降にそろえてください。
:::

## ブローカーの選び方

| | HTTP(`http`) | QUIC(`qmp`) | IPC(`ipc`) |
|---|---|---|---|
| 範囲 | 別マシンも可 | 別マシンも可 | **同じマシンの中だけ** |
| ID の先頭 | `http://127.0.0.1:8000` | `qmp://127.0.0.1:5000` | `ipc://cam0` |
| ポート | 使う(既定 8000) | 使う(UDP) | 使わない(Unix ドメインソケット / 名前付きパイプ) |
| 画像の送り方 | PNG に圧縮(multipart) | 画素をそのまま | 画素をそのまま |
| 720p の画像を返す call | 約 19ms | 約 11〜13ms | **約 1.2ms** |
| ブラウザ・curl・管理画面 | 使える | 使えない | 使えない |
| 起動のしかた | `-d`(既定で起動) | 設定ファイルの `brokers` | `--ipc <名前>` か設定ファイルの `brokers` |

目安は次のとおりです。

- **小さな値のやり取りや、ブラウザ・管理画面から触るとき**は HTTP。今までどおり `-d` で立ち上がります。
- **別のマシンへ画像を送るとき**は QUIC。画像を PNG にしないので HTTP より速く、回線が細ければ回線の速さで決まります。使い方は[チュートリアル第7章](/ja/tutorial/quic-broker/)を見てください。
- **同じマシンの別プロセスへ画像を送るとき**は IPC。ポートを開けずに、HTTP の十数倍の速さで渡せます。

1 つの juiz に複数のブローカーを同時に置けます。`-d` で HTTP を立てたまま IPC も立てれば、管理画面は HTTP で見て、画像は IPC で受け取る、という使い方ができます。

## IPC ブローカーを使う

### 起動する

`--ipc` にブローカーの名前を付けて起動します。名前は同じマシンの中で重ならないように決めます。

```sh
juiz -f image_pipeline.conf --ipc cam0 -d
```

`image_pipeline.conf` は [Python のサンプル集](https://github.com/OpenJUIZ/juiz_examples_python)にある、画像を読み込んで縮小・二値化する例です。これで、この juiz には `http://127.0.0.1:8000` に加えて `ipc://cam0` でも問い合わせられます。
別のターミナルから、`-s` に `ipc://` の ID を渡します。

```sh
juiz -s ipc://cam0 process list
# => ["ipc://cam0/process/resize0::image_resize_python", "ipc://cam0/process/load0::image_load_python", ...]
```

設定ファイルに書くときは、`brokers` に `type_name: ipc` を足します。

```yaml
brokers:
  - type_name: ipc
    name: cam0                  # 省略すると juiz
    max_frame_bytes: 1073741824 # 1 回の要求・応答の上限(既定 1 GiB)。省略してよい
```

- 名前に使えるのは英数字と `_` `-` `.` の 1〜64 文字で、`.` では始められません。
- 同じ名前の IPC ブローカーがすでに動いていると、起動時にエラー(`ipc://cam0 is already in use`)になります。前の juiz が異常終了してソケットのファイルが残っているだけなら、自動で片付けて起動します。
- 0.1.0 より前の設定ファイルにあった IPC ブローカーの `namespace` キーは廃止しました。書いてあるとエラーになるので、`name` に書き換えてください。`buffer_size` は無視されます。

### 通り道とアクセス制御

IPC ブローカーは、Linux・macOS では Unix ドメインソケット、Windows では名前付きパイプを使います。

| OS | 場所 |
|---|---|
| Linux・macOS | `<dir>/<名前>.sock`。`<dir>` は環境変数 `JUIZ_IPC_DIR`、`$XDG_RUNTIME_DIR/juiz`、`/tmp/juiz-<uid>` の順で最初に決まったもの |
| Windows | `\\.\pipe\juiz-<名前>` |

ソケットとパイプは、起動したユーザーだけが開けるように作ります。**同じユーザーのプロセスだけが繋げます**。
コンテナどうしでボリュームを共有して使うときは、両方で `JUIZ_IPC_DIR` を同じ場所に向けてください。ソケットのパスが長すぎる(macOS 104 バイト、Linux 108 バイトを超える)ときも、`JUIZ_IPC_DIR` で短い場所を指定します。

### サブシステムとしてつなぐ

ほかの juiz をサブシステムやマスターシステムとして登録するときも、HTTP と同じく `ipc://` で書けます。

```yaml
subsystems:
  - type_name: ipc
    name: cam0        # ipc://cam0 で待ち受けている juiz をサブシステムにする
```

### Python から呼ぶ

pyjuiz の `IpcProxy` を使います。`ProcessProxy` などの使い方は HTTP と同じです。

```python
from juiz.proxy import ProcessProxy, connect

load = ProcessProxy("load0", ipc="cam0")   # ipc://cam0 に繋ぎ、名前で探す
img = load.call("images/sample.png")       # PIL の Image が画素のまま届く(PNG を経由しない)
small = ProcessProxy("resize0", ipc="cam0").call(img, 160, 120)   # 画像を引数で送るのも同じ

system = connect("ipc://cam0")             # SystemProxy。connect("http://localhost:8000") も同じ形
```

- 画像は PIL の `Image`(`L`・`LA`・`RGB`・`RGBA`・`I;16`)か numpy の配列で送れます。届いた画像は、PIL で表せる形式なら PIL の `Image`、それ以外(16 bit のカラーや 32 bit 小数)は numpy の配列になります。
- 応答の待ち時間の上限は既定で 10 秒です(`IpcProxy("cam0", timeout=秒)` で変えられます)。
- サーバーで起きたエラーは `IpcRemoteError`、繋がらないなど通り道のエラーは `IpcError` になります。

## 大きなデータを速く渡す

### ブローカーごとの画像の扱い

画像(`Capsule::Image`)の引数と戻り値、Topic で流す画像は、ブローカーによって送り方が違います。

- **IPC・QUIC** は、画素を圧縮せずにそのまま送ります。小さな値は JSON で、画像は JSON の外に生バイトで置く形式です。受け手は届いたバイトを画像の領域へ直接読み込むので、余計な複製をしません。
- **HTTP** は、ブラウザや curl から使えるように、今までどおり PNG にして送ります。PNG の圧縮と展開に時間の約 8 割がかかります。

送れる画像の形式は次の 10 種類です。

| 形式 | 内容 |
|---|---|
| `l8` / `la8` | 8 bit グレー(+ アルファ) |
| `rgb8` / `rgba8` | 8 bit カラー(+ アルファ) |
| `l16` / `la16` / `rgb16` / `rgba16` | 16 bit |
| `rgb32f` / `rgba32f` | 32 bit 小数 |

BGR の並びの画像(OpenCV の `cv::Mat` など)は、C++・Haskell の Process から返したときに juiz が RGB に並べ替えます(→ [C++・Haskell で画像を扱う](#chaskell-で画像を扱う))。

1024 要素以上の、整数だけ・小数だけの配列(点群など)も、IPC・QUIC では JSON の数の列にせず生バイトで送ります。整数と小数の区別は保たれます。
`bytes` 型の値は、今は base64 の文字列のまま送ります。

### HTTP で大きな画像を送るとき

HTTP ブローカーが受け付ける本文の大きさは、既定で 256 MiB まで(4K の PNG が通る大きさ)です。もっと大きなものを送るときは `option.http_broker.max_body_bytes` で上げます。超えたときは 413 のエラーが返ります。

```yaml
option:
  http_broker:
    max_body_bytes: 536870912   # 512 MiB
```

### 共有メモリで Topic を流す

同じマシンの別プロセスへ、Topic で 4K のような大きな画像を流し続けるときは、共有メモリのリングバッファを使えます。
送り手は画像を共有メモリに 1 度書き、受け手にはその場所だけを IPC で知らせます。購読者が複数いても、書き込みは 1 回で済みます。

共有メモリは、次のすべてを満たす push で使われます。満たさない push は、IPC の普通の形式(生バイト)で送られます。

1. Topic の push である(call の引数と戻り値には使わない)
2. 転送先のブローカーが IPC である
3. 送り手の設定ファイルで、その Topic に `shared_memory` が書いてある
4. 送るデータが `min_bytes` 以上である

設定は**送り手**(その Topic に publish する Process がある juiz)の設定ファイルに、トップレベルの `topics` で Topic ごとに書きます。受け手の設定は要りません。
受け手の juiz は IPC ブローカーを立てて先に起動しておき、送り手の `subsystems` に IPC で登録します。

```yaml
# 受け手 (viewer.conf)。juiz -f viewer.conf --ipc viewer -d で先に起動する
processes:
  - type_name: image_white_ratio_python
    name: ratio0
    subscribes:
      img: camera/image
```

```yaml
# 送り手 (camera.conf)。juiz -f camera.conf -d で起動する
brokers:
  - type_name: ipc
    name: camera
subsystems:
  - type_name: ipc
    name: viewer               # ipc://viewer の juiz を受け手として登録する
processes:
  - type_name: image_load_python
    name: load0
    publishes: [camera/image]
topics:
  - name: camera/image         # Topic の名前(ネームスペースの解決は publishes・subscribes と同じ)
    shared_memory:
      slots: 4                 # 枠の数。既定 4、2 以上
      slot_bytes: 25165824     # 1 枠のバイト数。既定は auto
      min_bytes: 1048576       # これより小さいデータは共有メモリを使わない。既定 1 MiB
```

既定値のままでよければ `shared_memory: {}` と書きます。
(この例では `plugins` と、`load0` を動かす `ecs` を省いています。)

| 項目 | 既定 | 意味 |
|---|---|---|
| `slots` | 4 | リングの枠の数。送り手は枠を順に上書きして使う |
| `slot_bytes` | auto | 1 枠の大きさ。auto なら、最初に送るデータの大きさを 1 MiB の倍数に切り上げた値 |
| `min_bytes` | 1 MiB | これより小さいデータは共有メモリを使わずに送る |

#### 受け手が遅いとき(古いフレームを捨てる規則)

共有メモリを使う Topic では、**新しいフレームを優先し、古いフレームは捨てます**。

- 送り手は受け手を待ちません。受け手が読み終わっていない枠でも、順番が来れば上書きします。そのため、共有メモリを使う push は受け手の処理の終わりを待たずに返ります。
- 受け手は Topic ごとに「最新の 1 件だけを持つ受け箱」を持ちます。前の知らせを読む前に次が来たら、前のものを捨てます(`dropped` に数えます)。
- 読む前か読んでいる最中に枠が上書きされたら、そのフレームを捨てます(`overwritten` に数えます)。エラーにはなりません。
- 送るデータが `slot_bytes` より大きいと、その push は共有メモリを使わずに送り、最初の 1 回だけ警告をログに出します(`fallback` に数えます)。解像度を途中で上げるときは、`slot_bytes` を書いておいてください。

カメラ画像のように「最新の 1 枚が届けばよい」データ向けです。1 つも落とさずに届けたいデータには、`shared_memory` を書かずに使ってください。

#### 数え上げ

送り手と受け手の Topic の profile(HTTP の `system/profile_full` の `core_store.topics`)に、次の数が出ます。

```json
"shared_memory": {"slots": 4, "slot_bytes": 25165824, "sent": 1200, "fallback": 0, "dropped": 3, "overwritten": 0}
```

送り手は `sent`・`fallback`、受け手は `dropped`・`overwritten` を数えます。管理画面と CLI での表示はまだありません。

共有メモリの領域は、Linux では `memfd`、macOS では作った直後に名前を消した `shm_open`、Windows ではページングファイルの名前付きマッピングで作ります。プロセスが異常終了しても、ファイルや名前は残りません。受け手は領域を読み取り専用で開きます。

### Python で画像を送り受けする

Python の Process は、今までどおり PIL の `Image` を引数と戻り値に使います。ブローカーの違いは juiz が吸収するので、Process のコードは変わりません。
外から呼ぶときは、[`IpcProxy`](#python-から呼ぶ)を使えば PNG を経由しません。

### C++・Haskell で画像を扱う

C++ と Haskell の Process も、画像を引数と戻り値に使えます。一度 juiz に入った画像は Rust の画像と同じなので、IPC・QUIC では生バイトで渡り、ほかの言語の Process ともつなげます。

C++ は `juiz/image.h` の `juiz::Image` を使い、manifest に `add_image_arg` で画像の引数を足します。OpenCV を使うときは `juiz/opencv.h` の `to_mat`・`from_mat` で `cv::Mat` と行き来できます(BGR の並びは juiz が RGB に並べ替えます)。

```cpp
#include "juiz/juiz.h"
#include "juiz/opencv.h"

static auto image_flip_cpp_manif = ProcessManifest("image_flip_cpp").add_image_arg("img", "image to flip");
std::optional<juiz::Image> image_flip_cpp(const juiz::Image& img) {
    cv::Mat m = juiz::to_mat(img);   // BGR の並びの cv::Mat に複製
    cv::flip(m, m, 1);
    return juiz::from_mat(m);        // juiz には RGB8 で入る
}
COMPONENT_PROCESS_FACTORY(image_flip_cpp_manif, image_flip_cpp);   // Component への登録は第5章と同じ
```

複製せずに読みたいときは、`juiz::with_image(cm, name, f)` で関数の間だけ画像を借りられます。

Haskell は `Juiz.Image` の `Image` を使い、manifest に `addImageArg` で画像の引数を足します。

```haskell
invertManifest :: ProcessManifest
invertManifest = processManifest "image_invert_hs"
  & addImageArg "img" "image to invert"

invert :: Image -> Image
invert img = img { imageData = BS.map (255 -) (imageData img) }   -- 8 bit の形式のとき
```

`Image` は引数と戻り値の型そのものとしてだけ使えます。辞書やリストの中(`[Image]` など)には入れられません。

## 速さの目安

同じマシンで別プロセスの Process を呼び、画像(RGB)を戻り値で受け取るまでの時間です(クラウドの Xeon 4 コア、release ビルド、1 回あたり ms)。

| 画像 | HTTP | QUIC | IPC | (参考)同じプロセスの中 |
|---|---|---|---|---|
| 720p(1280×720、2.8 MB) | 19 | 11〜13 | 1.2 | 0.23 |
| 1080p(1920×1080、6.2 MB) | 41 | — | 3.0 | 0.59 |
| 4K(3840×2160、24.9 MB) | 150 | — | 12.7 | 4.3 |

- HTTP の時間のほとんどは PNG の圧縮と展開です。
- QUIC は同じマシンのループバックでの値で、QUIC 自体の暗号化と小さなパケットの送受信が効いています。別のマシンでは回線の速さ(1 Gbps で 720p は約 22ms)の方が効きます。

Topic で別プロセスへ画像を流したときの時間です(IPC、ms)。

| 画像 | 普通の push: 返るまで | 普通の push: 届くまで | 共有メモリ: 返るまで | 共有メモリ: 届くまで |
|---|---|---|---|---|
| 720p | 1.2 | 1.3 | 0.6 | 1.2 |
| 1080p | 2.4 | 2.6 | 1.2 | 2.3 |
| 4K | 19.2 | 20.5 | 8.0 | 18.5 |

共有メモリは、送り手の publish が返るまでの時間を半分ほどにします(送り手のループが速く回せます)。受け手に届くまでの時間はほとんど変わりません。受け手で画像を新しい領域へ 1 回複製しているためです。

数字は juiz の `juiz_core/tests/integration/image_transfer_bench.rs` で測れます。手元のマシンでの目安を知りたいときは、juiz のリポジトリで次を実行してください。

```sh
cargo test --release -p juiz_core --test integration -- image_transfer_bench --ignored --nocapture --test-threads=1
```
