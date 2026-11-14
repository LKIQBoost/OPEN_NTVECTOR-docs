# 模块与工具

Vector 在解释器启动时注册 **19 个内置模块**，全部由 C/C++ 实现，插件直接 `import` 即可，不需要安装。

| 模块 | 用途 | 类型 |
| --- | --- | --- |
| `engine` | 事件、协议回调、游戏交互、移动视角 | 核心 |
| `setting` | 账号 / 玩家 / 版本信息 | 核心 |
| `mod_log` | 写入 C++ Logger | 核心 |
| `pkt` | MC 协议二进制读写 | 核心 |
| `utility` | 加解密 / HTTP 动态 token | 核心 |
| `nbt` | 强类型 NBT 读写 | 核心 |
| `packets` | 协议对象与通用编解码 | 核心 |
| `game_state` | 已确认的游戏状态查询 | 核心 |
| `api_errors` | 原生接口共享异常 | 核心 |
| `client_instance` | pybind11 客户端启动入口 | 网络 |
| `_client` | capsule 版客户端入口（遗留） | 网络 |
| `easy_utils` | pybind11 加解密 / HTTP | 网络 |
| `_raknet` | SLikeNet / RakNet 封装 | 网络 |
| `_websocket` | WebSocket 客户端 | 网络 |
| `tan_lobby_game_clicpp_wrapper` | NetherNet 大厅连接 | 网络 |
| `aes` | AES-128-ECB 单块加解密 | 加密 |
| `_chacha` | ChaCha20 流加密 | 加密 |
| `rotor` | Rotor 加密 | 加密 |
| `fop` | MCP 文件系统（遗留） | 兼容 |

`engine` 的完整用法见 [engine API](/plugin/engine)。

## mod_log — 日志

```python
import mod_log

mod_log.log(1, "普通信息")   # LOG_INFO  = 1
mod_log.log(2, "警告信息")   # LOG_WARN  = 2
mod_log.log(4, "错误信息")   # LOG_ERROR = 4
```

`level` 实际上是 **分类位掩码**（`1 << n`），不是 1/2/3 的严重级别。可以按位或：

```python
mod_log.log(1 | 4, "同时写入 INFO 和 ERROR 分类")
```

## setting — 账号 / 玩家 / 版本信息

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `setting.get_token()` | `str` | 当前登录 token |
| `setting.get_playerid()` | `str` | 玩家实体 ID（**字符串形式**） |
| `setting.get_engine_version()` | `str` | 引擎版本 |
| `setting.get_patch_version()` | `str` | 补丁版本 |
| `setting.get_uid()` | `str` | 用户 ID |
| `setting.get_name()` | `str` | 玩家昵称（UTF-8，中文可直接使用） |

::: warning 函数名是下划线风格
旧文档里的 `setting.gettoken()` / `setting.getplayerid()` 不存在，当前导出名是
`get_token` / `get_playerid`。
:::

## utility — 加解密与动态 token

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `utility.encrypt_with_tail(data)` | `bytes` | 加密（`/authentication-v2` 同款带尾部模式） |
| `utility.decrypt_with_tail(data)` | `bytes` | 解密 |
| `utility.get_encrypt_token(token, body, url)` | `bytes` | 生成 HTTP 动态 token |

参数顺序：

```python
import utility

token = utility.get_encrypt_token(token_bytes, body_str, url_str)
headers = {"user-token": token.decode("ascii")}
```

- `token` 必须是 `bytes`。
- `body` / `url` 必须是 `str`。
- 返回的 `bytes` 内容是 ASCII 动态 token。

## pkt — MC 协议二进制读写

`pkt` 面向基岩版协议，支持 varint、zigzag varint、varint 前缀字符串等。

### 单个读取函数

所有读取函数返回 `(value, new_offset)`：

