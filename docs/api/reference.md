# 接口参考

本文档对应 `application/PythonAPI/Stubs` 中的类型声明和运行时注册模块。
函数名、参数顺序和返回类型以 C++ 导出表为准。

## 通用约定

- 所有模块都在解释器启动时注册，直接 `import` 即可。
- 原生接口失败时抛出 `api_errors` 中的异常。
- 参数类型错误抛 Python 标准 `TypeError`；参数数值 / 长度不合法抛 `ValueError`。
- 状态查询用 `None` 表示「服务器尚未确认」，不用 0 / 空列表伪装。

## api_errors

| 异常 | 基类 | 适用范围 |
| --- | --- | --- |
| `BotApiError` | `Exception` | 所有原生接口异常的基类 |
| `NbtError` | `BotApiError` | NBT 数据损坏、编码失败、限制超出 |
| `PacketError` | `BotApiError` | 数据包格式错误、字段错误 |
| `ConnectionError` | `BotApiError` | RakNet、WebSocket 或当前游戏连接不可用 |
| `CryptoError` | `BotApiError` | AES、ChaCha 等加密操作失败 |
| `ClientError` | `BotApiError` | 登录或客户端初始化失败 |
| `TimeoutError` | `BotApiError` | 异步请求在指定时间内没有完成 |

## engine

完整说明见 [engine API](/plugin/engine)。导出函数：

| 类别 | 函数 |
| --- | --- |
| 事件 | `register`、`register_kernel_event`、`unregister`、`is_registered`、`trigger` |
| 事件查询 | `get_event_handler_count`、`get_events_info`、`get_handler_count` |
| 清理 | `cleanup_all`、`cleanup_user`、`cleanup_kernel` |
| 协议事件 | `register_protocol_event`、`register_structured_protocol_event`、`clear_all_protocol_event`、`clear_all_kernel_protocol_event`、`clear_all_user_protocol_event` |
| 聊天 / 指令 | `message`、`command`、`command_guid`、`settingscommand`、`send`、`rpc`、`do_login` |
| 状态 | `get_server_ip`、`get_server_port`、`get_server_sid`、`getparams`、`get_entity_runtime_id`、`get_mcp_load_config` |
| 移动 / 视角 | `move`、`add_pot_x`、`add_pot_y`、`add_pot_z`、`get_pot_x`、`get_pot_y`、`get_pot_z`、`add_head_x`、`add_head_y`、`get_head_x`、`get_head_y` |
| 输入 / 复活 | `key_down`、`key_up`、`respawn`、`get_auth_input`、`disabled_auth_input`、`enable_auth_input` |
| 世界交互 | `get_subchunk_blocks`、`command_update`、`openContainer` |
| 系统 | `system`、`exit` |

## setting

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `get_token()` | `str` | 登录 token |
| `get_playerid()` | `str` | 玩家实体 ID（字符串） |
| `get_engine_version()` | `str` | 引擎版本 |
| `get_patch_version()` | `str` | 补丁版本 |
| `get_uid()` | `str` | 用户 ID |
| `get_name()` | `str` | 玩家昵称（UTF-8） |

## mod_log

```python
log(level: int, message: str) -> None
```

`level` 是分类位掩码：`1` = INFO、`2` = WARN、`4` = ERROR，可按位或。

## utility

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `encrypt_with_tail(data: bytes)` | `bytes` | 带尾部加密 |
| `decrypt_with_tail(data: bytes)` | `bytes` | 带尾部解密 |
| `get_encrypt_token(token: bytes, body: str, url: str)` | `bytes` | 生成 HTTP 动态 token |

## pkt

### 读取

`read_byte`、`read_bool`、`read_varint`、`read_svarint`、`read_string`、`read_u16`、
`read_u32`、`read_i32`、`read_u64`、`read_i64`、`read_f32`、`read_f64`、
`read_bytes(data, off, count)`、`remaining(data, off)`。

所有读取函数返回 `(value, new_offset)`；`read_string` 返回 `str`。

### 写入

`write_byte`、`write_bool`、`write_varint`、`write_string`、`write_u16`、
`write_u32`、`write_i32`、`write_u64`、`write_f32`、`write_f64`。

所有写入函数返回 `bytes`。**没有 `write_svarint` / `write_i64`。**

### 批量

| 函数 | 说明 |
| --- | --- |
| `unpack(format, data, offset)` | 返回 `(v1, ..., new_offset)`；`offset` 必填 |
| `pack(format, *values)` | 返回 `bytes` |

`unpack` 支持：`b ? v V s h H i I q Q f d`。

`pack` 只支持：`b ? v s h i I f d`。

越界、非法 varint、未知格式码抛 `PacketError`。

## aes

| 函数 | 说明 |
| --- | --- |
| `ecb128encrypt(key, data)` | AES-128-ECB，无填充，返回 16 字节 |
| `ecb128decrypt(key, data)` | AES-128-ECB，无填充，返回 16 字节 |

`key` 与 `data` 都必须恰好 16 字节。

