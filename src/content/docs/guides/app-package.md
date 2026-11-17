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
[Checks and choices at startup](#checks-and-choices-at-startup) and [Starting by double-click](#starting-by-double-click) are available from juiz 0.3.0.
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
| `juiz` | Range of juiz versions that can run the package (for example `>=0.0.30`). If omitted, pack writes `>=<version of juiz that packed it>`. Only with old-style Rust plugins (see below) it is fixed to `=<juiz_sdk version>` |
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
- All Rust plugins were built with the same juiz_sdk (pack reads the build info from the files and writes it to the manifest). Old-style Rust plugins must also share the same rustc.

Names starting with `.` (`.git`, `.venv`), `target/`, `build/`, `dist-newstyle/` and `__pycache__/` are not included. The zip is written so that the same input gives the same bytes, so rebuilding in CI does not change the file.

## Run: juiz run

```sh
juiz run <file.juizapp | name[@version]> [--entry <conf>] [--depend <name>=<URL>]... [--http] [--no-http] [--http-port <n>] [--ipc <name>] [--namespace <ns>] [--yes] [--no-prompt] [--forget-depends]
```

Given a file, juiz run checks the manifest, the SHA-256 of each file, the juiz version, the target and (for Rust) the plugin ABI version, then extracts the package into a cache (`~/.cache/juiz/apps/`) and starts it. If anything does not match, it stops with a clear message before loading any plugin.

```sh
juiz run talker_listener-0.1.0-x86_64-unknown-linux-gnu.juizapp
# talker: Hello World
# listener: Hello World
```

Absolute paths, `..`, symbolic links, zip bombs and similar entries are rejected before extraction.

Once started, juiz run prints where each broker it started listens, one per line (from juiz 0.3.0). If a port was changed, this is where you see the actual number.

```text
HTTP broker: http://127.0.0.1:8081/ (web UI: /ui)
IPC broker: ipc://chatter_base
```

| Option | Meaning |
| --- | --- |
| `--http-port <n>` | Use port `<n>` for the HTTP broker (wins over `option.http_broker.port` in the configuration file; does not change whether it starts). From 0.3.0 |
| `--yes` / `-y` | Do not ask; take the recommended choice ([Checks and choices at startup](#checks-and-choices-at-startup)). From 0.3.0 |
| `--no-prompt` | Do not ask; behave as when not started from a terminal. Wins over `--yes`. From 0.3.0 |
| `--forget-depends` | Forget this app's [remembered connections](#remembered-connections) before starting. From 0.3.0 |
| `--no-port-fallback` / `--no-adopt-master` | Turn off what happens [when a port is in use](/guides/config/#when-a-port-is-in-use). From 0.3.0 |

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
The system profile carries `package: {name, version, kind}`, which apps use to check what they connected to. An IPC name is unique on a machine, so only one instance of a base runs per machine. Starting a base that is already running stops with `chatter_base is already running at ipc://chatter_base.` (from juiz 0.3.0).

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

If the base is not running and juiz run was not started from a terminal, it tells you what to do and stops (it never starts the base on its own).

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but chatter_base is not running at ipc://chatter_base. Start it first with: juiz run chatter_base
```

From juiz 0.3.0, when started from a terminal, you can start the base or pick another place to connect to right there ([When the base cannot be reached](#when-the-base-cannot-be-reached)).

If Process names in the base and the app collide, put them in different [namespaces](/guides/namespace/).

## Checks and choices at startup

:::note[Available from juiz 0.3.0]
:::

When a port is in use or a base cannot be found, `juiz run` lets you choose what to do on the spot.
The choices appear numbered in the terminal it was started from. Type a number and press Enter, or just press Enter for the recommended choice in `[ ]`.

Choices appear only when both standard input and standard error are terminals, and neither `--yes` nor `--no-prompt` is given. When started from CI or a script, juiz run does not ask, and does what each section below lists for "when it cannot ask".

- `--yes` (`-y`): do not ask, and take the recommended choice. If a port is in use, start on a free one. It never starts a base on its own.
- `--no-prompt`: do not ask, and behave as when it cannot ask.

`juiz -f <conf>` never asks. When you run a configuration file directly, decide with the settings in [When a port is in use](/guides/config/#when-a-port-is-in-use).

### When a port is in use

Before starting, `juiz run` tries the ports of the brokers it will start (HTTP and qmp). If one is in use, it checks whether the program on it is a juiz, and asks.

```text
port 8000 is in use by another juiz (talker_listener 0.1.0).
  1) start on port 8001 (free)
  2) enter a port number
  3) quit
choose [1]:
```

| On the port | App (`kind: app`) | Base (`kind: base`) |
| --- | --- | --- |
| A juiz of the same package | 1) start another one on a free port / 2) open the running one's web UI in a browser / 3) quit | Stops with `chatter_base is already running at http://127.0.0.1:8100/` |
| Another juiz, or not a juiz | 1) start on a free port / 2) enter a port number / 3) quit | 1) start on a free port / 2) quit |
| When it cannot ask | Starts on a free port and prints `warning: port 8000 is in use; the HTTP broker uses 8001` | Stops with an error |

