---
title: Distributing apps (.juizapp)
description: Bundle a configuration file and its plugins into a single .juizapp file and start it with juiz run. You can also ship a resident base package and the apps that use it separately.
sidebar:
  order: 10
---

You can bundle a configuration file and the plugins it loads (shared libraries written in Rust, C++ or Haskell, and Python `.py` files) into a single `.juizapp` file.
The receiver can start it with nothing but `juiz run`, without the sources or any build tools.

```sh
juiz run talker_listener-0.1.0.juizapp
```

:::caution[Requires juiz 0.0.28 or later]
`juiz pack`, `juiz run` and `juiz install` are available from juiz 0.0.28.
:::

## Layout

A `.juizapp` is a zip file with the manifest `juizapp.yaml` at its root. The other names are conventions; files can be anywhere as long as the configuration file refers to them.

```text
talker_listener-0.1.0.juizapp   (zip)
├─ juizapp.yaml                 manifest (at the root)
├─ app.conf                     configuration file to start (default entry)
├─ plugins/
│  ├─ x86_64-unknown-linux-gnu/  native plugins per target
│  │  ├─ libtalker.so
│  │  └─ libjuiz_sdk.so         for C++ / Haskell
│  └─ aarch64-apple-darwin/
│     └─ libtalker.dylib
└─ python/                      OS-independent .py files
   └─ listener.py
```

Native plugins go in `plugins/<target>/`. Target names are Rust target triples (`x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `x86_64-apple-darwin`, `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`).

## `{target}` in configuration files

`{target}` in a plugin `path` under `plugins` is replaced with the target name of the machine juiz runs on.

```yaml
plugins:
  process_factories:
    talker:
      path: "plugins/{target}"     # plugins/x86_64-unknown-linux-gnu on Linux x86_64
    listener_python:
      language: python
      path: "./python"
```

The replacement also happens with `juiz -f app.conf` outside a package, so the configuration file you develop with is the one you ship.
Relative paths are resolved from the directory of the configuration file for every kind of plugin (including broker and EC plugins).

## The manifest juizapp.yaml

You write the fields below. `juiz pack` adds the rest (`languages`, `targets`, the SHA-256 of each file, and so on).

```yaml
format: 1
name: talker_listener          # lowercase letters, digits, _ and -, up to 64 characters
version: 0.1.0                 # semver
kind: app                      # app (default) or base
description: "Connects talker and listener with Push"
license: MIT OR Apache-2.0
entry: app.conf                # configuration file juiz run starts (default app.conf)
depends:                       # base packages this app uses, with version ranges (see below)
  robot_base: ">=1.2, <2"
python:
  version: ">=3.10"
  requires: ["numpy>=1.26"]
exclude: ["*.log", "scratch/**"]
```

| Field | Meaning |
| --- | --- |
| `juiz` | Range of juiz versions that can run the package (for example `>=0.0.28`). If omitted, pack writes `>=<version of juiz that packed it>`. With Rust plugins it is fixed to `=<juiz_sdk version>` |
| `base.http_port` | For `kind: base`, the fixed port of the HTTP broker |
| `exclude` | Globs of files pack leaves out |

## Build: juiz pack

```sh
juiz pack <dir> [-o <output>] [--target <target>]...
```

pack reads `juizapp.yaml` in the directory, collects the files under it and writes `<name>-<version>.juizapp`. With exactly one `--target`, the file is named `<name>-<version>-<target>.juizapp` and the `plugins/` of other targets are left out.

Before writing the zip, pack checks the following and stops with an error without writing anything if one fails.

- The entry configuration file can be read, and every plugin `path` points inside the package.
- Every native plugin `path` contains `{target}`, and each target under `plugins/` has the plugin file.
- All Rust plugins were built with the same juiz_sdk and rustc (pack reads the build info from the files and writes it to the manifest).

Names starting with `.` (`.git`, `.venv`), `target/`, `build/`, `dist-newstyle/` and `__pycache__/` are not included. The zip is written so that the same input gives the same bytes, so rebuilding in CI does not change the file.

## Run: juiz run

```sh
juiz run <file.juizapp | name[@version]> [--entry <conf>] [--depend <name>=<URL>]... [-b] [--ipc <name>] [--namespace <ns>]
```

Given a file, juiz run checks the manifest, the SHA-256 of each file, the juiz version, the target and (for Rust) the rustc, then extracts the package into a cache (`~/.cache/juiz/apps/`) and starts it. If anything does not match, it stops with a clear message before loading any plugin.

```sh
juiz run talker_listener-0.1.0-x86_64-unknown-linux-gnu.juizapp
# talker: Hello World
# listener: Hello World
```

Absolute paths, `..`, symbolic links, zip bombs and similar entries are rejected before extraction.

## Install: juiz install

Install packages you use often, then start them by name.

```sh
juiz install chatter_base-0.1.0.juizapp
juiz packages
# NAME              VERSION  KIND
# chatter_base      0.1.0    base
juiz run chatter_base             # newest version; chatter_base@0.1.0 picks a version
juiz uninstall chatter_base@0.1.0
```

Packages are installed in `~/.local/share/juiz/packages/<name>/<version>/` (change it with `JUIZ_DATA_DIR` or `XDG_DATA_HOME`).

## Base packages and apps

Ship what stays resident, such as a robot driver, as a **base package** (`kind: base`), and what uses it as an **app**. They run in separate processes, so their juiz versions and languages can differ.

### Base

```yaml
# juizapp.yaml
name: chatter_base
version: 0.1.0
kind: base
base:
  http_port: 8100
```

`juiz run chatter_base` starts an IPC broker named after the package (`ipc://chatter_base`), plus an HTTP broker on `base.http_port` if it is set.
The system profile carries `package: {name, version, kind}`, which apps use to check what they connected to. An IPC name is unique on a machine, so only one instance of a base runs per machine.

### App

```yaml
# juizapp.yaml
name: chatter_listener
version: 0.1.0
depends:
  chatter_base: ">=0.1, <0.2"
```

`juiz run chatter_listener` connects to each base in `depends` as a subsystem and checks that the name and version in its profile match before starting. Once connected, the app's configuration file can receive Topics the base publishes with `subscribes`, as if they were local (the base's Processes can also be called by ID).

