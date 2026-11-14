# 事件系统

分界点就是这个：C++ 侧收到协议包 → 分发成 Python 事件 → 插件注册的回调被调用。

## C++ → Python

实现在 `application/Python/engine_wrapper.h` 的 `PythonEventEngine`。

### 两个触发入口

| 接口 | 用途 |
| --- | --- |
| `trigger(event, args...)` | 模板，自动把 C++ 类型转成 Python 对象，**包成 list** |
| `triggerBytes(event, std::string binary)` | **二进制事件必须用这个** |

::: danger `triggerBytes` 不是可选项
`trigger` 传 `std::string` 会被当作 **UTF-8 文本**解码。传二进制（比如 `on_rpc` 的
msgpack 数据）必须走 `triggerBytes`，它把 bytes 包成 `[bytes]`。
:::

### 参数形状是硬约束（仅限内部接口）

`engine.cpp::trigger_event` **要求 args 是 list/tuple，否则静默丢弃** —— 回调根本不会触发，
而且没有任何报错。这是 C++ 侧调用时必须遵守的规则。

Python 侧的 `engine.trigger` 已经做了包装：非 list/tuple 会转成 `[obj]`，
所以插件正常调用不会丢事件。

## Python 侧注册

| 接口 | 谁可以用 |
| --- | --- |
| `engine.register(cb, "事件名")` | **插件唯一合法**的用户事件注册方式 |
| `engine.register_kernel_event(cb, "事件名")` | 仅 `init.py` 可用 |
| `engine.register_protocol_event(id, cb, False)` | 插件注册用户协议事件，重载时自动清除 |
| `engine.register_protocol_event(id, cb, True)` | 内核协议事件，仅 `proton.py` 可用 |

回调签名固定：`def handler(args)`，`args` 是 list。

```python
def on_start(args):
    print('loaded')

engine.register(on_start, "ModEventStartUp")
```

## 触发时的参数包装规则

```python
engine.trigger("事件名")              # 无参数，回调收到 []
engine.trigger("事件名", [a, b])      # 回调收到 [a, b]
engine.trigger("事件名", some_obj)    # 非 list/tuple 会被包成 [some_obj]
```

::: warning 传 dict 无需额外包装
```python
engine.trigger("MyEvent", [my_dict])   # 回调收到 [my_dict]，args[0] 是 my_dict
engine.trigger("MyEvent", my_dict)     # 非 list/tuple，被包装成 [my_dict]，结果相同
```
:::

## 框架事件一览

由 `source/` 下的 Python 框架触发：

| 事件 | 触发时机 | 参数 |
| --- | --- | --- |
| `ModEventStartUp` | 所有插件加载完成后 | `[]` |
| `ModEventUnInit` | 全量重载前 | `[]` |
| `OnTextPacket` | 收到聊天 / 文本消息后（`proton.py`） | `[dict]` |
| `on_text` | 收到聊天栏消息后（`proton.py`） | `[source_name, message, msg_type, parameters]` |
| `on_command_output` | 发送指令后（`proton.py`） | `[返回值, GUID]`，返回值形如 `[[键, [参数...]], ...]` |
| `on_rpc` | 收到远程调用后 | `[bytes]`，内核事件，框架已处理 |

## C++ 原生事件一览

| 事件 | 触发时机 | 参数 |
| --- | --- | --- |
| `start_game` | 收到 `StartGame` 并完成初始化 | `[0]` |
| `on_play_status` | 收到 `PlayStatus` | `[status]` |
| `on_resource_packs_info` | 收到资源包信息 | `[0]` |
| `on_player_list` | 收到 `PlayerList` | `[player_list:dict]` |
| `TextParsed` | 收到 `Text` | `[type, source_name, message, parameters, xuid, platform_chat_id, filtered_message, needs_translation]` |
| `CommandOutputParsed` | 收到 `CommandOutput` | `[messages, guid, output_type, success_count, data_set]` |
| `on_move_player` | 本地玩家移动被服务器确认 | `[x, y, z]` |
| `on_respawn` | 收到 `Respawn` | `[state, entity_runtime_id]` |
| `on_disconnect` | 收到 `Disconnect` | `[reason]` |
| `on_disconnect_event` | 收到 `Disconnect` 并主动断开 | `[reason]` |
| `on_authentication_result` | 登录鉴权返回 | `[status, decrypted]` |
| `on_start_ready` | 客户端启动完成 | `[]` |
| `on_init_uni_sdk` | 初始化 UniSDK | `[]` |
| `unisdk_start_up` | UniSDK 启动 | `[code, sauth_json]` |

网络后端还会触发 RakNet / WebSocket / NetherNet 事件，完整列表见
[事件系统 · 网络后端事件](/plugin/events#网络后端事件)。

## 事件分发顺序

```text
协议包到达
  → CallbackManger 分发
  → proton.py 的协议事件回调（解析）
  → proton.py 触发高层事件（如 OnTextPacket / on_text）
  → 插件注册的回调
```

## 插件间通信

事件系统同时也是插件之间的总线：

```python
# 插件 A 发送
engine.trigger("PluginA_Ready", [some_data])

# 插件 B 接收
def on_plugin_a_ready(args):
    data = args[0]

engine.register(on_plugin_a_ready, "PluginA_Ready")
```

## 重载时的事件清理

不用担心重复注册：

- **单插件重载**：框架（`ntvector/plugins.py`）先精准注销该插件注册的所有事件，再重新执行插件代码
- **全量重载**：`engine.cleanup_user()` 清空所有用户事件 +
  `engine.clear_all_user_protocol_event()` 清空用户协议事件

内核事件（`kernel`）不受影响，所以框架自己的回调不会被插件重载波及。

## 下一步

- [关键数据包](/architecture/packets)
- [RPC 与反作弊校验](/architecture/anti-cheat)
- [插件开发 · 事件系统](/plugin/events)（用户视角）
