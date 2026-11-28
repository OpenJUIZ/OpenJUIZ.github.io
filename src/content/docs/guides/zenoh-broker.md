---
title: Zenoh broker
description: How to install (juiz broker install zenoh) and configure the Zenoh broker, which calls juiz in other processes and on other machines over Zenoh's TCP, and how to speed it up with shared memory.
sidebar:
  order: 9.5
---

The Zenoh broker calls juiz in other processes and on other machines over [Zenoh](https://zenoh.io/)'s TCP transport. Its type name (the ID prefix) is `zenoh`.
Like the QUIC broker (`qmp`) it reaches other machines and sends images as raw pixels instead of PNG. It is about 2.5–3 times as fast as QUIC, and it uses shared memory for peers on the same machine, which brings it close to the IPC broker.

:::note[Installed differently from juiz 0.4.0]
The Zenoh broker is available from juiz 0.2.9. From juiz 0.4.0 it is no longer built into `juiz`; you add it with `juiz broker install zenoh` ([Installing](#installing)). The configuration file and `zenoh://` IDs stay the same.
:::

## How it differs from the other brokers

| | QUIC (`qmp`) | Zenoh (`zenoh`) | IPC (`ipc`) |
|---|---|---|---|
| Reach | Other machines too | Other machines too | Same machine only |
| ID prefix | `qmp://127.0.0.1:5000` | `zenoh://127.0.0.1:7448` | `ipc://cam0` |
| Transport | QUIC (UDP) | TCP; shared memory for peers on the same machine | Unix domain socket / named pipe |
| Encryption | Yes (the peer is not verified) | **No** (plain TCP) | No (only the same user can connect) |
| A call returning a 720p image | about 7 ms | TCP about 2.4 ms / shared memory about 1.3 ms | about 0.8 ms |
| How to get it | Built in | `juiz broker install zenoh` | Built in |

As a rule of thumb:

- **To send images to another machine fast**, use Zenoh. Use it inside a network you trust (it does not encrypt).
- **To encrypt the link**, use QUIC.
- **Within one machine only**, IPC is the fastest and opens no port. When some peers are on the same machine and some are not, a single Zenoh broker reaches both.

For choosing among all brokers and handling large data such as images, see [Choosing a broker and large data](/guides/large-data/).

## Installing

The Zenoh broker is not built into the `juiz` command. Install it as a [broker plugin](/guides/broker-plugin/) with `juiz broker install`. This is the same whether you installed `juiz` with pip (`juiz-cli`) or with cargo (`juiz_app`).

```sh
juiz broker install zenoh
# => installed zenoh broker 0.4.0 (juiz_zenoh_broker, broker ABI 1) to /home/me/.juiz/brokers/zenoh/0.4.0
#    Use it with 'type_name: zenoh' in the conf, or IDs like zenoh://<host>:<port>/…
```

It downloads a prebuilt archive from the Releases of [OpenJUIZ/juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker), picking a version that your `juiz` can load and a build for your OS and CPU (x86_64 and arm64 on Linux and macOS, x86_64 on Windows), and puts it in `~/.juiz/brokers/zenoh/<version>/`. No Rust toolchain is needed. After that, write `type_name: zenoh` in the configuration file or use `zenoh://` IDs; you do not need to list it under `plugins`.

- `juiz broker list` shows whether it is installed, and `juiz broker remove zenoh` removes it. To install or pin a particular version, see [Broker plugins](/guides/broker-plugin/).
- juiz_zenoh_broker's version does not follow juiz's (it starts at 0.4.0). `juiz broker install` picks a version your `juiz` can load.
- If you write `type_name: zenoh` or connect with `-s zenoh://...` on a `juiz` that does not have it, you get this error:

```text
The broker type 'zenoh' is not installed. Install it with 'juiz broker install zenoh'.
```

Install it on both the listening and the calling `juiz` (on separate machines, run `juiz broker install zenoh` on each).

### Installing with juiz 0.3.7 and earlier

Up to juiz 0.3.7, the Zenoh broker was built into `juiz`. Those versions do not have the `juiz broker` command.

| Installed with | Zenoh broker |
|---|---|
| `pip install juiz-cli` | Built in |
| `cargo install juiz_app` | Reinstall with `cargo install juiz_app --version 0.3.7 --features zenoh-broker` |

`juiz_zenoh_broker` on crates.io ends at 0.3.7. It does not work with newer juiz, so switch to `juiz broker install zenoh`.

## Usage

### The listening side

Add `type_name: zenoh` under `brokers` in the configuration file. By default it listens on TCP port 7448 (chosen so it does not clash with 7447, used by the Zenoh router zenohd).

```yaml title="listener_zenoh.conf"
name: listener_zenoh
brokers:
  - type_name: zenoh
    host: 0.0.0.0     # 0.0.0.0 if omitted
    port: 7448        # 7448 if omitted
```

```sh
juiz -f listener_zenoh.conf --process <listener plugin> -d
```

If the port is in use, juiz logs an ERROR and fails to start (unlike HTTP, it does not try the next port).

### The calling side

Use IDs that start with `zenoh://`, the same way as http and qmp.

```sh
juiz -s zenoh://127.0.0.1:7448 process list
# => ["zenoh://127.0.0.1:7448/process/listener0::listener", ...]
```

To connect a talker and a listener started in separate juiz instances, give the talker's juiz its own Zenoh broker on another port and connect the two `zenoh://` IDs. [Tutorial chapter 7](/tutorial/ipc-broker/#connecting-to-other-machines-the-zenoh-broker) shows how to connect them at start-up with a Topic and `mastersystem`.

```yaml title="talker_zenoh.conf"
name: talker_zenoh
brokers:
  - type_name: zenoh
    port: 7449
```

```sh
juiz connection create -t push \
  "zenoh://127.0.0.1:7449/process/talker0::talker" \
  arg1 \
  "zenoh://127.0.0.1:7448/process/listener0::listener"
```

To register another juiz as a subsystem or master system, or to list it under `broker_proxies`, write `type_name: zenoh` and `name: <host>:<port>`.

```yaml
subsystems:
  - type_name: zenoh
    name: 127.0.0.1:7448   # make the juiz at zenoh://127.0.0.1:7448 a subsystem
```

Topic pushes reach the other juiz over Zenoh, just like calls.

### Settings

Keys for the broker (`brokers`) and broker proxies (`broker_proxies`, `subsystems`, `mastersystem`):

| Key | Default | Where | Meaning |
|---|---|---|---|
| `host` | `0.0.0.0` | Broker | Address to listen on |
| `port` | `7448` | Broker | TCP port to listen on |
| `name` | `<host>:<port>` | Both | The broker's name, or the proxy's peer. IPv6 is `[<addr>]:<port>` |
| `timeout_ms` | `10000` | Proxy | How long to wait for a response. Raise it for Processes that take longer |
| `max_frame_bytes` | 1 GiB | Both | Upper limit of one request or response. Larger ones fail before sending |
| `shared_memory` | `true` | Both | Whether to use shared memory for peers on the same machine ([below](#speeding-up-with-shared-memory)) |
| `shm_pool_bytes` | 64 MiB | Both | Size of the shared memory region (pool) |
| `zenoh_config` | none | Both | Overrides for the Zenoh configuration (`{"<key>": <value>}`, e.g. `{"transport/link/tx/batch_size": 65535}`) |

### Things to keep in mind

- **No encryption and no access control.** It is plain TCP, so use it inside a network you trust.
- Peer discovery (Zenoh scouting) is off; it only talks to the peer named in `name`. Setups through zenohd, or connecting to other Zenoh applications or ROS 2 (rmw_zenoh), are not supported.
- pyjuiz (calling juiz from Python) and the C++ and Haskell clients do not speak Zenoh. Use HTTP or IPC there (you can still write Processes in Python, C++, Haskell and Zig).
- When the peer cannot be reached, does not answer in time, or is not a juiz Zenoh broker, you get `zenoh://127.0.0.1:7448: can not connect (...)`, `no response within 10000 ms`, or `no juiz zenoh broker answered`.

## Speeding up with shared memory

When the peer is on the same machine, requests and responses of 64 KiB or more (such as images) go through Zenoh's shared memory. No setting is needed. When the peer is on another machine, or either side has `shared_memory: false`, they go over TCP automatically.

### Raise `ulimit -l` (Linux and macOS)

Zenoh locks the whole shared memory region (64 MiB by default) into physical memory (mlock). On many Linux systems the default limit for a normal user is 8 MiB, which is not enough. In that case juiz prints this warning once, does not use shared memory, and sends over TCP (it is not an error; you just get TCP speed).

```
zenoh: shared memory is turned off. the shared memory pool (shm_pool_bytes = 67108864) can not be locked in memory (RLIMIT_MEMLOCK = 8388608 bytes). raise it (ulimit -l, or LimitMEMLOCK in systemd) or lower shm_pool_bytes. frames are sent over TCP
```

To use shared memory, raise the limit above 64 MiB on both the sending and receiving side before starting `juiz`.

```sh
ulimit -l          # current limit (KiB)
ulimit -l 131072   # 128 MiB. If this exceeds the hard limit, raise it in /etc/security/limits.conf or similar
```

- For a systemd service, add `LimitMEMLOCK=128M` or similar to the unit.
- In Docker, pass `--ulimit memlock=-1`. The container's default `/dev/shm` (64 MB) may also be too small, so add something like `--shm-size=256m`.
- If the soft limit is too low but the hard limit is high enough, juiz raises it by itself.
- If you cannot raise the limit, setting `shm_pool_bytes` below it also works, but requests and responses larger than the pool (about 25 MB for a 4K image) go over TCP.
- Windows does not mlock, so none of this is needed there.

### Turning it off

Write `shared_memory: false` to stop using shared memory. Also turn it off if, under very high CPU load, the receiver fails to read frames and you see errors or timeouts (a known Zenoh issue).

```yaml
brokers:
  - type_name: zenoh
    shared_memory: false
```

## Performance

Time per call to a Process in another process on the same machine (cloud, 4 vCPUs, release build, ms).

| Image | Method | Return value | Sent as argument | Topic push |
|---|---|---|---|---|
| 720p (2.8 MB) | Zenoh shared memory | 1.2–1.4 | 1.2–1.4 | 1.1–1.6 |
| 720p | Zenoh TCP | 2.4 | 2.3 | 2.4 |
| 720p | IPC | 0.8 | 1.7 | 1.0 |
| 720p | QUIC | 6.5 | 7.3 | – |
| 4K (24.9 MB) | Zenoh shared memory | 8.1–8.9 | 7.4–8.2 | 9.5–10.7 |
| 4K | Zenoh TCP | 19.2 | 22.4 | 21.7 |
| 4K | IPC | 9.1 | 100.2 | 11.5 |
| 4K | QUIC | 66.3 | 62.8 | – |

- A Zenoh Topic push is timed until the receiving Process has run and the response is back. IPC Topic numbers use the shared memory ring (until delivery).
- Shared memory is about 1.8 times as fast as TCP at 720p and about 2.5 times at 4K; a 4K return value is about as fast as IPC. When you send large images as arguments, Zenoh is faster than IPC.
- To other machines it sends over TCP, so the network speed matters more (about 22 ms for 720p on 1 Gbps).

To measure on your own machine, run this in the [juiz_zenoh_broker](https://github.com/OpenJUIZ/juiz_zenoh_broker) repository:

```sh
cargo test --release --test broker -- bench:: --ignored --nocapture --test-threads=1
JUIZ_ZENOH_BENCH_TCP_ONLY=1 cargo test --release --test broker -- bench:: --ignored --nocapture --test-threads=1   # without shared memory
```