- The "free port" is the first one that can be taken counting up from the original number (up to the original + 100).
- If a base moves to another port, apps that connect over HTTP look for `base.http_port` and will not find it. juiz run says so before asking.
- For an app, when the program on the port is a juiz, choice 1) may carry `(join it as its subsystem)`. Picking it connects the app to that juiz as its subsystem (apps that depend on a base never do this; see [When a port is in use](/guides/config/#when-a-port-is-in-use)).
- The chosen port is used only this time and is not remembered. To always use the same one, set it with `--http-port <n>` or `option.http_broker.port` in the configuration file.

When the port of a base is in use and juiz run cannot ask, it stops like this.

```text
port 8100 for chatter_base is in use by another program. Free the port, or start it with --http-port <n>.
```

### When the base cannot be reached

When a base in the app's `depends` cannot be reached (not running, wrong version, or something else is there), juiz run asks.

```text
chatter_listener depends on chatter_base >=0.1, <0.2, but it is not running at ipc://chatter_base.
  1) start chatter_base 0.1.0 now
  2) choose a running chatter_base
  3) enter where chatter_base is (ex., http://192.168.0.10:8100)
  4) retry
  5) quit
choose [1]:
```

| Choice | What happens |
| --- | --- |
| 1) Start it now | Shown only when a version in range is installed. Starts the base **in another window** and waits up to 10 seconds for it before going on. Stopping the app does not stop the base |
| 2) Choose a running one | Shown only when bases with the right name and version run over IPC on this machine (such as `ipc://chatter_base2`) |
| 3) Enter where it is | Type a URL in the same form as `--depend`. Without a port, as in `http://192.168.0.10`, `base.http_port` is filled in |
| 4) Retry | Pick this after starting the base yourself |
| 5) Quit | Ends without doing anything |

- The "other window" for 1) is a new console on Windows, Terminal on macOS, and on Linux the first terminal emulator found (`$TERMINAL`, `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xterm`). With no display or no terminal found, the base is started detached from the terminal, its output goes to `~/.cache/juiz/logs/chatter_base.log`, and juiz run prints that path.
- With several dependencies, juiz run asks about them one at a time.
- When it cannot ask, or with `--yes`, it tells you what to do and stops [as before](#app).

### Remembered connections

When choice 2) or 3) connects, juiz run remembers where, and connects there from then on.

```text
using chatter_base at http://192.168.0.10:8100 (remembered; --forget-depends to reset)
```

Where to connect is then decided in this order.

1. `--depend` on the command line
2. The remembered connection
3. An entry in the app configuration file's `subsystems` that has `package:`
4. Default: `ipc://<name of the base>`

If the remembered place cannot be reached, juiz run asks again. To forget it, start with `--forget-depends`.

```sh
juiz run chatter_listener --forget-depends
# forgot the remembered connections of chatter_listener
```

Remembered connections are written per app to `~/.local/share/juiz/depends.yaml` (you may edit it by hand). They do not apply to other apps that use the same base.

```yaml
chatter_listener:
  chatter_base: "http://192.168.0.10:8100"
```

## Starting by double-click

:::note[Available from juiz 0.3.0]
:::

Run `juiz associate` once, and `.juizapp` files start with a double-click. It needs no administrator rights and applies only to the user who ran it.

```sh
juiz associate            # associate .juizapp with this juiz
juiz associate --remove   # remove the association
```

- Run it inside a venv, and files start with that venv's juiz (with that venv's Python and packages). To switch to the juiz of another venv, run it again in that venv. The path of the juiz registered before is printed.
- A double-click runs `juiz run` in a new terminal window. The window title becomes `juiz - <name> <version>`, and `Close this window or press Ctrl+C to stop.` is printed. To stop, close the window or press Ctrl+C.
- If it stops with an error, `Press Enter to close.` is printed and the window stays. Read the error, then press Enter to close it.
- [Checks and choices at startup](#checks-and-choices-at-startup) appear in this window.

### Differences between OSes

| OS | What is written | Install |
| --- | --- | --- |
| Windows | Registry (`.juizapp` and `JUIZ.App` under HKEY_CURRENT_USER, Software\Classes) | "Install with juiz" in the right-click menu |
| macOS | `~/Applications/JUIZ Launcher.app` | (no menu; use `juiz install`) |
| Linux | Under mime and applications in `~/.local/share`, and `~/.config/mimeapps.list` | "Install with juiz" under "Open With" in the right-click menu |

- **Windows**: closing the console window with × still finishes cleaning up (such as leaving the other Systems) before stopping.
- **macOS**: the first double-click asks whether JUIZ Launcher may control Terminal. Allow it. JUIZ Launcher is built on your own machine, so Gatekeeper does not block it.
- **Linux**: whether a terminal window opens depends on the desktop environment. If commands such as `update-mime-database` are missing, a warning is printed, but the association is still written. Closing the terminal (SIGHUP) stops juiz with the same cleanup as Ctrl+C.

## Notes per language

| Language | What goes in the package | What the receiver needs |
| --- | --- | --- |
| Python | `.py` files | juiz with embedded Python (juiz-cli from pip) and the packages in `python.requires` |
| Rust | so / dylib / dll in `plugins/<target>/` | a matching version of juiz (the rustc does not have to match) |
| C++ | plugins and libjuiz_sdk | a matching version of juiz |
| Haskell | plugins, libjuiz_sdk, GHC shared libraries, libffi and libgmp | a matching version of juiz |

- **Python**: with no native plugins, one file runs on every OS (`targets: [any]`). This is the easiest way to ship to many people.
- **Rust**: since juiz 0.0.30, Rust Process, Container and Component plugins are loaded through a C function boundary (the plugin C ABI), so they work even when the receiver's juiz was built with another rustc. They also work with juiz installed by pip. `juiz pack` writes `rust.abi` (the ABI version) to the manifest and `juiz run` checks it before starting.
  - Plugins built with juiz_sdk 0.0.29 or earlier, and execution context (EC) and broker plugins, still use the old style (the Rust ABI). Packages containing them run only on juiz built with the same juiz_sdk version and **the same rustc**, and pack writes `rust.rustc` and `juiz: "=<juiz_sdk version>"`.
  - If you write the `juiz` range yourself, start it at `>=0.0.30`. juiz 0.0.29 and earlier cannot load the new-style plugins, so pack warns when they are in the range.
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
