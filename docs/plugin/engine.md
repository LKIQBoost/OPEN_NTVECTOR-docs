# engine API 总览

`engine` 是插件用得最多的模块：事件、游戏交互、坐标视角、服务器信息都在这里。

## 事件注册与触发

| 函数 | 说明 |
| --- | --- |
| `engine.register(cb, event_name)` | 注册事件处理器 |
| `engine.unregister(event_name, cb)` | 注销指定事件 |
| `engine.trigger(event_name [, args])` | 触发事件（同步） |
| `engine.register_protocol_event(id, cb, False)` | 注册用户协议事件 |

完整事件列表见[事件系统](/plugin/events)。

## 游戏交互

| 函数 | 说明 |
| --- | --- |
| `engine.message(text)` | 发送聊天消息（单参数版本） |
| `engine.message(sender, msg)` | 发送聊天消息（`sender` 留空即可，**`msg` 直接支持中文**） |
| `engine.command(cmd_str)` | 发送普通游戏指令 |
| `engine.settingscommand(cmd_str)` | 发送 setting 格式指令（需要管理员 / 控制台权限），**优先使用此函数** |
| `engine.command_guid(cmd_str, guid)` | 发送指令并附带 16 字节 GUID（用于匹配返回） |
| `engine.move(x, y, z)` | 传送玩家到指定坐标 |
| `engine.respawn()` | 复活玩家（Vector 已自动复活，一般无需调用） |
| `engine.send(binary_data)` | 发送原始二进制数据包 |
| `engine.command_update(...)` | 更新命令方块数据（见下） |
| `engine.openContainer(x, y, z)` | 打开容器并返回缓存方块数据（见下） |

## 坐标与视角

| 函数 | 返回值 |
| --- | --- |
| `engine.get_pot_x()` | `float` 当前 X 坐标 |
| `engine.get_pot_y()` | `float` 当前 Y 坐标 |
| `engine.get_pot_z()` | `float` 当前 Z 坐标 |
| `engine.add_pot_x(delta)` | X 坐标偏移 |
| `engine.add_pot_y(delta)` | Y 坐标偏移 |
| `engine.add_pot_z(delta)` | Z 坐标偏移 |
| `engine.get_head_x()` | `float` 头部俯仰角 |
| `engine.get_head_y()` | `float` 头部偏转角 |
| `engine.add_head_x(delta)` | 增加俯仰角 |
| `engine.add_head_y(delta)` | 增加偏转角 |

::: info 服务器未确认时返回 None
坐标和实体状态在服务器尚未确认时返回 `None`。本地发起移动或转向后，
在服务器确认包到达前，对应字段也会暂时返回 `None` —— 不会拿预测值冒充已知状态。
:::

## 服务器 / 进程信息

| 函数 | 返回值 |
| --- | --- |
| `engine.get_server_ip()` | `str` 服务器 IP |
| `engine.get_server_port()` | `int` 服务器端口 |
| `engine.get_entity_runtime_id()` | `int` 玩家实体运行时 ID |
| `engine.getparams()` | `list` 进程启动参数列表 |

## 权限与配置

| 函数 | 说明 |
| --- | --- |
| `engine.disabled_auth_input()` | 启用 authinput（每 tick 发送验证包） |
| `engine.enable_auth_input()` | 关闭 authinput |
| `engine.get_auth_input()` | `bool` 获取当前 authinput 状态 |
| `engine.get_mcp_load_config()` | `bool` 返回当前模式：MCP / 源代码 |

## 系统工具

| 函数 | 说明 |
| --- | --- |
| `engine.system(cmd)` | 执行 Windows cmd 指令 |
| `engine.exit(code)` | 退出进程 |
| `engine.rpc(data)` | 发送 RPC（msgpack bytes） |

## 命令方块更新（command_update）

```python
engine.command_update(x, y, z, command_block_type, redstone, conditional,
                      delay, execute_on_first_tick, command, name)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `x, y, z` | `float` | 命令方块坐标 |
| `command_block_type` | `int` | 0 = 普通、1 = 循环、2 = 脉冲 |
| `redstone` | `bool` | 是否受红石信号触发 |
| `conditional` | `bool` | 是否为条件命令方块（有条） |
| `delay` | `int` | 延迟 tick |
| `execute_on_first_tick` | `bool` | 是否首个 tick 立即执行 |
| `command` | `str` | 命令方块内执行的指令 |
| `name` | `str` | 命令方块名称 |

```python
# 在坐标 (106, 93, 69) 放置循环命令方块（type=1），执行 /say
engine.command_update(106, 93, 69, 1, False, False, 0, True, "/say VectorCommandUpdate", "Vector")
```

> 需要先确保该坐标有命令方块（可用 `setblock` 放置），且玩家有操作权限。

::: warning 协议字段顺序有坑
这个包的线格式里 `filtered_name` 必须位于 `name` 之后、`should_track_output` 之前，
缺失会导致服务端解析越界并踢人。详见[关键数据包](/architecture/packets)。
:::

## 打开容器（openContainer）

```python
data = engine.openContainer(x, y, z)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `x, y, z` | `int` | 容器方块坐标 |

返回 `dict`：

```python
{
    "x": 106, "y": 93, "z": 69,
    "success": True,
    # 该坐标已缓存的方块实体数据（告示牌文本、命令方块命令等），未缓存为 None
    "block_data": {
        "nbt": {"id": "Chest", "CustomName": "..."},   # 已展开的 NBT 扁平字典
        "nbt_len": 123,                                # 原始 NBT 字节数
        "raw_nbt": "0a000b..."                         # 原始 NBT 十六进制
    } | None,
    # 该坐标容器的已缓存内容（打开过才会缓存），未缓存为 None
    "container": {
        "window_id": 2,
        "window_type": 0,                            # WindowType 枚举（0 = 普通容器）
        "entity_unique_id": 0,
        "slots": [
            {"network_id": 276, "count": 1, "metadata": 0,
             "block_runtime_id": 0, "has_stack_id": False, "stack_id": 0,
             "extra_hex": ""}
        ]
    } | None
}
```

说明：

- 函数发送 `InventoryTransactionPacket`（use_item / click_block）请求打开容器。
- 服务端随后推送 `ContainerOpenPacket`(46) + `InventoryContentPacket`(49)，
  客户端会**自动解析并缓存**；容器内容到达后再次调用 `openContainer` 即可在
  `container.slots` 中拿到完整槽位。
- 方块实体数据（告示牌、命令方块）由 `BlockActorDataPacket`(56) 推送时
  自动缓存到 `block_data`。
- 想拿原始数据包，可用 `engine.register_protocol_event(46, cb, False)` /
  `(49, ...)` / `(56, ...)` 注册回调，回调参数为数据包原始字节（不含包 ID）。

::: warning 首次调用通常拿不到内容
需要玩家靠近容器且服务端允许交互；`container` 内容依赖服务端下发，
首次调用时通常是 `None`。
:::

## 下一步

- [模块与工具](/plugin/modules)
- [协议数据包](/plugin/protocol)
- [Python 原生接口](/api/reference) —— `nbt` / `packets` / `game_state` 等新接口
