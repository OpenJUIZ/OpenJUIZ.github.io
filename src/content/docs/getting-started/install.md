---
title: Installation
description: Install the juiz command and the packages for writing components in each language.
sidebar:
  order: 1
---

There are two ways to install the `juiz` command. Pick one based on the languages you use.

| Languages | Install with | Rust toolchain |
| --- | --- | --- |
| Python only | `pip install juiz-cli` | Not needed |
| Rust or C++ (Python can be mixed in) | `cargo install juiz_app` | Needed |

## Python only

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
If you also write in Rust or C++, use `cargo install juiz_app` below.
:::

## Rust or C++

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

### C++

The C++ header `juiz/juiz.h` lives in `bindings/cppjuiz/include` of the juiz repository.

## Building from source

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
