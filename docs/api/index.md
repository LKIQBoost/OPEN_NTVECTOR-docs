# Python 原生接口

本部分记录由 C/C++ 实现并嵌入解释器的 Python 接口。
类型声明统一位于 `application/PythonAPI/Stubs`，实现统一位于 `application/PythonAPI`。

## 相对旧接口的新增能力

- `api_errors`：原生接口共享异常
- `nbt`：强类型 NBT 读取、修改和序列化
- `packets`：通过稳定方法访问协议对象
- `game_state`：只返回已经确认存在的游戏状态
- `engine.register_structured_protocol_event`：结构化收包事件
- `_raknet.ReceivePacket`：保留消息 ID 和来源地址的同步收包接口

`game_state` 还提供 `get_players()`、`get_world()`、`get_inventory()` 和
`request_subchunks_async()`；后者返回支持 `done()`、`result()`、`cancel()` 和
`cancelled()` 的请求句柄。

## 运行时注册的 19 个模块

均有对应类型桩：

`engine`、`setting`、`mod_log`、`utility`、`pkt`、`aes`、`_chacha`、`_websocket`、
`rotor`、`fop`、`_client`、`client_instance`、`easy_utils`、`_raknet`、
`tan_lobby_game_clicpp_wrapper`、`api_errors`、`nbt`、`packets`、`game_state`

完整函数和类列表见[接口参考](/api/reference)。

## 异常体系

原生接口异常都继承自 `api_errors.BotApiError`：

| 异常 | 适用范围 |
| --- | --- |
| `NbtError` | NBT 数据损坏、编码失败、限制超出 |
| `PacketError` | 数据包格式错误或协议对象字段错误 |
| `ConnectionError` | RakNet、WebSocket 或当前游戏连接不可用 |
| `CryptoError` | AES、ChaCha 等加密操作失败 |
| `ClientError` | 登录或客户端初始化失败 |
| `TimeoutError` | 异步请求在指定时间内没有完成 |

::: tip 参数错误仍用标准异常
参数**类型**错误使用 Python 标准的 `TypeError`，参数**数值或长度**不合法时使用
`ValueError`。

这样是为了区分「调用方式错误」（你的代码问题）和「底层接口 / 协议失败」
（环境或服务器问题）。
:::

## 类型桩

类型桩统一安装到运行时的 `source/Lib/site-packages`，供 IDE 补全。

开发环境也可以直接把 `application/PythonAPI/Stubs` 加入 IDE 的额外类型检查路径。

## 状态查询的语义

::: warning None 表示「不知道」，不是「空」
状态查询使用 `None` 表示信息不存在或尚未从服务器收到。

**空列表、坐标零值和实体 ID 零不会被用来伪装未知信息。**

本地发起移动或转向后，在服务器确认包到达前，对应字段也会暂时返回 `None`。
:::

## 本节目录

- [接口参考](/api/reference) —— 19 个模块的完整函数 / 类列表
- [原生模块速查](/api/native-modules) —— NBT / CommandRequest / game_state 用法示例
- [结构化协议事件](/api/structured-events) —— 收包事件的字段结构
