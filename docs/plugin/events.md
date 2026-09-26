# 事件系统

## 注册规则（必须遵守）

| 写法 | 说明 |
| --- | --- |
| `engine.register(cb, "事件名")` | ✅ **唯一合法**的用户事件注册方式 |
| `engine.register_kernel_event(cb, "事件名")` | ❌ **禁止使用**，仅 `init.py` 可用 |
| `engine.register_protocol_event(id, cb, True)` | ❌ **禁止使用**（kernel 协议事件），仅 `proton.py` 可用 |
| `engine.register_protocol_event(id, cb, False)` | ✅ 注册用户协议事件，重载时自动清除 |

回调签名固定：

```python
def handler(args):
    ...
```

## 触发时的参数规则

```python
engine.trigger("事件名")              # 无参数，回调收到 []
engine.trigger("事件名", [a, b])      # 回调收到 [a, b]
engine.trigger("事件名", some_obj)    # 非 list/tuple 会被包成 [some_obj]
```

::: warning C++ 侧要求 args 是 list/tuple
`engine.cpp::trigger_event` 对非 list/tuple 的参数**静默丢弃** —— 回调不会触发，
也没有任何报错。这是排查「事件不响应」时的第一怀疑对象。

传 dict 请自己包一层：

```python
engine.trigger("MyEvent", [my_dict])   # ✅ args[0] 是 my_dict
engine.trigger("MyEvent", my_dict)     # ❌ 回调收到 [[my_dict]]
```
:::

## 系统内置事件

| 事件 | 触发时机 | 说明 |
| --- | --- | --- |
| `ModEventStartUp` | 所有插件加载完成后 | 适合做初始化 |
| `ModEventUnInit` | 全量重载前 | 应在此停止后台线程 |
| `on_respawn` | 玩家死亡后 | — |
| `on_move_player` | `/tp` 传送自身后 | 参数：`[x, y, z]` 坐标列表 |
| `on_command_output` | 发送指令后（`proton.py` 触发） | 参数：`[返回值, GUID]` |
| `on_player_list` | 进入服务器后 | 参数：`[玩家列表]` |
| `on_text` | 收到聊天栏消息后（`proton.py` 触发） | 参数：`[source_name, message, msg_type, parameters]` |
| `on_disconnect` | 与服务器断开连接后 | — |
| `on_rpc` | 收到远程调用后 | 内核事件，框架已处理（`ntvector/mcp_check.py`） |

`on_command_output` 的返回值形如 `[[键, [参数...]], ...]`。

## OnTextPacket —— 聊天消息

`proton.py` 解析 `TextPacket` 后会触发 `OnTextPacket` 用户事件，回调收到 `[dict]`：

```python
def on_text(args):
    data = args[0]
    # data 字段：type, needs_translation, source_name, message,
    #           parameters, xuid, platform_chat_id, filtered_message
    # 注意：source_name / message 已经是 str（Unicode），可直接使用

engine.register(on_text, "OnTextPacket")
```

::: tip 两个事件不要混淆
| 事件 | 参数 |
| --- | --- |
| `OnTextPacket` | `[dict]` |
| `on_text` | `[source_name, message, msg_type, parameters]` |

两者都会被触发。用哪个看你要不要 `type` / `xuid` 这些字段。
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
| 10 | `COMMAND` | 指令反馈（`message` 为指令键名，`parameters` 为指令参数列表） |

::: details type=10 (COMMAND) 有什么用
`message` 是指令键名（如 `commands.give.success`），`parameters` 是指令参数列表。
可以拿它做本地化的指令反馈文案 —— 服务器不直接给你成品字符串。
:::

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
- **全量重载**：`cleanup_user()` 清空所有用户事件

## 下一步

- [engine API](/plugin/engine)
- [协议数据包](/plugin/protocol)
- [架构 · 事件系统](/architecture/events)（C++ 视角）
