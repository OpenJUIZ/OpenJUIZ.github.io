---
title: Broker plugins
description: How to add brokers later with the juiz broker command, and how to write your own broker with the broker plugin C ABI.
sidebar:
  order: 9.6
---

Some brokers are built into the `juiz` command, and others are **plugins that you install later**.

| Kind | Brokers | How to get them |
|---|---|---|
| Built in | HTTP (`http`), IPC (`ipc`), QUIC (`qmp`) | Nothing to do. They come with `juiz` |
| Installed later | Zenoh (`zenoh`) | `juiz broker install zenoh` |

Brokers that you install later are built against the **broker plugin C ABI**. `juiz` can load one even if it was built with a different rustc or a different juiz version, as long as the ABI version matches. That is why they can be shipped as prebuilt archives for each OS and installed with `juiz broker install`, and why heavy dependencies such as Zenoh stay out of `juiz` itself.

:::note[Available from juiz 0.4.0]
The `juiz broker` command and the broker plugin C ABI are available from juiz 0.4.0. For installing the Zenoh broker with juiz 0.3.7 and earlier, see [Zenoh broker](/guides/zenoh-broker/#installing-with-juiz-037-and-earlier).
:::

## The `juiz broker` command

```text
juiz broker install <name> [--version <version>] [--from <URL|path>] [--force]
juiz broker list
juiz broker path <name> [--version <version>]
juiz broker remove <name> [--version <version>]
```

### Installing: `install`

```sh
juiz broker install zenoh
# => looking for releases in https://github.com/OpenJUIZ/juiz_zenoh_broker
#    downloading https://github.com/OpenJUIZ/juiz_zenoh_broker/releases/download/v0.4.0/juiz_broker-zenoh-0.4.0-abi1-x86_64-unknown-linux-gnu.tar.gz
#    installed zenoh broker 0.4.0 (juiz_zenoh_broker, broker ABI 1) to /home/me/.juiz/brokers/zenoh/0.4.0
#    Use it with 'type_name: zenoh' in the conf, or IDs like zenoh://<host>:<port>/…
```

`juiz` keeps a small table from names to the repositories to download from. For now it has only `zenoh` (→ [OpenJUIZ/juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker)).

- Without a version, it looks through the repository's GitHub Releases from the newest and installs the first one that has an archive for **an ABI version this `juiz` can load** and for your OS and CPU. When it skips a newer release that needs another ABI version, it says so in a `note:` line.
- `--version <version>` picks a version (`0.4.0` and `v0.4.0` both work).
- `--from` installs a broker that is not in the table, or an archive on your machine. It accepts `https://…`, `file://…` and plain paths. For `https://`, a `<archive>.sha256` next to the archive is required. For a local file, the `.sha256` is checked when present, and a warning is printed when it is not.
- In every case the archive is checked against its sha256, and the `juiz-broker.json` inside (type name, ABI version, OS and CPU, library location) and the marker in the library are verified before anything is put in place. If something does not match, nothing is left behind.
- If the same version is already installed, nothing happens. Add `--force` to install it again.
- If you hit the GitHub API rate limit, set the `GITHUB_TOKEN` environment variable.

Archives are provided for these five targets:

| OS, CPU | Target |
|---|---|
| Linux x86_64 / arm64 | `x86_64-unknown-linux-gnu` / `aarch64-unknown-linux-gnu` |
| macOS Intel / Apple silicon | `x86_64-apple-darwin` / `aarch64-apple-darwin` |
| Windows x86_64 | `x86_64-pc-windows-msvc` |

### Listing: `list`

Shows the built-in types and what you have installed.

```sh
juiz broker list
# => TYPE   VERSION  PLUGIN                     STATUS   PATH
#    http   -        -                          builtin  -
#    ipc    -        -                          builtin  -
#    qmp    -        -                          builtin  -
#    zenoh  0.4.0    juiz_zenoh_broker (ABI 1)  used     /home/me/.juiz/brokers/zenoh/0.4.0
```

`STATUS` is one of these:

| STATUS | Meaning |
|---|---|
| `builtin` | Built into `juiz` |
| `used` | This version is the one that is loaded |
| `older` | A newer version is installed, so this one is not used |
| `ABI <n> is not supported by this juiz` | This `juiz` cannot load that ABI version. Upgrade `juiz` or install a version it can load |
| `invalid (<reason>)` | `juiz-broker.json` is missing or broken, it is built for another OS or CPU, the library is missing, and so on |
| `not used (builtin)` | It has the same name as a built-in broker, so the built-in one is used |

### Locating and removing: `path` and `remove`

```sh
juiz broker path zenoh                    # directory of the version that is loaded
juiz broker path zenoh --version 0.4.0    # directory of that version
juiz broker remove zenoh --version 0.4.0  # remove only that version
juiz broker remove zenoh                  # remove all versions
```

`path` fails (exit code 1) when there is no version it can load.

## Using an installed broker

Once installed, use it like any other broker: write its `type_name` in the configuration file, or start an ID with its type name. You do not need to list it under `plugins`.

```yaml
brokers:
  - type_name: zenoh
    port: 7448
```

```sh
juiz -s zenoh://127.0.0.1:7448 process list
```

When the [naming service](/guides/naming/) looks up where to connect from a name, it also connects through installed brokers (those with a `used` version).

### Which broker is used

`juiz` looks for a broker type in this order and uses the first one it finds:

1. A plugin loaded through `plugins.broker_factories` in the configuration file
2. Built in (`http`, `ipc`, `qmp`)
3. Installed with `juiz broker install`

Step 3 is only taken when a type that 1 and 2 do not have is needed. If the type is nowhere, the error tells you how to install it:

```text
The broker type 'zenoh' is not installed. Install it with 'juiz broker install zenoh'.
```

For a type that is not in the table, it suggests loading it with `plugins.broker_factories` or installing it with `juiz broker install <name> --from <URL>`.

### Where they are stored

Installed brokers go into `~/.juiz/brokers/<type name>/<version>/` (`%USERPROFILE%\.juiz\brokers` on Windows). Set the `JUIZ_BROKER_HOME` environment variable to use another place.

```text
~/.juiz/brokers/
  zenoh/
    0.4.0/
      juiz-broker.json
      lib/libjuiz_zenoh_broker.so      (.dylib on macOS, juiz_zenoh_broker.dll on Windows)
      LICENSE-MIT, LICENSE-APACHE, …
```

If several versions are installed, `juiz` uses the newest one that has an ABI version it can load and is built for your OS and CPU.

### Pinning a version

To use one particular version, find its location with `juiz broker path` and write the library location in `plugins.broker_factories` in the configuration file. That is step 1 of the order above, so it wins over newer installed versions.

```sh
juiz broker path zenoh --version 0.4.0
# => /home/me/.juiz/brokers/zenoh/0.4.0
```

```yaml
plugins:
  broker_factories:
    juiz_zenoh_broker:
      path: "/home/me/.juiz/brokers/zenoh/0.4.0/lib"
```

### In an app (`.juizapp`)

For [app packages](/guides/app-package/), do one of the following:

- **Do not bundle it**: write only `type_name: zenoh` in the configuration file. If the receiver's `juiz` does not have it, they see the hint above (`juiz broker install zenoh`).
- **Bundle it**: put the library under `plugins/<target>/` like other plugins, and write its `path` (with `{target}`) under `plugins.broker_factories`. `juiz pack` does not treat a C ABI broker as a Rust plugin (it does not require a matching rustc or juiz_sdk) and writes its ABI version to `broker_abi` in the manifest. `juiz run` stops with an `Update juiz.` hint if the `juiz` cannot load that version.

## Writing a broker

The broker plugin C ABI is a small interface that **only carries frame bytes**. Building and reading the request and response frames (byte strings starting with `JZF1`), rewriting IDs and calling Processes are all done by `juiz`. The plugin hands the frames it receives to `juiz` and sends back the response `juiz` writes. It never needs to look inside a frame.

In Rust, implement the traits in juiz_sdk's `broker_cabi` and add one macro to get the entry point. The plugin does not depend on juiz_core.

```toml title="Cargo.toml"
[package]
name = "my_broker"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "0.4.0"     # juiz 0.4.0 or later (one that has broker_cabi)
serde_json = "1"
```

```rust title="src/lib.rs"
use juiz_sdk::broker_cabi::{
    BrokerError, BrokerPlugin, ClientHandle, FrameReceiver, FrameSource, ServerHandle, ServerHost,
};
use serde_json::Value;

pub struct MyBroker;

impl BrokerPlugin for MyBroker {
    const TYPE_NAME: &'static str = "mytcp";      // type_name in the conf, and the ID prefix (mytcp://…)
    const DEFAULT_PORT: Option<u16> = Some(7500);
    type Server = MyServer;
    type Client = MyClient;

    /// Start listening and return the actual address (<host>:<port>). Return an error if it fails
    fn start(manifest: Value, host: ServerHost) -> Result<(MyServer, String), BrokerError> {
        // manifest is the entry under brokers in the conf (host, port, ...).
        // When a request arrives, call this from your own thread:
        //   host.handle(&peer_addr, &mut reader, Some(len), |response: FrameSource<'_>| {
        //       /* add your own framing (a length, ...) and send it with response.write_to(&mut stream) */
        //   })
        // handle does not return until the Process finishes, and may be called concurrently
        todo!()
    }

    /// Create a client for the peer (name = <host>:<port> in manifest). Connecting may wait until the first request
    fn connect(manifest: Value) -> Result<MyClient, BrokerError> {
        todo!()
    }
}

pub struct MyServer { /* … */ }

impl ServerHandle for MyServer {
    /// Stop receiving and wait until every host.handle(...) in progress has returned
    fn stop(self) { todo!() }
}

pub struct MyClient { /* … */ }

impl ClientHandle for MyClient {
    /// Send the request with request.write_to(...), and pass the response with response.receive(&mut reader, Some(len))
    fn request(&self, request: FrameSource<'_>, response: FrameReceiver<'_>) -> Result<(), BrokerError> {
        todo!()
    }
}

juiz_sdk::export_broker_plugin!(MyBroker);   // creates the entry point broker_factory_cabi
```

Rules to follow:

- Make `MyServer` and `MyClient` `Send + Sync`. `juiz` calls `request` on the same client, and the server's `host.handle`, many times at once.
- `host.handle` and `request` block. Call them from threads that may block, not from inside an async runtime's workers. Using tokio inside the plugin is fine: it is a separate tokio from the one in `juiz`, so they do not interfere.
- When sending over a stream (such as TCP), the plugin adds its own framing (for example, a length prefix). Only `juiz` knows the layout inside a frame, so you do not need to rebuild the plugin if that layout changes.
- `FrameSource::write_to` writes to a `std::io::Write`, and `FrameReceiver::receive` reads from a `std::io::Read`. Pass a shared memory region as a `Write` to send without an extra copy.
- Report failures as `BrokerError`. Use `BrokerError::error` (listening, connecting or sending failed; the settings do not fit), `BrokerError::timeout` (no response) and `BrokerError::unavailable` (cannot reach the peer; the connection was closed). The caller sees them as `<type name>://<name>: <message>`.
- Log with `info!`, `warn!` and friends from `juiz_sdk::log`; they go to the `juiz` log.
- A panic inside an entry point is caught by `juiz` and turned into an error.

Complete examples are [brokers/tcp_test_broker](https://github.com/OpenJUIZ/juiz/tree/main/brokers/tcp_test_broker) in the juiz repository (a test broker of about 300 lines that just sends length-prefixed frames over TCP) and [OpenJUIZ/juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker).

### Trying it out

The listening side can load the library you built through `plugins.broker_factories` in its configuration file. The key is the library name (`my_broker` for `libmy_broker.so`).

```yaml title="server.conf"
plugins:
  broker_factories:
    my_broker:
      path: "./target/release"
brokers:
  - type_name: mytcp
    port: 7500
```

```sh
juiz -f server.conf -d
```

A caller that uses IDs, such as `juiz -s mytcp://127.0.0.1:7500 process list`, uses brokers installed with `juiz broker install`. Build the archive described in "Distributing" below, install it with `juiz broker install mytcp --from ./juiz_broker-mytcp-….tar.gz`, and then try it. After that, the listening side also works with just `type_name: mytcp` and no `plugins`.

### Distributing

Make an archive that `juiz broker install --from` can install. Its contents are laid out like `<version>/` in the storage location (no top-level directory).

```text
juiz_broker-mytcp-0.1.0-abi1-x86_64-unknown-linux-gnu.tar.gz   (.zip on Windows)
  juiz-broker.json
  lib/libmy_broker.so
  LICENSE-MIT, LICENSE-APACHE, …
```

```json title="juiz-broker.json"
{
  "format": 1,
  "type_name": "mytcp",
  "plugin_name": "my_broker",
  "version": "0.1.0",
  "abi_version": 1,
  "target": "x86_64-unknown-linux-gnu",
  "library": "lib/libmy_broker.so"
}
```

- Name the archive `juiz_broker-<type name>-<version>-abi<ABI version>-<target>.tar.gz`. The ABI version is `1` for now (the library contains the marker `juiz_broker_abi=1;`, and `juiz broker install` checks it too).
- Put a `<archive name>.sha256` in `sha256sum` format next to it.
- If you attach them to a `v<version>` release on GitHub Releases, users can install with `juiz broker install mytcp --from https://github.com/<owner>/<repo>/releases/download/v0.1.0/juiz_broker-mytcp-0.1.0-abi1-x86_64-unknown-linux-gnu.tar.gz`.
- The version is the plugin's own version and does not have to follow juiz's. Only the ABI version has to match.

For a script that builds the archive and a workflow that builds the five targets and publishes them to Releases, see `scripts/package.sh` and `.github/workflows/release.yml` in [juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker).

The details of the C ABI (the entry table, error codes, how frames are passed) are in the specification [docs/spec/broker-plugin-abi.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/broker-plugin-abi.md) in the juiz repository (in Japanese).
