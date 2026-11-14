# 事件系统

## 注册规则（必须遵守）

| 写法 | 说明 |
| --- | --- |
| `engine.register(cb, "事件名")` | ✅ **唯一合法**的用户事件注册方式 |
| `engine.register_kernel_event(cb, "事件名")` | ❌ **禁止使用**，仅框架脚本可用 |
| `engine.register_protocol_event(id, cb, True)` | ❌ **禁止使用**（内核协议事件），仅框架脚本可用 |
| `engine.register_protocol_event(id, cb, False)` | ✅ 注册用户协议事件，重载时自动清除 |
| `engine.register_structured_protocol_event(id, cb)` | ✅ 结构化协议事件，`is_kernel` 默认 `False` |

回调签名固定：

```python
def handler(args):
    ...
```

`engine.register` 会检查回调是否至少接收 1 个位置参数，否则抛 `TypeError`。

同一个回调重复注册到同一事件会覆盖旧注册；不同回调可以同时监听同一事件。

## 触发时的参数规则

```python
engine.trigger("事件名")              # 无参数，回调收到 []
engine.trigger("事件名", [a, b])      # 回调收到 [a, b]
engine.trigger("事件名", (a, b))      # 回调收到 (a, b)
engine.trigger("事件名", some_obj)    # 非 list/tuple 会被包成 [some_obj]
```

因此传 dict 时，下面两种写法等价，回调里 `args[0]` 都是 `my_dict`：

```python
engine.trigger("MyEvent", [my_dict])
engine.trigger("MyEvent", my_dict)
```

::: warning 内部接口才要求 list/tuple
`engine.cpp::trigger_event` 对非 list/tuple 会静默丢弃；但 Python 侧的
`engine.trigger` 已经先做了包装，所以插件正常调用不会出现「静默丢事件」。
:::

## 框架事件

由 `source/` 下的 Python 框架（如 `init.py`、`proton.py`）触发：

| 事件 | 触发时机 | 参数 |
| --- | --- | --- |
| `ModEventStartUp` | 所有插件加载完成后 | `[]` |
| `ModEventUnInit` | 全量重载前 | `[]` |
| `OnTextPacket` | 收到文本包后（`proton.py` 解析） | `[dict]` |
| `on_text` | 收到聊天栏消息后（`proton.py` 触发） | `[source_name, message, msg_type, parameters]` |
| `on_command_output` | 发送指令后（`proton.py` 触发） | `[返回值, GUID]` |
| `on_rpc` | 收到远程调用后 | `[bytes]`，内核事件，框架已处理 |

`on_command_output` 的返回值形如 `[[键, [参数...]], ...]`。

## C++ 原生事件

以下事件由 C++ 侧直接触发，插件可以监听，但其中部分事件框架已经处理：

| 事件 | 触发时机 | 参数 |
| --- | --- | --- |
| `start_game` | 收到 `StartGame` 并完成初始化 | `[0]` |
| `on_play_status` | 收到 `PlayStatus` | `[status:int]` |
| `on_resource_packs_info` | 收到资源包信息 | `[0]` |
| `on_player_list` | 收到 `PlayerList` | `[player_list:dict]` |
| `TextParsed` | 收到 `Text` | 见下 |
| `CommandOutputParsed` | 收到 `CommandOutput` | 见下 |
| `on_move_player` | 本地玩家移动被服务器确认 | `[x:float, y:float, z:float]` |
| `on_respawn` | 收到 `Respawn` | `[state:int, entity_runtime_id:int]` |
| `on_disconnect` | 收到 `Disconnect` | `[reason:str]` |
| `on_disconnect_event` | 收到 `Disconnect` 并主动断开 | `[reason:str]` |
| `on_authentication_result` | 登录鉴权返回 | `[status, decrypted:str]` |
| `on_start_ready` | 客户端启动完成 | `[]` |
| `on_init_uni_sdk` | 初始化 UniSDK | `[]` |
| `unisdk_start_up` | UniSDK 启动 | `[code, sauth_json?]` |

### TextParsed

```python
[
    type,                 # int
    source_name,          # str
    message,              # str
    parameters,           # list[str]
    xuid,                 # str
    platform_chat_id,     # str
    filtered_message,     # str
    needs_translation,    # bool
]
```

### CommandOutputParsed

```python
[
    messages,       # list[dict]，每项 {success: bool, message: str, parameters: list[str]}
    guid,           # bytes，16 字节
    output_type,    # int
    success_count,  # int
    data_set,       # str
]
```

