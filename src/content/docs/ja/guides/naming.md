---
title: ネーミングサービス
description: 動いている juiz を名前で見つけてつなぐ仕組み(この機械の登録・LAN の自動発見・知っている juiz に聞く peers)と、juiz name・-s <名前>・name:// の使い方を説明します。
sidebar:
  order: 9.8
---

ネーミングサービスは、名前(パッケージ名や System の名前)から、その juiz につながるブローカーの接続先(`ipc://…`・`http://…`・`qmp://…`・`zenoh://…`)を引く仕組みです。
URL やポート番号を覚えていなくても、`juiz -s mobile_sim process list` のように名前で juiz を指せます。基礎パッケージのポートが使われていて別の番号で起動しても、アプリは名前で基礎を見つけます。

:::note[juiz 0.3.7 から使えます]
ネーミングサービスは juiz 0.3.7 から使えます。
:::

## 3 つの見つけ方

中央の名前サーバーは作りません。常駐するプロセス(デーモン)もありません。次の 3 つを重ねて使います。

| 見つけ方 | 届く範囲 | 既定 |
| --- | --- | --- |
| [この機械の登録](#この機械の登録) | 同じ機械(同じユーザー) | 登録も引くのも有効 |
| [LAN の自動発見(mDNS)](#lan-の自動発見mdns) | マルチキャストが届く LAN | 広告は既定オフ。引くのは feature `naming-mdns` 入りの juiz(pip 版は入り)なら有効 |
| [知っている juiz に聞く(peers)](#知っている-juiz-に聞くpeers) | URL を書いた先 | 書いたときだけ |

名前で引くと、まずこの機械の登録を見て、見つからなかったときだけ LAN と peers を見ます。

- 人が書いたつなぎ先(`-s` の URL、`juiz run` の `--depend`、覚えたつなぎ先、設定ファイルの `subsystems`・`mastersystem`)は、いつも名前より優先されます。今の設定ファイルとコマンドはそのまま動きます。
- 登録するのは System(juiz のプロセス)の単位です。Process や Container は登録しません。つないだ後は、今までどおり ID と `list` で引けます。
- つながった後の全体(ロボットにいる juiz の一覧)は、[管理画面](/ja/guides/web-ui/#別プロセスの-juiz-を表示する)や再帰の一覧で見られます。ネーミングサービスが受け持つのは、最初の 1 本を名前でつなぐことと、1 つの juiz が持つ複数のブローカーからどれでつなぐかを選ぶことです。

## この機械の登録

動き続ける juiz(`juiz -d`・`juiz -d -f <設定ファイル>` で常駐するもの、`juiz run <パッケージ>`)は、ブローカーを立て終わったあとに、自分の名前と立てたブローカーの一覧をこの機械の登録に書きます。止まるときに消します。

| 起動のしかた | 登録名 |
| --- | --- |
| `juiz run <パッケージ>` | パッケージ名 |
| `juiz -f <設定ファイル>` | 設定ファイルの `name` |
| 設定ファイルに `name` が無いとき | 登録しない |

- System の既定の[ネームスペース](/ja/guides/namespace/)(`--namespace robot1` など)があれば、登録名は `robot1/mobile_sim` の形になります。
- 名前に使える文字は英数字・`_`・`-`・`.` の 1〜64 文字です(`.` で始まらない)。合わない名前のときは警告を出して登録せずに起動します。
- `juiz process list` などのコマンドが一度だけ動かす juiz は登録しません。
- 登録はファイルです。置き場所は IPC ブローカーのソケットと同じディレクトリの `names/` の下(Linux・macOS は `JUIZ_IPC_DIR` → `$XDG_RUNTIME_DIR/juiz` → `/tmp/juiz-<uid>`、Windows は `JUIZ_IPC_DIR` → `%LOCALAPPDATA%\juiz\run`)で、ほかのユーザーからは読めません。Docker で `JUIZ_IPC_DIR` を共有したコンテナ同士も、同じ機械として互いを引けます。
- 強制終了などで残った登録は、引くときに確かめて消します(プロセスがいない、または問い合わせた相手が別の juiz だったとき)。心拍のような定期的な確かめはしません。

### 一覧を見る: juiz name list

```sh
juiz name list
```

```text
NAME               PACKAGE             PID    STARTED               BROKERS
robot1/mobile_sim  mobile_sim 0.4.0    12345  2026-11-25T06:00:00Z  ipc://mobile_sim http://127.0.0.1:8001
teleop_twist       teleop_twist 0.1.1  12400  2026-11-25T06:01:10Z  ipc://teleop_twist http://127.0.0.1:8002
```

- `--check` を付けると、各 juiz に問い合わせて、答えないものに `(not answering)` を付けます。
- `--json` で JSON を出します。

### 名前を引く: juiz name resolve

```sh
juiz name resolve mobile_sim
# ipc://mobile_sim
```

つなぐのに使うブローカーの URL を 1 行で出します。`--all` を付けると、候補をすべてブローカーの一覧と一緒に出します。

名前は次のように書けます。

| 書き方 | 意味 |
| --- | --- |
| `mobile_sim` | どのネームスペースの `mobile_sim` でも |
| `robot1/mobile_sim` | ネームスペース `robot1` の `mobile_sim` だけ |
| `/mobile_sim` | ルートのネームスペースの `mobile_sim` だけ |
| `mobile_sim@robot2-pc` | 機械 `robot2-pc` の `mobile_sim` だけ(LAN・peers で見つけたものを分けるとき) |

候補が複数あるときは、黙って 1 つを選びません。端末から使っていれば番号で選ばせ、そうでなければ候補を並べたエラーにします。

```text
2 juiz are registered as mobile_sim:
  1) robot1/mobile_sim  0.4.0  pid 12345  (this machine)
  2) robot2/mobile_sim  0.4.0  at robot2-pc
choose [1]:
```

```text
mobile_sim is ambiguous: robot1/mobile_sim (this machine), robot2/mobile_sim@robot2-pc. Write the namespace or the machine (ex., robot1/mobile_sim).
```

### どのブローカーでつなぐか

1 つの juiz が複数のブローカーを立てていれば、次の順で最初につなげるものを選びます。

| 相手の場所 | 順 |
| --- | --- |
| 同じ機械 | `ipc` → `zenoh` → `qmp` → `http` |
| 別の機械(LAN・peers) | `zenoh` → `qmp` → `http` |

同じ機械では、速くてポートを使わない IPC を先にします。別の機械では、速い順([ブローカーの選び方](/ja/guides/large-data/)、[Zenoh ブローカー](/ja/guides/zenoh-broker/))です。種類を決めたいときは、`name://mobile_sim?type=http` や `--depend mobile_sim=http` のように種類を書きます。

### 同じ名前の juiz を 2 つ起動したとき

同じ機械・同じネームスペースに、同じ名前の登録は 1 つしか置けません。

- 基礎パッケージ(`kind: base`)は、もともと同じ機械に 1 つしか起動できません([基礎](/ja/guides/app-package/#基礎))。
- `juiz -f` とアプリは、今までどおり起動します。2 つ目は名前に `-2`(3 つ目は `-3`)を付けて登録し、警告を出します。

```text
warning: mobile_sim is already registered by another juiz (pid 12345); this juiz is registered as mobile_sim-2
```

同じ名前で 2 つ動かしたくないときは、設定ファイルに `option.naming.unique: true` を書くと、2 つ目はエラーで止まります。

## 名前で指す

### CLI の -s

`-s` の値に `://` も `:` も無ければ、名前として引きます。

```sh
juiz -s mobile_sim process list
juiz -s robot1/mobile_sim container list
```

`http://…` や `localhost:8000` のように書いたときは、今までどおりです。`-s` を書かないときの既定も、今までどおり `http://127.0.0.1:8000` です。

### name://

ブローカーの URL を書く所では、`name://<名前>` と書けます。

```text
name://mobile_sim
name://mobile_sim?ns=robot1          # ネームスペースはクエリで書く(ルートは ns=/)
name://mobile_sim@robot2-pc
name://mobile_sim?type=http          # ブローカーの種類を決める
name://mobile_sim/process/inc0::increment
```

書ける所は、CLI の `-s`、`juiz run` の `--depend`、設定ファイルの `subsystems`・`mastersystem`、ブローカー付きの ID(最後の例)、pyjuiz のつなぎ先です。
ID の続き(`/process/…`)と見分けるため、ネームスペースは `/` ではなく `?ns=` で書きます。クエリ(`ns`・`type`)はブローカー付きの ID には書けません。
一覧や profile に出る ID は、引いた後の実際の URL(`ipc://mobile_sim/…`)になります。

設定ファイルでは、今の書き方の種類を `name` にします。

```yaml
subsystems:
  - type_name: name
    name: "mobile_sim"            # "mobile_sim?type=http" のようにクエリも書ける
mastersystem:
  broker_type: name
  broker_name: "mobile_sim"
```

### pyjuiz

```python
import juiz

proxy = juiz.proxy.connect("mobile_sim")       # 名前でつなぐ("name://mobile_sim" も可)
print(juiz.resolve_name("mobile_sim"))          # つなぐ URL
for r in juiz.name_list():                      # この機械の登録
    print(r)
```

pyjuiz は登録のファイルを直接読みます(juiz を通しません)。つなぐ種類は `ipc` → `http` の順です。候補が無ければ `NameNotRegisteredError`、複数なら `NameAmbiguousError` になります(選ばせることはしません)。pyjuiz が見るのはこの機械の登録だけで、LAN と peers は見ません。

### 管理画面

[管理画面](/ja/guides/web-ui/)の左の欄の「ほかの系」を押すと、このマシンで動いている系が並びます。HTTP ブローカーを持つ系は「開く」でその系の管理画面を別の画面に開けます。

## juiz run と基礎パッケージ

`juiz run` のアプリは、依存する基礎パッケージを登録からも探します。つなぎ先は次の順で決まります(太字が増えたもの)。

1. コマンドラインの `--depend`
2. 覚えたつなぎ先
3. アプリの設定ファイルの `subsystems` のうち、`package:` を持つもの
4. **この機械の登録で、パッケージ名・`kind: base`・版が合うもの**
5. **LAN と peers の登録で、4 と同じ条件のもの**
6. 既定の `ipc://<基礎の名前>`

基礎のポートが使われていて別の番号(8100 → 8101 など)で起動しても、同じ機械のアプリは登録の番号で見つけます。登録でつなぎ先が決まったときは、次のように表示します(既定の `ipc://<基礎の名前>` と同じになるときは出しません)。

```text
using chatter_base at http://127.0.0.1:8101 (found in the name list)
```

`--depend` に URL ではなく種類だけを書くと、登録からその種類のブローカーを選びます。設定ファイルの `subsystems` で `name` を省いたときも同じです。

```sh
juiz run chatter_listener --depend chatter_base=http
```

```yaml
subsystems:
  - package: chatter_base
    type_name: http      # name を省くと、登録から種類だけで引く(type_name も省ける)
```

詳しくは [.juizapp パッケージの基礎とアプリ](/ja/guides/app-package/#アプリ)を見てください。

## LAN の自動発見(mDNS)

同じ LAN にいる別の機械の juiz を、設定なしで見つけます。DNS-SD のサービス種別は `_juiz._tcp` です。

:::caution[広告は既定でオフです]
juiz の HTTP ブローカーには認証がありません。LAN に「ここにいる」と広告すると、同じ LAN の誰でもその juiz の Process を呼べることがわかります。広告は、信頼できるネットワークで、出したい juiz だけで有効にしてください。
:::

### juiz を用意する

LAN の自動発見は、feature `naming-mdns` 入りの juiz で使えます。pip で入れた juiz(`pip install juiz-cli`)には最初から入っているので、そのまま使えます。

cargo で入れるときは、feature を付けてビルドします。

```sh
cargo install juiz_app --features naming-mdns
```

feature の無い juiz は LAN を見ません。`--lan` を書くと、警告を出してこの機械の分だけを並べます。

### 広告する

設定ファイルに `option.naming.advertise: true` を書くか、起動に `--advertise` を付けます。

```sh
juiz run mobile_sim --advertise
# note: mobile_sim is advertised on the LAN (mDNS). Other machines on the LAN can find and call it.
```

- 広告に載るのは、別の機械からつなげるブローカー(`http`・`qmp`・`zenoh`)だけです。`ipc` は載りません。
- 設定ファイルの `brokers` で `host: 127.0.0.1` を書いた種類は、この機械の中だけで待ち受けているので載りません。
- 止めるときに取り消しを送ります。強制終了で残った広告は時間切れで消え、引いた側でも確かめます。
- `--no-register` でこの機械の登録を止めても、広告は別に効きます。

### 見つける

別の機械からは、ふつうに名前で引けます。この機械の登録で見つからなければ LAN を探します(1.5 秒ほど待ちます)。

```sh
juiz name resolve mobile_sim
# http://192.168.0.12:8001
juiz -s mobile_sim@robot2-pc process list
```

一覧は、`--lan` を付けたときだけ LAN の分も並べます。`MACHINE` の列が増えます。

```sh
juiz name list --lan
```

```text
NAME               MACHINE    PACKAGE           PID    STARTED               BROKERS
robot1/mobile_sim  (this)     mobile_sim 0.4.0  12345  2026-11-25T06:00:00Z  ipc://mobile_sim http://127.0.0.1:8001
robot2/mobile_sim  robot2-pc  mobile_sim 0.4.0  12345  2026-11-25T06:00:00Z  http://192.168.0.12:8001
```

`juiz run` の依存で、LAN で同じ基礎が 2 つ以上見つかったときは選ばせずにエラーにします。`--depend <基礎>=<URL>` で決めてください。

マルチキャストが届かない網(Docker の bridge、一部の Wi-Fi、サブネット越え)では LAN の自動発見は効きません。そのときは次の peers を使います。

## 知っている juiz に聞く(peers)

別の機械で動いている juiz の URL を書いておき、その juiz に名前の一覧を聞きます。聞かれる側はふつうの juiz で、新しいサーバーは要りません。聞く相手の側で広告を有効にする必要もありません。

書き方は 3 つあり、合わせて使えます。

```yaml
# 設定ファイル
option:
  naming:
    peers:
      - "http://192.168.0.10:8000"
```

```sh
# 引数(何度でも書ける。juiz -f・juiz run・juiz name)
juiz name resolve mobile_sim --peer 192.168.0.10
# 環境変数(, か空白で区切る。Docker のコンテナに 1 行足すだけで済む)
export JUIZ_NAMING_PEERS="192.168.0.10:8000,192.168.0.11"
juiz -s mobile_sim process list
```

- peer の URL は、その juiz の HTTP ブローカーです。`http://` は省け、ポートを省くと 8000 です。HTTP 以外(`qmp://…` など)は書けません。
- この機械の登録で見つからなかったときだけ聞きます(LAN と並行に、1 つ 1.5 秒まで)。答えない peer は警告を出して飛ばし、ほかで探し続けます。
- peer は自分の機械の登録に加えて、peer が別の機械に HTTP でつないでいる juiz の登録も返します。ロボットの中で 1 つの juiz を peer に書けば、それにつながった juiz も名前で引けます。
- peer はさらに先の peers や LAN には聞きません(1 段だけ)。輪のように書いても問い合わせは広がりません。
- peer が返す `127.0.0.1` や `0.0.0.0` の住所は、peer の URL の住所に置き換えてつなぎます。
- 一覧は `juiz name list --lan`(LAN と peers)か `juiz name list --peer <URL>` で並べます。peer で見つけたものは `--json` で `"found": "peer"` になります。

## 設定と引数のまとめ

```yaml
option:
  naming:
    register: true      # false なら、この機械の登録に書かない
    unique: false       # true なら、同じ名前の登録があるとき起動を止める
    advertise: false    # true なら、LAN に広告する(feature naming-mdns)
    peers: []           # 名前を聞く juiz の URL
```

| 引数 | 効き目 | 使える所 |
| --- | --- | --- |
| `--no-register` | `register: false` | `juiz -f`、`juiz run` |
| `--advertise` | `advertise: true` | `juiz -f`、`juiz run` |
| `--peer <URL>` | `peers` に足す(何度でも書ける) | `juiz -f`、`juiz run`、`juiz name` |

| 環境変数 | 意味 |
| --- | --- |
| `JUIZ_NAMING_PEERS` | peers の URL(`,` か空白で区切る) |
| `JUIZ_IPC_DIR` | 登録の置き場所(IPC ブローカーのソケットと同じ) |

| API(GET) | 返すもの |
| --- | --- |
| `naming/list` | その juiz の機械の登録。`?check=true` で死活も確かめる、`?lan=true` で LAN と peers も |
| `naming/resolve?name=<名前>` | 名前の候補のすべて(選ぶのは呼んだ側) |

## できないこと

- 認証・暗号化はしません(ブローカーの今の扱いのまま)。
- サブネット越え・インターネット越しの自動発見はしません(peers に URL を書けば届きます)。
- ROS 2 の discovery や OpenRTM のネームサービスとはつながりません。

仕様の詳細は juiz の [docs/spec/naming.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/naming.md) にあります。
