# engine API 总览

`engine` 是插件最常用的原生模块，负责事件、协议回调、聊天 / 指令、移动与视角、服务器信息和底层数据包收发。

本文按 **C++ 导出表**（`application/Python/engine.cpp`）逐项对照，函数名、参数顺序与返回值均以当前源码为准。

## 事件注册与触发

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `engine.register(callback, event_name)` | `None` | 注册用户事件；回调必须至少接收 1 个位置参数 |
| `engine.register_kernel_event(callback, event_name)` | `None` | 注册内核事件，**仅框架使用**，插件不要调用 |
| `engine.unregister(event_name, callback=None)` | `bool` | 省略 `callback` 时注销该事件的全部回调 |
| `engine.is_registered(callback, event_name)` | `bool` | 注意参数顺序是「回调在前」 |
| `engine.get_event_handler_count(event_name)` | `int` | 指定事件的回调数量 |
| `engine.get_events_info()` | `dict[str, list[int]]` | 事件名 → 回调 ID 列表 |
| `engine.trigger(event_name, args=[])` | `None` | 同步触发事件 |
| `engine.get_handler_count()` | `int` | 所有已注册回调总数 |
| `engine.cleanup_all()` | `None` | 清空全部事件 |
| `engine.cleanup_user()` | `None` | 只清空用户事件 |
| `engine.cleanup_kernel()` | `None` | 只清空内核事件 |

回调签名固定为：

```python
def handler(args):
    ...
```

### trigger 的参数包装

`engine.trigger` 对第二个参数的处理规则：

```python
engine.trigger("Event")                  # 回调收到 []
engine.trigger("Event", [a, b])          # 回调收到 [a, b]
engine.trigger("Event", (a, b))          # 回调收到 (a, b)
engine.trigger("Event", obj)             # 非 list/tuple：回调收到 [obj]
```

所以传 dict 时，下面两种写法等价：

```python
engine.trigger("MyEvent", [my_dict])
engine.trigger("MyEvent", my_dict)
# 回调里 args[0] 都是 my_dict
```

::: tip 真正的「静默丢弃」发生在内部
`engine.cpp::trigger_event` 只接受 list/tuple，但 Python 侧的 `engine.trigger` 会先把非 list/tuple 包装成 `[obj]`，因此插件正常调用不会丢事件。
:::

## 协议事件

| 函数 | 说明 |
| --- | --- |
| `engine.register_protocol_event(packet_id, callback, is_kernel)` | 注册原始协议回调，**三个参数都必填** |
| `engine.register_structured_protocol_event(packet_id, callback, is_kernel=False)` | 注册结构化协议回调 |
| `engine.clear_all_protocol_event()` | 清空全部协议回调 |
| `engine.clear_all_kernel_protocol_event()` | 清空内核协议回调 |
| `engine.clear_all_user_protocol_event()` | 清空用户协议回调 |

插件注册时 `is_kernel` 必须传 `False`：

```python
import engine

def on_packet(data):
    # data 是 bytes，已去掉包 ID
    print(len(data))

engine.register_protocol_event(56, on_packet, False)
```

结构化回调收到一个 dict，详见[结构化协议事件](/api/structured-events)。

## 聊天与指令

| 函数 | 说明 |
| --- | --- |
| `engine.message(sender, message)` | 发送聊天消息，**必须传 2 个参数** |
| `engine.command(command)` | 发送普通游戏指令（随机 16 字节 UUID） |
| `engine.command_guid(command, guid)` | 发送指令并指定 16 字节 GUID |
| `engine.settingscommand(command)` | 发送 `SettingsCommand`（需要管理员 / 控制台权限） |
| `engine.send(data)` | 发送原始二进制数据 |
| `engine.rpc(data)` | 发送 `PyRpc`（msgpack bytes） |
| `engine.do_login()` | 调用网易 UniSDK 登录；未链接 UniSDK 时为空操作 |

```python
engine.message('', '你好，世界')          # sender 可以留空
engine.command('/say hello')
engine.settingscommand('/gamemode creative @s')

import os
engine.command_guid('/say with guid', os.urandom(16))
```