## _chacha

| 函数 | 说明 |
| --- | --- |
| `get_chacha(rounds, key)` | 创建 `ChaChaX`；`key` 至少 32 字节 |
| `process(instance, data)` | 处理数据，返回 `bytes` |
| `delete(instance)` | 释放实例 |

`process` 有状态，连续调用会延续密钥流。

## rotor

| 函数 / 方法 | 说明 |
| --- | --- |
| `newrotor(key, num_rotors=6)` | 创建 rotor |
| `rotor.encrypt(data)` | 从头加密 |
| `rotor.decrypt(data)` | 从头解密 |
| `rotor.encryptmore(data)` | 延续状态加密 |
| `rotor.decryptmore(data)` | 延续状态解密 |
| `rotor.setkey(key)` | 重设密钥 |

输入输出均为 `bytes`。

## fop

| 函数 | 说明 |
| --- | --- |
| `find_file(fullname, path)` | 文件是否存在 |
| `get_file(fullname, path)` | 返回 `bytes` 或 `None` |
| `new_module(name, code, path=None)` | 用 code object 创建模块 |
| `new_mcp(fullname)` | 加载 MCP |
| `reload_mcp(fullname)` | 重新加载 MCP |

## 网络和客户端模块

### _raknet

`get_raknet()` 创建 `RakNet` 对象。

| 方法 | 说明 |
| --- | --- |
| `Startup(port=0, max_connections=1)` | 启动 peer |
| `Connect(host, port, password=b"")` | 连接远端 |
| `Send(data, priority=MEDIUM_PRIORITY, reliability=UNRELIABLE, ordering_channel=0)` | 发送并返回 receipt |
| `Receive(length, timeout_ms=0)` | 返回「消息 ID + 负载」 |
| `ReceivePacket(timeout_ms=0)` | 返回 `{message_id, payload, address}` 或 `None` |
| `Disconnect()` | 断开当前连接 |
| `Shutdown(block_duration=300)` | 停止 peer |
| `GetInstanceId()` | 实例 ID |
| `GetConnectionState()` | 连接状态 |
| `GetReceiveQueueSize()` | 接收队列长度 |

模块级 `delete(instance)` 释放资源。

优先级常量：`IMMEDIATE_PRIORITY`、`HIGH_PRIORITY`、`MEDIUM_PRIORITY`、`LOW_PRIORITY`。

可靠性常量：`UNRELIABLE`、`UNRELIABLE_SEQUENCED`、`RELIABLE`、`RELIABLE_ORDERED`、`RELIABLE_SEQUENCED`。

### _websocket

`WebSocket(ip, port, path)` 提供 `connect`、`send`、`close` 和只读的 `event_id`。

- `connect()` 当前实现固定返回 `False`，连接结果通过 `websocket_connection` 事件通知。
- `send()` 只接受 `str`，返回 `bool`。
- 事件：`websocket_message`（`[event_id, content]`）、`websocket_connection`（`[event_id, connected]`）。

模块级 `get_websocket` 和 `delete` 保留旧版工厂接口。

### _client 与 client_instance

- `client_instance.startUp(...)` / `client_instance.disconnect()`：推荐的客户端入口，pybind11 参数为 8 个字符串 + 端口。
- `_client` 使用 capsule 实例：`get_client`、`startUp`、`disconnect`、`delete`。

`_client.startUp` 参数顺序：

```text
(client, md5_token, display_name, user_id, engine_version,
 patch_version, auth_server_url, server_ip, netease_server_id, port)
```

`client_instance.startUp` 参数顺序：

```text
(md5_token, display_name, user_id, engine_version,
 patch_version, auth_server_url, netease_server_id, server_ip, port)
```

### easy_utils

| 函数 | 说明 |
| --- | --- |
| `ComputeDynamicToken(token, body, url)` | 返回 `str` |
| `HttpEncrypt(data)` | 返回 `bytes` |
| `HttpDecrypt(data)` | 返回 `bytes` |
| `encrypt(data, offset, rounds)` | 返回 `bytes` |
| `Request(url, data, headers)` | 同步 HTTP POST，返回响应体 `bytes` |

### tan_lobby_game_clicpp_wrapper

`create(disout=False)` 返回 `TanLobbyGameCtx`，其 `startUp` 建立 NetherNet 大厅连接：

```text
startUp(nethernet_id_to, nethernet_id_from, token,
        server_ip, server_port, user_id)
```

失败事件：`on_nethernet_ws_closed`、`on_nethernet_ws_timeout`、
`on_nethernet_connect_timeout`、`on_nethernet_webrtc_timeout`、
`on_nethernet_disconnected`，参数为 `[exit_code]`。

## nbt

提供 `TagType`、`Tag`、`Document`，以及 `loads`、`load_tag`、`dumps`、
`dump_document`、`flatten`。

支持 `big_endian`、`little_endian` 和 `network_little_endian`。