| 函数 | 说明 |
| --- | --- |
| `pkt.read_byte(data, off)` | uint8 |
| `pkt.read_bool(data, off)` | bool |
| `pkt.read_varint(data, off)` | 无符号 varint |
| `pkt.read_svarint(data, off)` | 有符号 zigzag varint |
| `pkt.read_string(data, off)` | varint 长度前缀字符串，返回 `str` |
| `pkt.read_u16(data, off)` | 小端 uint16 |
| `pkt.read_u32(data, off)` | 小端 uint32 |
| `pkt.read_i32(data, off)` | 小端 int32 |
| `pkt.read_u64(data, off)` | 小端 uint64 |
| `pkt.read_i64(data, off)` | 小端 int64 |
| `pkt.read_f32(data, off)` | 小端 float32 |
| `pkt.read_f64(data, off)` | 小端 float64 |
| `pkt.read_bytes(data, off, count)` | `count` 个字节，返回 `bytes` |
| `pkt.remaining(data, off)` | 剩余字节数 |

越界、非法 varint、非法长度都会抛 `api_errors.PacketError`。

### 单个写入函数

所有写入函数返回 `bytes`：

| 函数 | 说明 |
| --- | --- |
| `pkt.write_byte(value)` | uint8 |
| `pkt.write_bool(value)` | 写 1 字节（任意真值 → 1） |
| `pkt.write_varint(value)` | 无符号 varint |
| `pkt.write_string(value)` | varint 长度前缀 UTF-8 字符串 |
| `pkt.write_u16(value)` | 小端 uint16 |
| `pkt.write_u32(value)` | 小端 uint32 |
| `pkt.write_i32(value)` | 小端 int32 |
| `pkt.write_u64(value)` | 小端 uint64 |
| `pkt.write_f32(value)` | 小端 float32 |
| `pkt.write_f64(value)` | 小端 float64 |

::: warning 没有 `write_svarint` / `write_i64`
当前导出表只有上表这些写入函数。需要 zigzag varint 时请用 `pkt.pack` 之外的逻辑自行处理，
或直接构造 `bytes`。
:::

### 批量读取：`unpack`

```python
values = pkt.unpack(format, data, offset)   # 返回 (v1, v2, ..., new_offset)
```

`offset` 是必填参数。

| 格式码 | 类型 |
| --- | --- |
| `b` | uint8 |
| `?` | bool |
| `v` | 无符号 varint |
| `V` | 有符号 zigzag varint |
| `s` | varint 前缀字符串（返回 `str`） |
| `h` | uint16 |
| `H` | int16 |
| `i` | uint32 |
| `I` | int32 |
| `q` | uint64 |
| `Q` | int64 |
| `f` | float32 |
| `d` | float64 |

### 批量写入：`pack`

```python
data = pkt.pack(format, *values)
```

::: danger pack 支持的格式码比 unpack 少
`pack` 目前只支持：`b`、`?`、`v`、`s`、`h`、`i`、`I`、`f`、`d`。

不支持 `V`、`H`、`q`、`Q`。用错会抛 `api_errors.PacketError`。
:::

### 示例

```python
import pkt
import engine

def on_text_packet(data):
    # data 不含包 ID
    packet_type, off = pkt.read_byte(data, 0)
    message, off = pkt.read_string(data, off)
    print(packet_type, message)

engine.register_protocol_event(9, on_text_packet, False)
```

```python
# 构造一个简单负载
payload = pkt.pack("bvs", 1, 100, "hello")
```

::: tip Py3 字符串变化
`read_string` / `unpack("s")` 返回解码后的 `str`，中文不需要再 `.decode("utf-8")`。
:::

## aes — AES-128-ECB

```python
import aes

cipher = aes.ecb128encrypt(key, data)
plain = aes.ecb128decrypt(key, cipher)
```

| 函数 | 说明 |
| --- | --- |
| `aes.ecb128encrypt(key, data)` | AES-128-ECB，无填充 |
| `aes.ecb128decrypt(key, data)` | AES-128-ECB，无填充 |

- `key` 必须恰好 16 字节，`data` 必须恰好 16 字节。
- 长度不对抛 `ValueError`；OpenSSL 操作失败抛 `api_errors.CryptoError`。

## _chacha — ChaCha20

```python
import _chacha

cipher = _chacha.get_chacha(rounds, key)   # key 至少 32 字节
out = _chacha.process(cipher, data)
_chacha.delete(cipher)
```

| 函数 | 说明 |
| --- | --- |
| `_chacha.get_chacha(rounds, key)` | 创建 `ChaChaX` 实例 |
| `_chacha.process(instance, data)` | 处理一段数据并返回 `bytes` |
| `_chacha.delete(instance)` | 释放实例 |

