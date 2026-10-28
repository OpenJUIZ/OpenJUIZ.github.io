---
title: Data types
description: Give named types to a Process's arguments and return value. Covers the IDL (JIDL) syntax, the generator, the compatibility rules, the standard types juiz_std, and how to distribute type packages.
sidebar:
  order: 8
---

You can give a Process's arguments and return value **named data types** such as `robot.geometry.Pose2D`.
Types are written in the IDL (**JIDL**, extension `.jidl`), and the generator `juiz idl` (also available as the standalone command `juiz-idl`) produces the types for each language.
To try it hands-on, start with [chapter 8 of the tutorial](/tutorial/datatype/).

:::caution[juiz 0.0.23 or later]
Data types are available from juiz 0.0.23. The [standard types juiz_std](#standard-types-juiz_std), import search paths (`-I`), and `--extern` on this page are available from 0.0.24.
:::

## Ideas

- **A type is a contract.** The data that flows over the wire (HTTP, QUIC, and so on) is still a dictionary (a JSON-like value). A type is a promise that "we exchange dictionaries of this shape", and juiz checks it when Processes are connected.
- **Typing is optional.** Untyped Processes and arguments work as before. Typed and untyped Processes can always be connected; types are checked only when both sides are typed. You can write dictionaries while prototyping and add types once the shape settles.
- **The same definition is the same type.** A type's identity is decided by a **fingerprint** computed from its content. Types generated from the same JIDL are treated as the same type, whatever the language or package.
- The type model and the compatibility rules follow [Apache Avro](https://avro.apache.org/) 1.11 schemas. `juiz idl` can also write JIDL out as Avro schemas (`.avsc`).

## Writing JIDL

```text
// geometry.jidl
namespace robot.geometry;

/** A point on a plane */
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

/** Moves to the given pose */
process Pose2D move_to(Pose2D target, double speed = 1.0);

process image capture_gray(image img);

container motor {
  container_process boolean set_mode(MotorMode mode);
  container_process void stop();
}
```

### Declarations

| Declaration | Syntax | Meaning |
|---|---|---|
| Namespace | `namespace robot.geometry;` | Exactly one, at the top of the file (required). The full name of a type becomes `robot.geometry.Pose2D`. `juiz` and everything under it (`juiz.*`) are reserved |
| Import | `import idl "common.jidl";` / `import schema "x.avsc";` | Use the types of another JIDL file or of a hand-written Avro schema |
| Record | `record Name { type name [= default]; … }` | A type made of fields. The order of the fields is part of the type |
| Enum | `enum Name { A, B } [= A];` | Values are symbol strings. `= A` is the enum's default (used when an unknown symbol arrives) |
| Process | `process return_type name(type arg [= default], …);` | A Process signature. Use `void` when there is no return value |
| Container | `container type_name { container_process … ; }` | Signatures of the ContainerProcesses of that Container. The Container's own state is not typed |

- Declarations can come in any order; a type can refer to one declared later. A type that contains itself as a field (directly or indirectly) is not allowed.
- Type names are looked up in the file's namespace first, then as full names. Types in other namespaces are written by full name (`juiz_std.geometry.Pose2D`).
- Comments are `//` and `/* … */`. `/** … */` becomes the description (`doc`) of the declaration, field, or argument that follows, and stays in generated code and in `juiz type show`.
- `@aliases(["old_name"])` gives aliases to a record, enum, or field, so that values with an old name can still be read after a rename. `@namespace("a.b")` changes the namespace of just that type.
- Names that clash with keywords are written in backquotes, like `` `record` ``. Names follow `[A-Za-z_][A-Za-z0-9_]*`.

### Types

| JIDL | Meaning |
|---|---|
| `boolean` | True or false |
| `int` / `long` | 32-bit / 64-bit integer (juiz's default integer is `long`) |
| `float` / `double` | 32-bit / 64-bit floating point number (juiz's default is `double`) |
| `string` | String (UTF-8) |
| `bytes` | Byte string |
| `array<T>` | Array |
| `map<T>` | Dictionary (string keys) |
| `T?` (`union { null, T }`) | Optional. A union can only pair `null` with one type |
| Record or enum name | A type declared with `record` / `enum` |
| `any` | Any value (the same as today's untyped dictionaries). Use it to leave "anything goes here" inside a type |
| `image` | An image. Only allowed as an argument or return type itself (not as a field or element) |
| `null` / `void` | No value. Only allowed as a return type |

Avro's `fixed`, general unions, and logical types (time, decimal, and so on) are not supported.

### Default values

Default values are written as dictionary (JSON) values.

```text
record Robot {
  Pose2D pose = {"position": {"x": 0.0, "y": 0.0}};   // a record is an object
  MotorMode mode = "Idle";                           // an enum is a symbol string
  array<double> joints = [];
  map<string>? tags = null;
  bytes raw = "";                                    // bytes are a base64 string
}
```

**Giving every field a default** makes types easier to use: values can be built even when arguments are left out, and fields added later still let old and new types read each other (→ [Compatibility rules](#compatibility-rules)).

## How values look as dictionaries

Typed values are represented as the following dictionaries on the wire. The CLI, curl, and programs that know nothing about the types can call Processes with dictionaries of this shape.

| Type | Value in a dictionary |
|---|---|
| `boolean`, numbers, `string` | The JSON value as is. `int` and `long` reject out-of-range values and decimal notation such as `1.0` |
| `bytes` | A base64 string |
| `array<T>` / `map<T>` | A JSON array / object |
| `T?` | `null`, or the value of T **as is** (not wrapped as `{"T": value}` like in Avro's JSON encoding) |
| Record | An object keyed by field name |
| Enum | The symbol string |
| `image` | Not in the dictionary; passed as an image, as before |

Rules for reading (when the receiving side reads a dictionary with its type):

- A field missing from the dictionary takes the field's default. If there is no default, it is an error.
- Keys that are not in the type are ignored (so that an old type can read values of a newer type).
- An unknown enum symbol becomes the enum's default. If there is no default, it is an error.

## Type identifiers and fingerprints

- A **fingerprint** is the SHA-256 of the type's Avro schema in Parsing Canonical Form, written as `sha256:` followed by 64 hex digits. It covers the names, types, and order of the fields, the order of enum symbols, the type's full name, and the content of every type it refers to. **Defaults, descriptions, and aliases are not included** (changing them does not change the fingerprint).
- A type's **identifier** is `<full name>@sha256:<64 digits>` (for example `robot.geometry.Pose2D@sha256:1a2b…`). A short form with the first 8 digits (`Pose2D@1a2b3c4d`) is used for display.
- Two types are the same when both the full name and the fingerprint match. The version of a type package (a crate or wheel version) is not part of the identifier.

## Generating: juiz idl

```text
juiz idl [-o out_dir] [-g kind,…] [--check] input.jidl|input.avsc ...
```

- It also reads imported files and writes out the types of every file it read.
- `--check` only checks, without writing, and prints the type identifiers. Errors are printed as `file:line:column: message`.
- Without `-g`, it writes `avsc,json-schema,processes`.

| `-g` | What it writes |
|---|---|
| `avsc` | An Avro schema per named type, `<full name>.avsc` |
| `json-schema` | A JSON Schema (2020-12) of the dictionary shape, `<full name>.schema.json`. Useful for telling programs that do not use juiz about your types |
| `processes` | The signatures from `process` / `container` declarations, `<namespace>.processes.json` |
| `rust` | Structs / enums and their `JuizType` implementations (`<namespace>.rs`, `juiz_idl.rs`). Usually generated from build.rs |
| `rust-skeleton` | A Rust skeleton from `process` / `container` declarations. Generate it once, copy it, and fill in the bodies |
| `python` | Dataclasses / `enum.Enum` and typed clients (namespace `a.b` → `a/b/__init__.py`) |
| `cpp` | Structs / `enum class` and cppjuiz `juiz::type_traits` (`<namespace>.h`, `juiz_idl.h`, header-only) |
| `haskell` | Records, sum types, and hsjuiz instances (namespace `a.b` → module `A.B`) |
| `typescript` | Interfaces, string literal unions, and type references (`<namespace>.ts`, `juiz_idl.ts`, no runtime dependency) |

Per language:

- **Rust**: add `juiz_idl` to `[build-dependencies]`, call `juiz_idl::build::compile(&["idl/geometry.jidl"])` in build.rs, and write `include!(concat!(env!("OUT_DIR"), "/juiz_idl.rs"));` in `src/lib.rs`. The namespace `robot.geometry` becomes the module `robot::geometry`. Writing generated types as arguments and return values of `#[juiz_process]` and friends makes them typed. You can also make a type from a Rust type with `#[derive(JuizType)]` (its fingerprint matches JIDL of the same shape).
- **Python**: put the package generated by `juiz idl -g python -o gen idl/geometry.jidl` on `option.pythonpath` (in the configuration file) or `PYTHONPATH`, and use `from robot.geometry import Pose2D` in type hints. `process move_to` also generates a typed client `MoveToClient`, and `container motor` generates `MotorClient`.
- **C++**: in CMake, `juiz_generate_types(<target> IDL idl/geometry.jidl)` (from juiz's `bindings/cppjuiz/cmake/juiz_idl.cmake`) generates the headers during the build. Write `add_typed_arg<T>(…)` and `returns<T>()` in the manifest.
- **Haskell**: add the modules generated by `juiz-idl -g haskell -o gen idl/geometry.jidl` to cabal's `hs-source-dirs` and `other-modules`, and write `addTypedArg` in the manifest.

Examples for each language are `types/geometry.jidl` and the `pose_move` that uses it in the example repositories ([Rust](https://github.com/OpenJUIZ/juiz_examples_rust), [Python](https://github.com/OpenJUIZ/juiz_examples_python), [C++](https://github.com/OpenJUIZ/juiz_examples_cpp), [Haskell](https://github.com/OpenJUIZ/juiz_examples_haskell)).

### Mapping to languages

| JIDL | Rust | Python | C++ | Haskell | TypeScript |
|---|---|---|---|---|---|
| `boolean` | `bool` | `bool` | `bool` | `Bool` | `boolean` |
| `int` / `long` | `i32` / `i64` | `int` | `int32_t` / `int64_t` | `Int32` / `Int64` | `number` |
| `float` / `double` | `f32` / `f64` | `float` | `float` / `double` | `Float` / `Double` | `number` |
| `string` | `String` | `str` | `std::string` | `Text` | `string` |
| `bytes` | `Vec<u8>` | `bytes` | `std::vector<uint8_t>` | `ByteString` | `string` (base64) |
| `array<T>` | `Vec<T>` | `list[T]` | `std::vector<T>` | `[T]` | `T[]` |
| `map<T>` | `HashMap<String, T>` | `dict[str, T]` | `std::map<std::string, T>` | `Map Text T` | `Record<string, T>` |
| `T?` | `Option<T>` | `T \| None` | `std::optional<T>` | `Maybe T` | `T \| null` |
| Record | struct | dataclass | struct | record | interface |
| Enum | enum | `enum.Enum` | `enum class` | sum type | string literal union |
| `any` | `Value` | `Any` | `juiz::Value` | `Value` | `unknown` |
| `image` | `DynamicImage` | `PIL.Image.Image` | (not yet) | (not yet) | (not supported) |

### Import search paths and types from other packages

:::note[juiz 0.0.24 or later]
Import search paths (`-I`, `JUIZ_IDL_PATH`) and `--extern` are available in `juiz idl` 0.0.24 or later.
:::

`import idl "x/y.jidl";` is looked up in this order:

1. The path relative to the file that has the import
2. `-I <dir>` (`--import-dir`, repeatable; `Builder::import_dir` in build.rs, `juiz_generate_types(… IMPORT_DIRS <dir>)` in CMake), then the directories in the environment variable `JUIZ_IDL_PATH`
3. The standard types built into juiz-idl (`juiz_std/…`)

With `--extern <namespace>[=<Rust path>]` (`Builder::extern_path` in build.rs), the types of that namespace (and the namespaces under it) are not written out; the ones in another package are used instead. Types are still checked as usual.

```sh
# Use the juiz_std types that come with pyjuiz and generate only your own types
juiz idl -g python --extern juiz_std -o gen idl/my_robot.jidl
```

```rust
// build.rs. Use the juiz_std types from the juiz_std_types crate
fn main() {
    juiz_idl::build::configure()
        .extern_path("juiz_std", "::juiz_std_types::juiz_std")
        .compile(&["idl/my_robot.jidl"])
        .unwrap();
}
```

Rust and Python use `--extern` to take types from the type package (so that the same type does not become two different Rust types or Python classes). C++, Haskell, and TypeScript usually generate the imported types too.

## Type checks

| When | What is checked | Default |
|---|---|---|
| When a manifest is made (when a plugin is loaded) | That the defaults of typed arguments match their types | Always |
| When a connection is made (`connections` in a configuration file, `juiz connection create`) | That the source's return type can be read as the destination argument's type. If not, the connection is not made and an error is returned (`TypeIncompatibleError`) | Always |
| When a Process starts to publish / subscribe to a Topic | That its type matches the others connected to the same Topic | Always |
| When a Composite is defined | That children's return types match the parents' argument types (0.0.25 or later, → [Composition](/guides/composition/#type-checks)) | Always |
| On a call (`call`) | That the dictionary passed matches the argument types. If not, the function is not called and an error is returned (`ValueDoesNotMatchTypeError`) | Off |

Turn on checks on calls in the configuration file:

```yaml
option:
  type_check:
    on_call: true
```

Even when it is off, a typed Process reads the dictionary it receives with its type, so a dictionary it cannot read becomes an error of that call. Errors tell where in the type the value does not match (`pose.position.x`, for example).

## Compatibility rules

When connecting, juiz checks **whether a value of the type of the side that produces it (the writer) can be read as the type of the side that receives it (the reader)**. The result is "same", "compatible", or "incompatible"; if incompatible, the connection is not made. If either side is untyped, juiz connects without checking.
The rules follow Avro's schema resolution, changed only where they do not hold for the dictionary representation.

- `any` is compatible with everything (except `image`). `image` is compatible only with `image` and `any`.
- Numbers are compatible towards wider types (`int` → `long` / `float` / `double`, `long` → `float` / `double`, `float` → `double`). The reverse is incompatible.
- `string` and `bytes` are incompatible (in dictionaries `bytes` are base64 strings, so they would be misread).
- Arrays and maps are compatible when their elements are compatible.
- `T` → `U?` is compatible, `T?` → `U?` is compatible, and **`T?` → `U` is incompatible** (a `null` could not be read).
- Records are compatible when the full names are the same (or the writer's name is in the reader's `@aliases`), and each reader field either has a writer field of the same name (or alias) with a compatible type, or has a default. Fields only in the writer are ignored.
- Enums are compatible when the full names are the same (or aliased), and either every writer symbol is in the reader or the reader has an enum default.
- Records and enums with different full names are incompatible even if their content is the same. When you rename a type, list the old name in `@aliases`.

### Guidelines for changing types

"New → old" is whether a value of the new type can be read as the old type; "old → new" is the reverse.

| Change | New → old | Old → new | Fingerprint |
|---|---|---|---|
| Add a field with a default | ○ | ○ | changes |
| Add a field without a default | ○ | × | changes |
| Remove a field that has a default | ○ | ○ | changes |
| Rename a field and list the old name in the new name's `@aliases` | ○ if the old field has a default | ○ | changes |
| Change a field's type from `int` to `long` | × | ○ | changes |
| Reorder fields | ○ | ○ | changes |
| Add a symbol to an enum | ○ if the old enum has a default | ○ | changes |
| Change only defaults or descriptions | ○ | ○ | unchanged |
| Change the type's namespace or name | ○ with `@aliases` | ○ with `@aliases` | changes |

Give new fields a default, and give enums a default, so that old and new types can read each other.

## Looking at types

- **CLI**: `juiz type list [--long]` lists the loaded types, and `juiz type show <full name or identifier> [--avro|--json-schema]` prints a type's definition (as JIDL by default). Choose the juiz to ask with `juiz -s http://host:port type list` (default `http://127.0.0.1:8000`).
- **Web UI**: the names of the types appear in the arguments and outputs of a Process's properties. "Call" lets you call it with input fields that follow the types (nested fields for records, a selection for enums) (→ [Web UI](/guides/web-ui/)).
- **HTTP API**: `/api/type/list` and `/api/type/schema?identifier=…`. The types also appear in the OpenAPI document of Swagger UI (`/api-docs/openapi.json`).

## Standard types juiz_std

:::note[juiz 0.0.24 or later]
`juiz_std`, the Rust crate `juiz_std_types`, and the `juiz_std` package in pyjuiz are available from 0.0.24.
:::

Commonly used types are built into juiz-idl as the standard types `juiz_std`. You can use them with `import idl "juiz_std/geometry.jidl";` without any file of your own.
Lengths are in [m], angles in [rad], and times in [s], and **every field has a default**. The names and fields follow ROS 2's `std_msgs`, `geometry_msgs`, and `sensor_msgs`.

| File | Namespace | Types |
|---|---|---|
| `juiz_std/common.jidl` | `juiz_std.common` | `Time {sec, nanosec}`, `Duration {sec, nanosec}`, `Header {stamp, frame_id}` |
| `juiz_std/geometry.jidl` | `juiz_std.geometry` | `Point2D`, `Point3D`, `Vector2`, `Vector3`, `Quaternion` (defaults to no rotation, `w = 1`), `Pose2D {position, theta}`, `Pose {position, orientation}`, `Twist2D {linear, angular}`, `Twist {linear, angular}`, `Pose2DStamped`, `PoseStamped` |
| `juiz_std/sensor.jidl` | `juiz_std.sensor` | `ImageInfo {header, width, height, encoding}` (pixels are passed separately as `image`), `Imu`, `LaserScan`, `Range` |

```text
namespace my_robot;

import idl "juiz_std/geometry.jidl";

record Goal {
  juiz_std.geometry.Pose2D pose = {};
  double tolerance = 0.1;
}
```

| Language | How to use |
|---|---|
| Rust | The crate [`juiz_std_types`](https://crates.io/crates/juiz_std_types) (`juiz_std_types::geometry::Pose2D`). To refer to it from your own JIDL, use `extern_path("juiz_std", "::juiz_std_types::juiz_std")` in build.rs |
| Python | The `juiz_std` package that comes with pyjuiz (`from juiz_std.geometry import Pose2D`). When generating from your own JIDL, add `--extern juiz_std` |
| C++ | `juiz_generate_types(<target> IDL juiz_std/geometry.jidl)`, or import it from your own JIDL (`juiz_std::geometry::Pose2D`) |
| Haskell | `juiz-idl -g haskell juiz_std/geometry.jidl` (the module is `Juiz_std.Geometry`) |
| TypeScript | `juiz-idl -g typescript juiz_std/geometry.jidl` |

Once released, the standard types do not change (new fields are added only with defaults).

## Distributing type packages

:::note[juiz 0.0.24 or later]
`-I`, `--extern`, and `export_idl_dir` used here are available from 0.0.24.
:::

To share your types with other people or repositories, keep the JIDL as the source of truth and put what you generate from it into a package for each language.
In every language, **ship the .jidl in the package** so that users can import it and use your types in fields of their own types. Since a type's identity is its fingerprint, things generated from the same JIDL are the same type whichever language or package they come from.

- **Rust (crates.io)**: put `idl/*.jidl` in the crate, call `juiz_idl::build::compile` in build.rs, and `include!` it in `src/lib.rs`. So that users' build.rs can find the .jidl, write `links = "<crate name>"` in `Cargo.toml` and call `juiz_idl::build::export_idl_dir("idl")` in build.rs.

  ```rust
  // build.rs of a crate that uses it (depends directly on my_types)
  fn main() {
      juiz_idl::build::configure()
          .import_dir(std::env::var("DEP_MY_TYPES_IDL_DIR").unwrap())
          .extern_path("my_robot", "::my_types::my_robot")
          .compile(&["idl/car.jidl"]) // can write import idl "my_robot.jidl";
          .unwrap();
  }
  ```

- **Python (PyPI)**: commit the package generated by `juiz idl -g python -o <package location> idl/*.jidl`, include it in the wheel, and depend on `pyjuiz`. If your types use types from another type package, generate with `--extern <that namespace>` and depend on that package. The first element of the namespace becomes the top-level Python package name, so pick a namespace that does not clash with other packages on PyPI.
- **C++ (CMake)**: ship the .jidl in `share/<package name>/idl` or similar; users generate headers with `juiz_generate_types(<target> IDL <the .jidl to use> IMPORT_DIRS <that idl directory>)` (no need to ship generated headers).
- **Haskell (Hackage)**: commit the modules generated by `juiz-idl -g haskell -o src idl/*.jidl`, list them in `exposed-modules`, depend on `hsjuiz`, and put the .jidl in `extra-source-files`.

When you change types, see [Guidelines for changing types](#guidelines-for-changing-types). Changing the type, name, or order of an existing field changes the fingerprint, making it a different type from the old version. Bumping the package version does not matter: types with the same fingerprint are treated as the same type.

## Detailed specification

The details are in [docs/spec/datatype.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/datatype.md) in the juiz repository (in Japanese).
