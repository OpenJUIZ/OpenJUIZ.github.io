---
title: データ型
description: Process の引数と戻り値に名前のついた型を付けます。IDL(JIDL)の文法、生成器、互換性の決まり、標準の型 juiz_std、型パッケージの配り方をまとめます。
sidebar:
  order: 8
---

Process の引数と戻り値には、`robot.geometry.Pose2D` のような**名前のついたデータ型**を付けられます。
型は IDL(**JIDL**、拡張子 `.jidl`)で書き、生成器 `juiz idl`(単体のコマンド `juiz-idl` も同じ)で各言語の型を作ります。
手を動かして試すには、[チュートリアル第 8 章](/ja/tutorial/datatype/) から始めてください。

:::caution[juiz 0.0.23 以降]
データ型は juiz 0.0.23 から使えます。このページの [標準の型 juiz_std](#標準の型-juiz_std)、import の探し先(`-I`)、`--extern` は 0.0.24 から使えます。
:::

## 考え方

- **型は契約です。** 通信(HTTP・QUIC など)で流れるデータは、今までどおりの辞書(JSON 相当の値)です。型は「この形の辞書をやりとりする」という約束で、juiz はそれを接続のときに確かめます。
- **型付けは任意です。** 型なしの Process・引数は今までどおり動きます。型付きと型なしはいつでもつながり、型の検査は両方が型付きのときだけ行います。試作のうちは辞書のまま書き、形が決まったところから型を付けられます。
- **同じ定義なら同じ型です。** 型の同一性は、型の中身から計算した**指紋**で決まります。同じ JIDL から作った型は、言語やパッケージが違っても同じ型として扱われます。
- 型のモデルと互換性の決まりは [Apache Avro](https://avro.apache.org/) 1.11 のスキーマに合わせています。`juiz idl` は JIDL を Avro のスキーマ(`.avsc`)にも書き出せます。

## JIDL の書き方

```text
// geometry.jidl
namespace robot.geometry;

/** 平面上の点 */
record Point2D {
  double x;
  double y;
}

record Pose2D {
  Point2D position;
  double theta = 0.0;
  string frame = "map";
  @aliases(["note"]) string? comment = null;
}

enum MotorMode { Idle, Velocity, Position } = Idle;

/** 指定の姿勢まで動く */
process Pose2D move_to(Pose2D target, double speed = 1.0);

process image capture_gray(image img);

container motor {
  container_process boolean set_mode(MotorMode mode);
  container_process void stop();
}
```

### 宣言

| 宣言 | 書き方 | 内容 |
|---|---|---|
| 名前空間 | `namespace robot.geometry;` | ファイルの先頭に 1 つだけ書く(必須)。型の完全名は `robot.geometry.Pose2D` になる。`juiz` とその下(`juiz.*`)は予約されていて使えない |
| 取り込み | `import idl "common.jidl";` / `import schema "x.avsc";` | ほかの JIDL や、手で書いた Avro のスキーマの型を使う |
| レコード | `record Name { 型 名前 [= 既定値]; … }` | フィールドを並べた型。フィールドの順番も型の一部 |
| 列挙 | `enum Name { A, B } [= A];` | 値は記号の文字列。`= A` は列挙の既定値(知らない記号が来たときに使う) |
| Process | `process 戻り値の型 名前(型 引数 [= 既定値], …);` | Process のシグネチャ。戻り値がなければ `void` |
| Container | `container 型名 { container_process … ; }` | その Container の ContainerProcess のシグネチャ。Container 自体の状態は型付けしない |

- 宣言の順番は自由で、後ろの型を前で参照できます。自分自身を(間接にも)フィールドに持つ型は書けません。
- 型の名前は、同じファイルの名前空間、次に完全名の順で探します。ほかの名前空間の型は完全名(`juiz_std.geometry.Pose2D`)で書きます。
- コメントは `//` と `/* … */`。`/** … */` は直後の宣言・フィールド・引数の説明(`doc`)になり、生成したコードや `juiz type show` に残ります。
- `@aliases(["old_name"])` はレコード・列挙・フィールドの別名で、名前を変えたときに古い名前の値を読めるようにします。`@namespace("a.b")` はその型だけ名前空間を変えます。
- キーワードと同じ名前は `` `record` `` のようにバッククォートで囲みます。名前は `[A-Za-z_][A-Za-z0-9_]*` です。

### 使える型

| JIDL | 内容 |
|---|---|
| `boolean` | 真偽 |
| `int` / `long` | 32 bit / 64 bit の整数(juiz の既定の整数は `long`) |
| `float` / `double` | 32 bit / 64 bit の浮動小数点数(juiz の既定は `double`) |
| `string` | 文字列(UTF-8) |
| `bytes` | バイト列 |
| `array<T>` | 配列 |
| `map<T>` | 辞書(鍵は文字列) |
| `T?`(`union { null, T }`) | 省略可能。union は `null` と 1 つの型の組だけ書ける |
| レコード名・列挙名 | `record` / `enum` で宣言した型 |
| `any` | 何でも入る値(今の型なしの辞書と同じ)。型の中に「ここは自由」を残すときに使う |
| `image` | 画像。引数か戻り値の型そのものにだけ使える(フィールドや配列の要素にはできない) |
| `null` / `void` | 値がないこと。戻り値にだけ使える |

Avro の `fixed`、一般の union、logical type(時刻・decimal など)は使えません。

### 既定値

既定値は、通信で流れる辞書(JSON)の書き方で書きます。

```text
record Robot {
  Pose2D pose = {"position": {"x": 0.0, "y": 0.0}};   // レコードはオブジェクト
  MotorMode mode = "Idle";                           // 列挙は記号の文字列
  array<double> joints = [];
  map<string>? tags = null;
  bytes raw = "";                                    // bytes は base64 の文字列
}
```

**すべてのフィールドに既定値を付けておく**と、引数を省いても値を作れ、後でフィールドを足しても古い型と読み合えるので扱いやすくなります(→ [互換性の決まり](#互換性の決まり))。

## 辞書での表し方

型付きの値も、通信では次の辞書で表します。CLI や curl、型を知らないプログラムからは、この形の辞書で呼び出せます。

| 型 | 辞書での値 |
|---|---|
| `boolean`・数・`string` | JSON の値そのまま。`int`・`long` は範囲外や `1.0` のような小数の表記を受け付けない |
| `bytes` | base64 の文字列 |
| `array<T>` / `map<T>` | JSON の配列 / オブジェクト |
| `T?` | `null` か、T の値を**そのまま**(Avro の JSON 形式のように `{"T": 値}` で包まない) |
| レコード | フィールド名をキーにしたオブジェクト |
| 列挙 | 記号の文字列 |
| `image` | 辞書には入らず、今までどおり画像として渡す |

読むとき(受け取る側の型で辞書を読むとき)の決まり:

- 辞書にないフィールドは、そのフィールドの既定値になります。既定値もなければエラーです。
- 型にないキーは無視します(新しい型の値を古い型で読めるように)。
- 列挙の知らない記号は、列挙の既定値になります。既定値がなければエラーです。

## 型の識別子と指紋

- **指紋**は、型の Avro スキーマを正規形(Parsing Canonical Form)にしたものの SHA-256 で、`sha256:` に 64 桁の 16 進数を続けて書きます。フィールドの名前・型・順番、記号の並び、型の完全名と、参照している型の中身がすべて入ります。**既定値・説明・別名は入りません**(変えても指紋は変わりません)。
- 型の**識別子**は `<完全名>@sha256:<64 桁>`(例 `robot.geometry.Pose2D@sha256:1a2b…`)です。表示用に先頭 8 桁の短い形(`Pose2D@1a2b3c4d`)も使います。
- 完全名と指紋の両方が同じなら同じ型です。型パッケージの版(クレートや wheel の版)は識別子に入りません。

## 生成する: juiz idl

```text
juiz idl [-o 出力先] [-g 出力の種類,…] [--check] 入力.jidl|入力.avsc ...
```

- `import` した先も読み、読んだすべてのファイルの型を書き出します。
- `--check` は書き出さずに検査だけして、型の識別子を表示します。エラーは `ファイル:行:桁: 内容` の形で出ます。
- `-g` を省くと `avsc,json-schema,processes` を書き出します。

| `-g` | 書き出すもの |
|---|---|
| `avsc` | 名前付き型ごとの Avro のスキーマ `<完全名>.avsc` |
| `json-schema` | 辞書の表し方の JSON Schema(2020-12)`<完全名>.schema.json`。juiz を使わないプログラムに型を伝えるときに |
| `processes` | `process` / `container` 宣言のシグネチャ `<名前空間>.processes.json` |
| `rust` | struct / enum と `JuizType` の実装(`<名前空間>.rs`・`juiz_idl.rs`)。ふつうは build.rs から作る |
| `rust-skeleton` | `process` / `container` 宣言からの Rust の雛形。一度作ってコピーし、本体を書く |
| `python` | dataclass / `enum.Enum` と型付きのクライアント(名前空間 `a.b` → `a/b/__init__.py`) |
| `cpp` | struct / `enum class` と cppjuiz の `juiz::type_traits`(`<名前空間>.h`・`juiz_idl.h`、ヘッダのみ) |
| `haskell` | record・直和型と hsjuiz のインスタンス(名前空間 `a.b` → モジュール `A.B`) |
| `typescript` | interface・文字列リテラルの union と型参照(`<名前空間>.ts`・`juiz_idl.ts`、実行時の依存なし) |

言語ごとの使い方:

- **Rust**: `[build-dependencies]` に `juiz_idl` を足し、build.rs で `juiz_idl::build::compile(&["idl/geometry.jidl"])`、`src/lib.rs` で `include!(concat!(env!("OUT_DIR"), "/juiz_idl.rs"));`。名前空間 `robot.geometry` はモジュール `robot::geometry` になります。生成した型を `#[juiz_process]` などの関数の引数・戻り値に書くと型付きになります。Rust の型に `#[derive(JuizType)]` を付けて型を作ることもできます(同じ形の JIDL と指紋が一致します)。
- **Python**: `juiz idl -g python -o gen idl/geometry.jidl` で作ったパッケージを `option.pythonpath`(設定ファイル)や `PYTHONPATH` に入れ、`from robot.geometry import Pose2D` として型ヒントに書きます。`process move_to` からは型付きのクライアント `MoveToClient`、`container motor` からは `MotorClient` も作られます。
- **C++**: CMake で `juiz_generate_types(<ターゲット> IDL idl/geometry.jidl)`(juiz の `bindings/cppjuiz/cmake/juiz_idl.cmake`)。ビルドのときにヘッダを作ります。manifest に `add_typed_arg<T>(…)` と `returns<T>()` を書きます。
- **Haskell**: `juiz-idl -g haskell -o gen idl/geometry.jidl` で作ったモジュールを cabal の `hs-source-dirs` と `other-modules` に足し、manifest に `addTypedArg` を書きます。

各言語の例は、サンプル集([Rust](https://github.com/OpenJUIZ/juiz_examples_rust)・[Python](https://github.com/OpenJUIZ/juiz_examples_python)・[C++](https://github.com/OpenJUIZ/juiz_examples_cpp)・[Haskell](https://github.com/OpenJUIZ/juiz_examples_haskell))の `types/geometry.jidl` と、それを使う `pose_move` にあります。

### 言語との対応

| JIDL | Rust | Python | C++ | Haskell | TypeScript |
|---|---|---|---|---|---|
| `boolean` | `bool` | `bool` | `bool` | `Bool` | `boolean` |
| `int` / `long` | `i32` / `i64` | `int` | `int32_t` / `int64_t` | `Int32` / `Int64` | `number` |
| `float` / `double` | `f32` / `f64` | `float` | `float` / `double` | `Float` / `Double` | `number` |
| `string` | `String` | `str` | `std::string` | `Text` | `string` |
| `bytes` | `Vec<u8>` | `bytes` | `std::vector<uint8_t>` | `ByteString` | `string`(base64) |
| `array<T>` | `Vec<T>` | `list[T]` | `std::vector<T>` | `[T]` | `T[]` |
| `map<T>` | `HashMap<String, T>` | `dict[str, T]` | `std::map<std::string, T>` | `Map Text T` | `Record<string, T>` |
| `T?` | `Option<T>` | `T \| None` | `std::optional<T>` | `Maybe T` | `T \| null` |
| レコード | struct | dataclass | struct | record | interface |
| 列挙 | enum | `enum.Enum` | `enum class` | 直和型 | 文字列リテラルの union |
| `any` | `Value` | `Any` | `juiz::Value` | `Value` | `unknown` |
| `image` | `DynamicImage` | `PIL.Image.Image` | (未対応) | (未対応) | (未対応) |

### import の探し先とほかのパッケージの型

:::note[juiz 0.0.24 以降]
import の探し先(`-I`・`JUIZ_IDL_PATH`)と `--extern` は、0.0.24 以降の `juiz idl` で使えます。
:::

`import idl "x/y.jidl";` は、次の順に探します。

1. import を書いたファイルからの相対パス
2. `-I <dir>`(`--import-dir`、繰り返し可。build.rs は `Builder::import_dir`、CMake は `juiz_generate_types(… IMPORT_DIRS <dir>)`)、次に環境変数 `JUIZ_IDL_PATH` のディレクトリ
3. juiz-idl に組み込んだ標準の型(`juiz_std/…`)

`--extern <名前空間>[=<Rust のパス>]`(build.rs は `Builder::extern_path`)を付けると、その名前空間(と下の名前空間)の型を書き出さず、ほかのパッケージにあるものを使います。型の検査は今までどおり行います。

```sh
# juiz_std の型は pyjuiz に入っているものを使い、自分の型だけを作る
juiz idl -g python --extern juiz_std -o gen idl/my_robot.jidl
```

```rust
// build.rs。juiz_std の型は juiz_std_types クレートのものを使う
fn main() {
    juiz_idl::build::configure()
        .extern_path("juiz_std", "::juiz_std_types::juiz_std")
        .compile(&["idl/my_robot.jidl"])
        .unwrap();
}
```

Rust と Python は `--extern` で型パッケージのものを使います(同じ型が 2 つの別の Rust の型・Python のクラスになるのを避けるため)。C++・Haskell・TypeScript は、ふつうは import した型も一緒に作ります。

## 型の検査

| いつ | 何を確かめるか | 既定 |
|---|---|---|
| manifest を作るとき(プラグインを読み込むとき) | 型付きの引数の既定値が型に合うか | 常に |
| 接続を作るとき(設定ファイルの `connections`、`juiz connection create`) | つなぐ元の戻り値の型を、つなぐ先の引数の型として読めるか。読めなければ接続しないでエラー(`TypeIncompatibleError`) | 常に |
| Topic に publish / subscribe を始めるとき | 同じ Topic につながっている相手と型が合うか | 常に |
| Composite を定義するとき | 子の戻り値と親の引数の型が合うか(0.0.25 以降、→ [Composition](/ja/guides/composition/#型の検査)) | 常に |
| 呼び出し(`call`)のとき | 渡された辞書が引数の型に合うか。合わなければ関数を呼ばずにエラー(`ValueDoesNotMatchTypeError`) | オフ |

呼び出し時の検査は、設定ファイルで入れます。

```yaml
option:
  type_check:
    on_call: true
```

オフのときでも、型付きの Process は届いた辞書を型で読むので、読めない辞書はその Process の呼び出しのエラーになります。エラーには、型の中のどこが合わないか(`pose.position.x` など)が付きます。

## 互換性の決まり

接続のとき、juiz は**値を出す側の型(writer)の値を、受け取る側の型(reader)として読めるか**を確かめます。結果は「同じ」「互換」「互換でない」のどれかで、互換でなければ接続しません。どちらかが型なしなら確かめずにつなぎます。
決まりは Avro のスキーマ解決に合わせ、辞書の表し方で成り立たないものだけ変えています。

- `any` は何とでも互換です(`image` を除く)。`image` は `image` と `any` とだけ互換です。
- 数は広い型へは互換です(`int` → `long` / `float` / `double`、`long` → `float` / `double`、`float` → `double`)。逆向きは互換でありません。
- `string` と `bytes` は互換でありません(辞書では `bytes` が base64 の文字列なので、読み違えるため)。
- 配列・辞書は、要素が互換なら互換です。
- `T` → `U?` は互換、`T?` → `U?` も互換、**`T?` → `U` は互換でありません**(`null` が来たら読めないため)。
- レコードは、完全名が同じか reader の `@aliases` に writer の名前があり、reader の各フィールドが「writer に同じ名前(か別名)のフィールドがあって型が互換」か「既定値がある」なら互換です。writer にだけあるフィールドは無視します。
- 列挙は、完全名が同じか別名にあり、writer の記号がすべて reader にあるか、reader に列挙の既定値があれば互換です。
- 完全名の違うレコード・列挙は、中身が同じでも互換でありません。名前を変えたときは `@aliases` で古い名前を書きます。

### 型を変えるときの目安

「新 → 旧」は新しい型の値を古い型で読めるか、「旧 → 新」はその逆です。

| 変更 | 新 → 旧 | 旧 → 新 | 指紋 |
|---|---|---|---|
| 既定値つきのフィールドを足す | ○ | ○ | 変わる |
| 既定値なしのフィールドを足す | ○ | × | 変わる |
| 既定値つきのフィールドを消す | ○ | ○ | 変わる |
| フィールドの名前を変え、新しい名前の `@aliases` に古い名前を書く | 旧のフィールドに既定値があれば ○ | ○ | 変わる |
| フィールドの型を `int` → `long` | × | ○ | 変わる |
| フィールドの順番を変える | ○ | ○ | 変わる |
| 列挙に記号を足す | 旧に列挙の既定値があれば ○ | ○ | 変わる |
| 既定値・説明だけ変える | ○ | ○ | 変わらない |
| 型の名前空間・名前を変える | `@aliases` があれば ○ | `@aliases` があれば ○ | 変わる |

フィールドを足すときは既定値を付け、列挙には既定値を付けておくと、古い型と新しい型が読み合えます。

## 型を見る

- **CLI**: `juiz type list [--long]` で読み込んだ型の一覧、`juiz type show <完全名か識別子> [--avro|--json-schema]` で型の定義(既定は JIDL の形)を表示します。問い合わせる juiz は `juiz -s http://host:port type list` のように指定します(既定 `http://127.0.0.1:8000`)。
- **管理画面**: 性質欄の引数・戻り値に型の名前が出ます。「呼び出す」から、型に合わせた入力欄(レコードは入れ子の欄、列挙は選択)で呼び出せます(→ [管理画面](/ja/guides/web-ui/))。
- **HTTP API**: `/api/type/list` と `/api/type/schema?identifier=…`。Swagger UI の OpenAPI(`/api-docs/openapi.json`)にも型が入ります。

## 標準の型 juiz_std

:::note[juiz 0.0.24 以降]
`juiz_std`、Rust のクレート `juiz_std_types`、pyjuiz の `juiz_std` パッケージは、0.0.24 から使えます。
:::

よく使う型は、標準の型 `juiz_std` として juiz-idl に組み込んであり、ファイルを用意しなくても `import idl "juiz_std/geometry.jidl";` で使えます。
長さは [m]、角度は [rad]、時間は [s] で、**すべてのフィールドに既定値があります**。名前とフィールドは ROS 2 の `std_msgs`・`geometry_msgs`・`sensor_msgs` に寄せています。

| ファイル | 名前空間 | 型 |
|---|---|---|
| `juiz_std/common.jidl` | `juiz_std.common` | `Time {sec, nanosec}`、`Duration {sec, nanosec}`、`Header {stamp, frame_id}` |
| `juiz_std/geometry.jidl` | `juiz_std.geometry` | `Point2D`、`Point3D`、`Vector2`、`Vector3`、`Quaternion`(既定は回転なし `w = 1`)、`Pose2D {position, theta}`、`Pose {position, orientation}`、`Twist2D {linear, angular}`、`Twist {linear, angular}`、`Pose2DStamped`、`PoseStamped` |
| `juiz_std/sensor.jidl` | `juiz_std.sensor` | `ImageInfo {header, width, height, encoding}`(画素は `image` 型で別に渡す)、`Imu`、`LaserScan`、`Range` |

```text
namespace my_robot;

import idl "juiz_std/geometry.jidl";

record Goal {
  juiz_std.geometry.Pose2D pose = {};
  double tolerance = 0.1;
}
```

| 言語 | 使い方 |
|---|---|
| Rust | クレート [`juiz_std_types`](https://crates.io/crates/juiz_std_types)(`juiz_std_types::geometry::Pose2D`)。自分の JIDL から参照するときは build.rs で `extern_path("juiz_std", "::juiz_std_types::juiz_std")` |
| Python | pyjuiz に入っているパッケージ `juiz_std`(`from juiz_std.geometry import Pose2D`)。自分の JIDL から作るときは `--extern juiz_std` |
| C++ | `juiz_generate_types(<ターゲット> IDL juiz_std/geometry.jidl)` か、自分の JIDL で import する(`juiz_std::geometry::Pose2D`) |
| Haskell | `juiz-idl -g haskell juiz_std/geometry.jidl`(モジュールは `Juiz_std.Geometry`) |
| TypeScript | `juiz-idl -g typescript juiz_std/geometry.jidl` |

標準の型は一度出したら変えません(足すときは既定値つきのフィールドにします)。

## 型パッケージを配る

:::note[juiz 0.0.24 以降]
ここで使う `-I`・`--extern`・`export_idl_dir` は、0.0.24 から使えます。
:::

自分の型をほかの人やリポジトリと共有するときは、JIDL を正本にして、そこから作ったものを各言語のパッケージに入れます。
どの言語でも **.jidl をパッケージに入れて配り**、使う側がそれを import して自分の型のフィールドに使えるようにします。型の同一性は指紋で決まるので、同じ JIDL から作ったものなら、どの言語・どのパッケージのものでも同じ型です。

- **Rust(crates.io)**: `idl/*.jidl` をクレートに入れ、build.rs で `juiz_idl::build::compile` して `src/lib.rs` で `include!`。使う側の build.rs が .jidl を見つけられるように、`Cargo.toml` に `links = "<クレート名>"` を書き、build.rs で `juiz_idl::build::export_idl_dir("idl")` を呼びます。

  ```rust
  // 使う側の build.rs (my_types に直接依存する)
  fn main() {
      juiz_idl::build::configure()
          .import_dir(std::env::var("DEP_MY_TYPES_IDL_DIR").unwrap())
          .extern_path("my_robot", "::my_types::my_robot")
          .compile(&["idl/car.jidl"]) // import idl "my_robot.jidl"; と書ける
          .unwrap();
  }
  ```

- **Python(PyPI)**: `juiz idl -g python -o <パッケージの置き場所> idl/*.jidl` で作ったパッケージをコミットして wheel に入れ、`pyjuiz` を依存に書きます。ほかの型パッケージの型を使うなら `--extern <その名前空間>` を付けて作り、そのパッケージを依存に書きます。名前空間の先頭がそのまま Python のトップレベルのパッケージ名になるので、PyPI のほかのパッケージとぶつからない名前空間にします。
- **C++(CMake)**: .jidl を `share/<パッケージ名>/idl` などに入れて配り、使う側が `juiz_generate_types(<ターゲット> IDL <使う .jidl> IMPORT_DIRS <その idl ディレクトリ>)` でヘッダを作ります(生成したヘッダは配らなくてよい)。
- **Haskell(cabal パッケージ)**: `juiz-idl -g haskell -o src idl/*.jidl` で作ったモジュールをコミットして `exposed-modules` に書き、`hsjuiz` を依存に、.jidl を `extra-source-files` に入れます。hsjuiz はまだ Hackage に公開していないので、いまは型パッケージも git などで配り、使う側の `cabal.project` に書きます。

型を変えるときは [型を変えるときの目安](#型を変えるときの目安) を見てください。既存のフィールドの型・名前・順番を変えると指紋が変わり、古い版とは別の型になります。パッケージの版を上げても、指紋が同じなら同じ型として扱われます。

## 詳しい仕様

細かな決まりは、juiz のリポジトリの [docs/spec/datatype.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/datatype.md) にあります。