::: warning 没有单参数的 `engine.message`
当前导出表按 `PyArg_ParseTuple(args, "ss", ...)` 解析，必须同时传 `sender` 和 `message`。
:::

## 移动与视角

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `engine.move(x, y, z)` | `None` | 发送 `MovePlayer` teleport（mode=2），不依赖 `/tp` 权限 |
| `engine.add_pot_x(delta)` | `None` | X 坐标偏移 |
| `engine.add_pot_y(delta)` | `None` | Y 坐标偏移 |
| `engine.add_pot_z(delta)` | `None` | Z 坐标偏移 |
| `engine.get_pot_x()` | `float \| None` | 服务器已确认的 X 坐标 |
| `engine.get_pot_y()` | `float \| None` | 服务器已确认的 Y 坐标 |
| `engine.get_pot_z()` | `float \| None` | 服务器已确认的 Z 坐标 |
| `engine.add_head_x(delta)` | `None` | 俯仰角（pitch）偏移 |
| `engine.add_head_y(delta)` | `None` | 偏转角（yaw）偏移 |
| `engine.get_head_x()` | `float \| None` | 服务器已确认的俯仰角 |
| `engine.get_head_y()` | `float \| None` | 服务器已确认的偏转角 |
| `engine.respawn()` | `None` | 主动发送复活相关数据包（Vector 通常会自动复活） |

::: info None 表示「服务器尚未确认」
`move` / `add_pot_*` / `add_head_*` 会立刻修改本地预测值，但在服务器确认包到达前，
`get_pot_*` 与 `get_head_*` 返回 `None`，不会用预测值冒充已确认状态。
:::

## 按键输入

| 函数 | 说明 |
| --- | --- |
| `engine.key_down(name)` | 按住某个输入 |
| `engine.key_up(name)` | 松开某个输入 |

支持的名字：

```text
ascend  descend  jump  sprint  sneak
forward  backward  left  right
forward_left  forward_right
sprinting  sneaking
```

```python
engine.key_down("forward")
# ... 等待若干个 tick
engine.key_up("forward")
```

- 未知名字抛 `ValueError`。
- 连接不可用时抛 `api_errors.ConnectionError`。
- 这些输入只有在 **authinput 开启**（`engine.enable_auth_input()` 或启动参数 `--auto_auth_input`）时，才会由每 tick 的 `PlayerAuthInput` 持续发送。

## authinput 开关

| 函数 | 说明 |
| --- | --- |
| `engine.enable_auth_input()` | 开启每 tick 自动发送 `PlayerAuthInput` |
| `engine.disabled_auth_input()` | 关闭每 tick 自动发送（函数名是历史遗留的 `disabled`） |
| `engine.get_auth_input()` | 返回当前状态 |

::: warning 两个函数名看起来相反
`enable_auth_input()` → `SetSourceAuthInput(true)` → **开启**自动 authinput。

`disabled_auth_input()` → `SetSourceAuthInput(false)` → **关闭**自动 authinput。

关闭后，`move` / `add_pot_*` / `add_head_*` 会通过手动 `updateLocalPlayerStateOnServer()` 同步状态。
:::

## 服务器 / 进程信息

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `engine.get_server_ip()` | `str` | 服务器 IP |
| `engine.get_server_port()` | `int` | 服务器端口 |
| `engine.get_server_sid()` | `str` | 网易服务器 ID（SID） |
| `engine.get_entity_runtime_id()` | `int \| None` | 本地玩家实体运行时 ID |
| `engine.getparams()` | `list[str]` | 进程启动参数列表 |
| `engine.get_mcp_load_config()` | `bool` | 当前是否使用 MCP 加载模式 |

## 系统工具

| 函数 | 说明 |
| --- | --- |
| `engine.system(cmd)` | 执行 Windows `system()` 命令 |
| `engine.exit(code=0)` | 结束进程；当前实现会忽略传入参数，固定以 `0` 退出 |
| `engine.system` / `engine.exit` 请谨慎使用 | 会影响整个客户端进程 |

## 子区块方块查询

