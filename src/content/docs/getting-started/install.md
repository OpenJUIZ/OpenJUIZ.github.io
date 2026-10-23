---
title: Installation
description: Install the juiz command and the packages for writing components in each language.
sidebar:
  order: 1
---

There are two ways to install the `juiz` command. Pick one based on the languages you use.

| Languages | Install with | Rust toolchain |
| --- | --- | --- |
| Python, C++, Haskell | `pip install juiz-cli` | Not needed |
| Rust (Python, C++ and Haskell can be mixed in) | `cargo install juiz_app` | Needed |

C++ and Haskell components work with either `juiz`. Install libjuiz_sdk of the same version as `juiz` (see [Language packages](#language-packages)).

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
juiz_sdk = "0.0.17"
```

### Python

Write components with the decorators in [pyjuiz](https://pypi.org/project/pyjuiz/) (`from juiz import juiz_process` and so on). pyjuiz comes with `juiz-cli`. With `cargo install juiz_app`, install only pyjuiz as shown above.

### C++ and Haskell: libjuiz_sdk

C++ and Haskell components link to libjuiz_sdk, the shared library of C functions that pass values to and from juiz.
[GitHub Releases](https://github.com/OpenJUIZ/juiz/releases) has an archive with the library and the headers for each OS and CPU
(Linux x86_64 and aarch64, macOS arm64 and x86_64). Install the **same version** as `juiz`.

```sh
juiz --version      # e.g. juiz 0.0.21
curl -fsSL https://raw.githubusercontent.com/OpenJUIZ/juiz/main/scripts/install-juiz-sdk.sh | sh -s -- 0.0.21
```

It is extracted to `~/.juiz/sdk/0.0.21`. `juiz` stops with an error when it loads a component built with a different version of libjuiz_sdk.

### C++

The C++ header `juiz/juiz.h` is in `cppjuiz/include` of the extracted directory (the same as `bindings/cppjuiz/include` in the juiz repository).
Add `cjuiz/include` and `cppjuiz/include` to the include path and link to libjuiz_sdk in `lib`. pkg-config also works.

```sh
export PKG_CONFIG_PATH=$HOME/.juiz/sdk/0.0.21/lib/pkgconfig
pkg-config --cflags --libs juiz_sdk
```

### Haskell

Write components with [hsjuiz](https://hackage.haskell.org/package/hsjuiz) on Hackage. You need GHC 9.6 or later and cabal (Linux, macOS).
Tell hsjuiz where libjuiz_sdk is in the `cabal.project` of your package.

```txt
packages: .

package hsjuiz
  extra-lib-dirs: /home/me/.juiz/sdk/0.0.21/lib
  ghc-options: -optl-Wl,-rpath,/home/me/.juiz/sdk/0.0.21/lib
```

See the [hsjuiz README](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz) for how to write them.

## Building from source

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