用法示例见[原生模块速查 · NBT](/api/native-modules#nbt)。

## packets

### `Packet`

| 成员 | 说明 |
| --- | --- |
| `Packet(packet_id, payload)` | 构造任意包对象 |
| `GetPacketID()` | 包 ID |
| `GetPacketName()` | 包名，未知为 `Unknown` |
| `GetPayload()` | 不含包 ID 的负载 |
| `GetData()` | 结构化字段 dict 或 `None` |
| `Serialize()` | varint 包 ID + 负载 |

模块级：

| 函数 | 说明 |
| --- | --- |
| `encode(packet_id, payload)` | 返回序列化后的 `bytes` |
| `decode(packet_id, payload)` | 返回 `Packet` |
| `decode_bytes(data)` | 从「varint 包 ID + 负载」解析出 `Packet` |

### `CommandRequest`

支持命令、来源、UUID、请求 ID、玩家 ID、内部来源、命令版本、`unlimit` 的
getter / setter，以及 `GetPacketID()`、`Serialize()`、`Send()`。

::: warning 线格式固定值
当前协议版本下，`Serialize()` 会：

- 命令来源固定写字符串 `"player"`，`SetCommandOrigin()` 不影响线格式。
- 命令版本固定写 `"latest"`，`SetCommandVersion()` 不影响线格式。
- `SetPlayerID()` 会写 int64；负数按 `0` 发送。
- `SetRandomUUID()` 必须传 16 字节，否则 `PacketError`。
:::

## game_state

| 函数 | 返回值 |
| --- | --- |
| `get_local_player()` | `LocalPlayerState \| None` |
| `has_local_player()` | `bool` |
| `get_server()` | `{ip, port, server_id} \| None` |
| `get_block_actor(x, y, z)` | 方块实体 / NBT 字典或 `None` |
| `get_container(x, y, z)` | 容器和物品槽字典或 `None` |
| `get_players()` | 玩家列表 |
| `get_world()` | StartGame 确认的世界 / 玩家基础状态 |
| `get_inventory()` | 窗口 0 的玩家背包或 `None` |
| `request_subchunks_async(...)` | `AsyncSubchunkRequest` |

### 返回结构

`get_local_player()`：

```python
{
    "entity_runtime_id": 123,
    "position": {"x": 0.0, "y": 64.0, "z": 0.0} | None,
    "rotation": {"pitch": 0.0, "yaw": 0.0, "head_yaw": 0.0} | None,
}
```

`get_block_actor(x, y, z)`：

```python
{
    "position": {"x": 1.0, "y": 2.0, "z": 3.0},
    "raw_nbt": b"...",
    "nbt": nbt.Tag | None,
    "root_name": "..." | None,
    "nbt_error": "..." | None,
}
```

`get_container(x, y, z)`：

```python
{
    "window_id": 2,
    "window_type": 0,
    "position": {"x": 1.0, "y": 2.0, "z": 3.0},
    "entity_unique_id": 0,
    "slots": [
        {
            "network_id": 276,
            "count": 1,
            "metadata": 0,
            "block_runtime_id": 0,
            "stack_id": 0 | None,
            "extra": b"",
        }
    ] | None,
}
```

`get_players()` 每项：

```python
{
    "uuid": b"...",             # 16 字节
    "entity_unique_id": 123,
    "username": "...",
    "xuid": "...",
    "platform_chat_id": "...",
    "build_platform": 0,
    "teacher": False,
    "host": False,
    "subclient": False,
    "player_color": 0,
}
```

`get_world()`：

```python
{
    "player_entity_id": 123,
    "entity_runtime_id": 456,
    "gamemode": 1,
    "position": {"x": 0.0, "y": 64.0, "z": 0.0},
}
```

`get_inventory()`：

```python
{
    "window_id": 0,
    "slots": [ ... ],   # 槽位结构与 get_container 相同
}
```

### 异步子区块请求

```python
request = game_state.request_subchunks_async(
    origin_x, origin_y, origin_z, offsets, timeout_ms=6000,
)
```

`AsyncSubchunkRequest`：

| 方法 | 说明 |
| --- | --- |
| `done()` | 是否完成 |
| `cancel()` | 取消尚未开始的请求，返回 `bool` |
| `cancelled()` | 是否已取消 |
| `result(timeout_ms=-1)` | 等待并返回结果列表 |

- `offsets` 不能为空，`timeout_ms` 不能为负。
- `result()` 超时抛 `api_errors.TimeoutError`；请求已取消抛 `ValueError`。
- 返回 `[{x, y, z, name, states}]`，其中 **`states` 是 JSON 字符串**。
  `engine.get_subchunk_blocks()` 的 `states` 才是 dict。

## 异步请求的超时与取消

`request_subchunks_async` 返回的请求句柄默认允许 `result()` 无限等待；
传入非负毫秒数即可限制等待时间。

`cancel()` 只取消**尚未开始**的请求，已经发送到服务器的请求会继续由底层协议完成。

## 下一步

- [原生模块速查](/api/native-modules)
- [结构化协议事件](/api/structured-events)