```python
blocks = engine.get_subchunk_blocks(origin_x, origin_y, origin_z, offsets)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `origin_x, origin_y, origin_z` | `int` | 子区块原点（通常是 `chunk_x * 16, section_y * 16, chunk_z * 16`） |
| `offsets` | `list[tuple[int, int, int]]` | 相对原点的子区块偏移，每个分量按 `int8` 处理 |

返回 `list[dict]`：

```python
[
    {
        "x": 0, "y": 64, "z": 0,
        "name": "minecraft:stone",
        "states": {"stone_type": "stone"}   # dict
    }
]
```

- 该调用会阻塞等待服务器响应，等待期间释放 GIL。
- 请求失败或超时会抛 `api_errors.ConnectionError`。
- 异步版本见 `game_state.request_subchunks_async()`；注意它的 `states` 是 JSON 字符串。

## 命令方块更新（command_update）

```python
engine.command_update(
    x, y, z,
    command_block_type,
    needs_redstone,
    conditional,
    tick_delay,
    execute_on_first_tick,
    command,
    name,
)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `x, y, z` | `int` | 命令方块坐标 |
| `command_block_type` | `int` | `0` = 脉冲（Impulse）、`1` = 循环（Repeating）、`2` = 链（Chain） |
| `needs_redstone` | `bool` | 是否需要红石激活 |
| `conditional` | `bool` | 是否为条件命令方块 |
| `tick_delay` | `int` | 延迟 tick |
| `execute_on_first_tick` | `bool` | 是否首个 tick 立即执行 |
| `command` | `str` | 命令方块内执行的指令 |
| `name` | `str` | 命令方块名称 |

```python
# 在 (106, 93, 69) 放置循环命令方块并执行 /say
engine.command_update(
    106, 93, 69,
    1,          # 循环
    False,      # 不需要红石
    False,      # 非条件
    0,          # 无延迟
    True,       # 首个 tick 执行
    "/say VectorCommandUpdate",
    "Vector",
)
```

- `filtered_name` 由 C++ 侧自动填空字符串，`should_track_output` 固定为 `false`。
- 需要该坐标已经有命令方块，且玩家有操作权限。

## 打开容器（openContainer）

```python
data = engine.openContainer(x, y, z)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `x, y, z` | `int` | 容器方块坐标 |

返回缓存快照：

```python
{
    "x": 106, "y": 93, "z": 69,
    "success": True,

    # 该坐标已缓存的方块实体数据，未缓存时为 None
    "block_data": {
        "nbt": {"id": "Chest", "CustomName": "..."},  # 扁平后的字段字典
        "nbt_len": 123,                               # 原始 NBT 字节数
        "raw_nbt": "0a000b..."                        # 原始 NBT 十六进制字符串
    } | None,

    # 该坐标容器的已缓存内容，未打开过时为 None
    "container": {
        "window_id": 2,
        "window_type": 0,              # WindowType 枚举
        "entity_unique_id": 0,
        "slots": [
            {
                "network_id": 276,
                "count": 1,
                "metadata": 0,
                "block_runtime_id": 0,
                "has_stack_id": False,
                "stack_id": 0,
                "extra_hex": "",       # 额外数据，十六进制字符串
            }
        ]
    } | None,
}
```

行为说明：

- 发送 `InventoryTransaction`（`use_item` / `click_block`）请求打开容器。
- 服务端随后推送 `ContainerOpen`(46) + `InventoryContent`(49)，C++ 侧自动缓存；
  内容到达后再次调用即可拿到 `container.slots`。
- `BlockActorData`(56) 会缓存到 `block_data`。
- 本地玩家坐标尚未被服务器确认时，调用会抛 `api_errors.ConnectionError`。
- 首次调用通常只能拿到 `None`，需要玩家靠近容器且服务端允许交互。

::: tip 想要实时原始包
用 `engine.register_protocol_event(46, cb, False)` / `(49, ...)` / `(56, ...)`
注册回调，回调参数为不含包 ID 的 `bytes`。
:::

## 下一步

- [模块与工具](/plugin/modules)
- [协议数据包](/plugin/protocol)
- [Python 原生接口](/api/reference)