::: warning 有状态
`process` 会推进密钥流；连续调用相当于对连续数据流加密。
需要从头开始请重新 `get_chacha`。
:::

## rotor — Rotor 加密

```python
import rotor

r = rotor.newrotor("key", 6)
out = r.encrypt(b"data")
plain = r.decrypt(out)
```

| 方法 | 说明 |
| --- | --- |
| `rotor.newrotor(key, num_rotors=6)` | 创建 rotor 对象 |
| `r.encrypt(data)` | 从头加密（重置状态） |
| `r.decrypt(data)` | 从头解密（重置状态） |
| `r.encryptmore(data)` | 延续当前状态继续加密 |
| `r.decryptmore(data)` | 延续当前状态继续解密 |
| `r.setkey(key)` | 重设密钥 |

输入输出都是 `bytes`。

## easy_utils — pybind11 工具

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `easy_utils.ComputeDynamicToken(token, body, url)` | `str` | 生成动态 token |
| `easy_utils.HttpEncrypt(data)` | `bytes` | HTTP 加密 |
| `easy_utils.HttpDecrypt(data)` | `bytes` | HTTP 解密 |
| `easy_utils.encrypt(data, offset, rounds)` | `bytes` | 自定义轮转加密 |
| `easy_utils.Request(url, data, headers)` | `bytes` | 同步 HTTP POST |

`Request` 的注意事项：

- 只支持 `http://` / `https://`，URL 必须带协议和主机。
- `data` 是请求体字符串，`headers` 是 `dict[str, str]`。
- 返回响应体 `bytes`；连接失败时返回空 `bytes`，不会抛异常。
- 这是同步调用，会阻塞当前线程。

## _websocket — WebSocket 客户端

```python
import _websocket

ws = _websocket.WebSocket("127.0.0.1", 8080, "/path")
ws_id = ws.event_id

def on_message(args):
    event_id, content = args       # content 是 str
    print(event_id, content)

def on_connection(args):
    event_id, connected = args
    print(event_id, connected)

import engine
engine.register(on_message, "websocket_message")
engine.register(on_connection, "websocket_connection")

ws.connect()                       # 当前实现固定返回 False
ws.send("hello")                   # 只接受 str
ws.close()
```

| 成员 | 说明 |
| --- | --- |
| `WebSocket(ip, port, path)` | 创建客户端 |
| `ws.connect()` | 发起连接；**当前实现固定返回 `False`**，连接结果看 `websocket_connection` 事件 |
| `ws.send(data)` | 发送字符串，返回 `bool` |
| `ws.close()` | 断开连接 |
| `ws.event_id` | 只读事件 ID，用于区分多个连接 |

模块级兼容接口：

| 函数 | 说明 |
| --- | --- |
| `_websocket.get_websocket(ip, port, path)` | 创建 `WebSocket` |
| `_websocket.delete(ws)` | 释放客户端 |

::: danger send 只接受 str
底层使用 `PyArg_ParseTuple(args, "s#", ...)`。传 `bytes` 会抛 `TypeError`；
需要发送二进制时请在上层自行约定编码（例如 Base64）。
:::

## _raknet — RakNet / SLikeNet

```python
from _raknet import get_raknet, MEDIUM_PRIORITY, RELIABLE_ORDERED

peer = get_raknet()
peer.Startup(0, 1)
peer.Connect("127.0.0.1", 19132)

peer.Send(b"hello", MEDIUM_PRIORITY, RELIABLE_ORDERED, 0)

packet = peer.ReceivePacket(timeout_ms=1000)
if packet is not None:
    print(packet["message_id"], packet["payload"], packet["address"])

peer.Disconnect()
peer.Shutdown()
```

| 方法 | 说明 |
| --- | --- |
| `get_raknet()` | 创建 `RakNet` 实例 |
| `RakNet.Startup(port=0, max_connections=1)` | 启动本地 peer |
| `RakNet.Connect(host, port, password=b"")` | 连接远端，需先 `Startup` |
| `RakNet.Send(data, priority=MEDIUM_PRIORITY, reliability=UNRELIABLE, ordering_channel=0)` | 发送 `0xfe` 应用消息，返回 receipt |
| `RakNet.Receive(length, timeout_ms=0)` | 返回「1 字节消息 ID + 负载」；超时返回全零 |
| `RakNet.ReceivePacket(timeout_ms=0)` | 返回 dict 或 `None` |
| `RakNet.Disconnect()` | 断开当前连接 |
| `RakNet.Shutdown(block_duration=300)` | 停止 peer |
| `RakNet.GetInstanceId()` | 实例 ID |
| `RakNet.GetConnectionState()` | SLikeNet 连接状态 |
| `RakNet.GetReceiveQueueSize()` | 接收队列长度 |
| `_raknet.delete(peer)` | 释放实例 |