Where to connect is decided in this order.

1. `--depend chatter_base=http://192.168.0.10:8100` on the command line (`ipc://<name>` also works)
2. An entry in the app configuration file's `subsystems` that has `package: chatter_base`
3. Default: `ipc://chatter_base` (a base on the same machine)

```yaml
# Configuration file that uses a base on another machine
subsystems:
  - package: chatter_base
    type_name: http
    name: "192.168.0.10"      # without a port, base.http_port of the installed chatter_base is used
```

If the base is not running, juiz run tells you what to do and stops (it does not start the base for you).

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but chatter_base is not running at ipc://chatter_base. Start it first with: juiz run chatter_base
```

If Process names in the base and the app collide, put them in different [namespaces](/guides/namespace/).

## Notes per language

| Language | What goes in the package | What the receiver needs |
| --- | --- | --- |
| Python | `.py` files | juiz with embedded Python (juiz-cli from pip) and the packages in `python.requires` |
| Rust | so / dylib / dll in `plugins/<target>/` | juiz built with the same juiz_sdk version and **the same rustc** |
| C++ | plugins and libjuiz_sdk | a matching version of juiz |
| Haskell | plugins, libjuiz_sdk, GHC shared libraries, libffi and libgmp | a matching version of juiz |

- **Python**: with no native plugins, one file runs on every OS (`targets: [any]`). This is the easiest way to ship to many people.
- **Rust**: Rust plugins load only when both the juiz_sdk version and the rustc version match. `juiz run` checks this before starting and, if they differ, stops and shows which rustc built the plugins.
- **C++**: in CMake, call `juiz_sdk_bundle(<target>)` after `find_package(juiz_sdk)`. The plugin's RPATH becomes only its own directory (`$ORIGIN` / `@loader_path`) and libjuiz_sdk is copied next to it. Put the contents of that directory in `plugins/<target>/`. On Windows, juiz looks for DLLs next to the plugin.
- **Haskell**: juiz's `scripts/bundle-plugin-deps.sh <plugin> <out-dir>` gathers the plugin and the libraries it uses into one directory and rewrites them to look next to themselves (patchelf on Linux, install_name_tool and codesign on macOS). The receiver does not need GHC.

C++ and Haskell builds for Linux do not run where glibc is older than on the build machine, so build on an older system (such as Ubuntu 22.04) to reach more machines.
`juiz pack` warns when a plugin for the current target uses libraries other than the files next to it and the OS base libraries.

## Examples

The four example repositories have `packages/` and `scripts/make_packages.py`, which copies the build results and runs `juiz pack`. When a tag is pushed, CI attaches the `.juizapp` files to Releases.

- [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python): `talker_listener`, and the base/app pair `chatter_base` / `chatter_listener`
- [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust), [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp): `talker_listener` (one file per target)

```sh
# in juiz_examples_python
python scripts/make_packages.py
juiz install dist/chatter_base-0.1.0.juizapp
juiz install dist/chatter_listener-0.1.0.juizapp
juiz run chatter_base              # terminal 1
juiz run chatter_listener          # terminal 2
# listener_python receives "Hello from chatter_base"
```

The full format is specified in [docs/spec/app-package.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/app-package.md) in the juiz repository.
