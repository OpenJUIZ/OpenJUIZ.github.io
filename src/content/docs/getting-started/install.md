---
title: Installation
description: Install the juiz command and the packages for writing components in each language.
sidebar:
  order: 1
---

There are two ways to install the `juiz` command. Pick one based on the languages you use.

| Languages | Install with | Rust toolchain |
| --- | --- | --- |
| Python, C++, Haskell | `pip install juiz-cli` | Not needed (for now, C++ and Haskell need it to build libjuiz_sdk) |
| Rust (Python, C++ and Haskell can be mixed in) | `cargo install juiz_app` | Needed |

C++ and Haskell components work with either `juiz`. Prepare libjuiz_sdk of the same version as `juiz` (see [Language packages](#language-packages)).

## Installing with pip

Installing [juiz-cli](https://pypi.org/project/juiz-cli/) from PyPI gives you both the `juiz` command and [pyjuiz](https://pypi.org/project/pyjuiz/) (`import juiz`), the package you write Processes with. No Rust toolchain is needed.

Requirements:

- Python 3.10 or later
- Linux (x86_64, aarch64), macOS (Apple silicon, Intel), or Windows (x86_64)

```sh
python3 -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install juiz-cli
juiz --help
```

The `juiz` command is installed into the venv. Run `juiz` from a terminal where this venv is activated.

:::caution
The `juiz` installed with pip is built by the juiz CI. It cannot load Rust plugins you build yourself (Processes written in Rust, the QUIC broker, and so on), because the compiler versions do not match.
If you also write in Rust, use `cargo install juiz_app` below. C++ and Haskell plugins can be loaded.
:::

## Installing with cargo

Requirements:

- Linux or macOS
- Rust 1.81 or later (install with [rustup](https://rustup.rs/))
- For C++ components: CMake and a C++17 compiler
- For Python components as well: Python 3 with development headers (`sudo apt install python3-dev python3-venv` on Ubuntu)

Install `juiz_app` from crates.io.

```sh
cargo install juiz_app
```

The `juiz` command is installed into `~/.cargo/bin`.

### Using Python Processes too

To run Python Processes with this `juiz`, add **only** [pyjuiz](https://pypi.org/project/pyjuiz/) from PyPI.
The `juiz` command embeds the Python it found at build time, so create the venv with that same Python.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install pyjuiz
```

:::caution
Do not install `juiz-cli` into this venv. You would end up with two `juiz` commands, and which one runs would depend on the order of your PATH.
:::

## Language packages

### Rust

Write components with the [juiz_sdk](https://crates.io/crates/juiz_sdk) crate, built as a shared library.
Use the same juiz_sdk version as the `juiz` you installed with `cargo install juiz_app`. A plugin built with a different version stops with an error when it is loaded.

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "0.0.26"
```

### Python

Write components with the decorators in [pyjuiz](https://pypi.org/project/pyjuiz/) (`from juiz import juiz_process` and so on). pyjuiz comes with `juiz-cli`. With `cargo install juiz_app`, install only pyjuiz as shown above.

### C++ and Haskell: libjuiz_sdk

C++ and Haskell components link to libjuiz_sdk, the shared library of C functions that pass values to and from juiz.
From 0.0.26, archives of libjuiz_sdk with the headers for each OS and CPU (Linux x86_64 and aarch64, macOS arm64 and x86_64) are on [GitHub Releases](https://github.com/OpenJUIZ/juiz/releases).
Get the **same version** as `juiz` with `install-juiz-sdk.sh`; it is extracted to `~/.juiz/sdk/<version>`.

```sh
juiz --version      # e.g. juiz 0.0.26
curl -fsSL https://raw.githubusercontent.com/OpenJUIZ/juiz/main/scripts/install-juiz-sdk.sh | sh -s -- 0.0.26
# => ~/.juiz/sdk/0.0.26/lib/libjuiz_sdk.so (.dylib on macOS)
#    ~/.juiz/sdk/0.0.26/cjuiz/include, ~/.juiz/sdk/0.0.26/cppjuiz/include
```

juiz refuses to load a plugin built with a different version of libjuiz_sdk.
On platforms without an archive, or for 0.0.25 and earlier, get the juiz source at the tag of the same version and use the libjuiz_sdk in `target/release` built by `cargo build --release -p juiz_sdk` (the headers are in `bindings/cjuiz/include` and `bindings/cppjuiz/include` of the source).

### C++

The CMake file of the [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp) examples ([cmake/Juiz.cmake](https://github.com/OpenJUIZ/juiz_examples_cpp/blob/main/cmake/Juiz.cmake)) fetches and builds libjuiz_sdk automatically. Using this file is also the quickest way for your own project.
To set it up by hand, add `cjuiz/include` and `cppjuiz/include` of the archive to the include path and link to libjuiz_sdk in `lib` (there is also `lib/pkgconfig/juiz_sdk.pc` for pkg-config).

### Haskell

Write components with [hsjuiz](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz). You need GHC 9.4.7 or later and cabal (Linux, macOS).
hsjuiz is waiting to be published on Hackage, so for now get the juiz source at the tag of the same version as `juiz` and use its `bindings/hsjuiz`. In the `cabal.project` of your package, write where the hsjuiz source and libjuiz_sdk are.

```sh
git clone --depth 1 --branch v0.0.26 https://github.com/OpenJUIZ/juiz.git ~/juiz-0.0.26
```

```txt
packages: . /home/me/juiz-0.0.26/bindings/hsjuiz

package hsjuiz
  extra-lib-dirs: /home/me/.juiz/sdk/0.0.26/lib
  ghc-options: -optl-Wl,-rpath,/home/me/.juiz/sdk/0.0.26/lib
```

The rpath is needed because GHC loads libjuiz_sdk together with hsjuiz when it runs Template Haskell.
The `build.sh` of the [juiz_examples_haskell](https://github.com/OpenJUIZ/juiz_examples_haskell) examples does everything from getting libjuiz_sdk and hsjuiz to building the examples, so you can also use it as a template.

See the [hsjuiz README](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz) for how to write them.

:::note
hsjuiz is waiting to be published on Hackage. Once it is, you will be able to install it from Hackage without listing the hsjuiz source in `cabal.project`.
:::

## Building from source

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