优先级常量：`IMMEDIATE_PRIORITY`、`HIGH_PRIORITY`、`MEDIUM_PRIORITY`、`LOW_PRIORITY`。

可靠性常量：`UNRELIABLE`、`UNRELIABLE_SEQUENCED`、`RELIABLE`、`RELIABLE_ORDERED`、`RELIABLE_SEQUENCED`。

`ReceivePacket` 返回：

```python
{
    "message_id": 134,        # int
    "payload": b"...",        # bytes
    "address": "127.0.0.1:19132",
}
```

事件：

| 事件 | 参数 |
| --- | --- |
| `ID_CONNECTION_REQUEST_ACCEPTED` | `[instance_id, address]` |
| `ID_DISCONNECTION_NOTIFICATION` | `[instance_id]` |
| `ID_CONNECTION_LOST` | `[instance_id]` |
| `ID_CONNECTION_ATTEMPT_FAILED` | `[instance_id]` |
| `on_raknet_message` | `[instance_id, body, address]` |

::: warning on_raknet_message 的 body 是 str
该事件走通用 `trigger`，`std::string` 会按 UTF-8 转成 Python `str`。
需要原始二进制请用 `ReceivePacket()`。
:::

## fop — MCP 文件系统（遗留）

| 函数 | 说明 |
| --- | --- |
| `fop.find_file(fullname, path)` | 文件是否存在 |
| `fop.get_file(fullname, path)` | 读取文件，失败返回 `None` |
| `fop.new_module(name, code, path=None)` | 用 code object 创建模块 |
| `fop.new_mcp(fullname)` | 加载 MCP |
| `fop.reload_mcp(fullname)` | 重新加载 MCP |

MCP 是 Python 2 时代的打包格式，Py3 下发布插件请直接分发源码。

## 客户端与网络入口

### client_instance（推荐）

```python
import client_instance

client_instance.startUp(
    md5_token, display_name, user_id,
    engine_version, patch_version,
    auth_server_url, netease_server_id,
    server_ip, port,
)
client_instance.disconnect()
```

`startUp` 会先断开并释放旧的全局客户端实例，再登录并连接新服务器。

### _client（遗留）

```python
import _client

client = _client.get_client()
_client.startUp(
    client, md5_token, display_name, user_id,
    engine_version, patch_version,
    auth_server_url, server_ip, netease_server_id, port,
)
_client.disconnect(client)
_client.delete(client)
```

使用 capsule 保存实例，`md5_token` 取前 16 字节。新插件请优先用 `client_instance`。

### tan_lobby_game_clicpp_wrapper — NetherNet

```python
from tan_lobby_game_clicpp_wrapper import create

ctx = create(disout=False)
ctx.startUp(
    nethernet_id_to,
    nethernet_id_from,
    token,
    server_ip,
    server_port,
    user_id,
)
```

失败时会触发以下事件（参数 `[exit_code]`）：

`on_nethernet_ws_closed`、`on_nethernet_ws_timeout`、`on_nethernet_connect_timeout`、
`on_nethernet_webrtc_timeout`、`on_nethernet_disconnected`。

`disout=True` 时还会直接结束进程。

## 原生数据结构模块

以下模块的完整字段说明见 [接口参考](/api/reference)：

- [`nbt`](/api/native-modules#nbt) —— `Tag` / `Document` / `loads` / `dumps` / `flatten`
- [`packets`](/api/native-modules#commandrequest) —— `Packet` / `CommandRequest` / `CommandOrigin`
- [`game_state`](/api/native-modules#游戏状态) —— 已确认的玩家、世界、容器、背包、子区块状态
- [`api_errors`](/api/reference) —— 共享异常体系

## 下一步

- [协议数据包](/plugin/protocol)
- [代码模板](/plugin/templates)
- [Python 原生接口](/api/reference)