### on_player_list

参数 `[dict]`，结构：

```python
{
    "action_type": 0,
    "action": "add",              # add / remove
    "action_type_name": "add",
    "count": 1,
    "verified": [True],
    "entries": [
        {
            "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  # 字符串
            "entity_unique_id": 123,
            "entity_unique_id_netease": 123,
            "username": "...",
            "xuid": "...",
            "platform_chat_id": "...",
            "build_platform": 0,
            "teacher": False,
            "host": False,
            "sub_client": False,
            "player_color": 0,
            "skin": { ... },       # 完整皮肤字段
        }
    ],
}
```

## 网络后端事件

### RakNet

| 事件 | 参数 |
| --- | --- |
| `ID_CONNECTION_REQUEST_ACCEPTED` | `[instance_id, address]` |
| `ID_DISCONNECTION_NOTIFICATION` | `[instance_id]` |
| `ID_CONNECTION_LOST` | `[instance_id]` |
| `ID_CONNECTION_ATTEMPT_FAILED` | `[instance_id]` |
| `on_raknet_message` | `[instance_id, body:str, address:str]` |

需要原始二进制时用 `_raknet.ReceivePacket()`。

### WebSocket

| 事件 | 参数 |
| --- | --- |
| `websocket_message` | `[event_id:int, content:str]` |
| `websocket_connection` | `[event_id:int, connected:bool]` |

### NetherNet 大厅

| 事件 | 参数 |
| --- | --- |
| `on_nethernet_ws_closed` | `[exit_code:int]` |
| `on_nethernet_ws_timeout` | `[exit_code:int]` |
| `on_nethernet_connect_timeout` | `[exit_code:int]` |
| `on_nethernet_webrtc_timeout` | `[exit_code:int]` |
| `on_nethernet_disconnected` | `[exit_code:int]` |

## OnTextPacket —— 聊天消息

`proton.py` 解析 `TextPacket` 后会触发 `OnTextPacket` 用户事件，回调收到 `[dict]`：

```python
def on_text(args):
    data = args[0]
    # data 字段：type, needs_translation, source_name, message,
    #           parameters, xuid, platform_chat_id, filtered_message
    print(data["type"], data["source_name"], data["message"])

engine.register(on_text, "OnTextPacket")
```

::: tip 两个事件不要混淆
| 事件 | 参数 |
| --- | --- |
| `OnTextPacket` | `[dict]` |
| `on_text` | `[source_name, message, msg_type, parameters]` |
| `TextParsed` | `[type, source_name, message, parameters, xuid, platform_chat_id, filtered_message, needs_translation]` |

三者都会被触发，按需要的字段选择。
:::

### TextPacket type 值

| 值 | 常量 | 说明 |
| --- | --- | --- |
| 0 | `RAW` | 原始文本 |
| 1 | `CHAT` | 聊天消息 |
| 2 | `TRANSLATION` | 翻译文本 |
| 3 | `POPUP` | 弹窗 |
| 4 | `JUKEBOX` | 唱片机 |
| 5 | `TIP` | 提示 |
| 6 | `SYSTEM` | 系统消息 |
| 7 | `WHISPER` | 私信 |
| 8 | `ANNOUNCEMENT` | 公告 |
| 9 | `OBJECT` | JSON 对象文本 |
| 10 | `COMMAND` | 指令反馈（`message` 为指令键名，`parameters` 为参数列表） |

## 插件间通信

事件系统也是插件之间的总线：

```python
# 插件 A 发送
engine.trigger("PluginA_Ready", [some_data])

# 插件 B 接收
def on_ready(args):
    data = args[0]

engine.register(on_ready, "PluginA_Ready")
```

## 重载后会不会重复注册？

不会：

- **单插件重载**：先精准注销该插件所有事件再重新执行
- **全量重载**：`cleanup_user()` 清空所有用户事件，`clear_all_user_protocol_event()` 清空用户协议事件

内核事件（kernel）不受影响。

## 排查「事件不响应」

1. 确认用的是 `engine.register(cb, name)`，不是 `register_kernel_event`。
2. 确认事件名大小写完全一致。
3. 确认回调至少接收 1 个参数。
4. 协议事件确认第三个参数是 `False`。
5. 回调异常会打印到日志，但不会影响其他回调；查看 `log.txt` 里的 traceback。

## 下一步

- [engine API](/plugin/engine)
- [协议数据包](/plugin/protocol)
- [架构 · 事件系统](/architecture/events)（C++ 视角）
