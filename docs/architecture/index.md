# 整体架构

```text
┌─────────────────────────────────────────────────────────────┐
│  C++ 客户端 (application/)                                   │
│   ├─ 登录链 (LoginAuth / LoginSession / ConnectInstance)     │
│   ├─ 数据包 (PacketBase + 各 packet 类, 网易协议)             │
│   ├─ 回调分发 (CallbackManger: 包 → 触发 Python 事件)         │
│   └─ Python 运行时 (PythonRuntime: 静态链入的 CPython 3.12)  │
├─────────────────────────────────────────────────────────────┤
│  Python 3.12 (部署在 exe 旁 source/)                         │
│   ├─ 标准库 source/Lib/                                      │
│   ├─ 框架入口 source/init.py                                 │
│   ├─ 框架实现 source/ntvector/ (插件管理、RPC 校验、打包)     │
│   ├─ 插件 scripts/<name>/__init__.py                         │
│   └─ 类型桩 source/Lib/site-packages/*.pyi (IDE 补全)        │
└─────────────────────────────────────────────────────────────┘
```

::: info 解释器是静态链接进 Program.exe 的
exe 旁**没有** `python312.dll`。这与 Python 2.7 时代的形态一致（当年是静态
`python27.lib`，32 MB）。代价是官方 `.pyd` 动态扩展无法加载 —— 详见
[静态链接与扩展限制](/architecture/static-linking)。
:::

## 分层职责

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| **C++ 客户端** | 网络连接、登录鉴权、协议编解码、游戏状态维护、事件分发 | 业务逻辑 |
| **Python 框架**（`source/`） | 加载插件、事件路由、RPC 反作弊校验、数据包解析（`proton.py`） | 协议实现 |

框架代码的模块划分见 [Python 内嵌机制 · 框架模块划分](/architecture/python-runtime#框架模块划分)。
| **插件**（`scripts/`） | 你的业务逻辑 | 连接与协议细节 |

分界点是一套**事件系统**：C++ 侧收到数据包 → 分发给 Python → 插件注册的回调被调用。
插件要主动做事（发指令、移动、打开容器）时，调用 `engine` 等原生模块。

## C++ 侧主要组成

| 组件 | 位置 | 说明 |
| --- | --- | --- |
| 登录链 | `application/Core/` | `LoginAuth` / `LoginSession` / `ConnectInstance` |
| 数据包 | `application/Packets/` | `PacketBase` + 各协议包类 |
| 回调分发 | `application/Core/CallbackManger.cpp` | 协议包 → Python 事件 |
| Python 运行时 | `application/Python/PythonRuntime.cpp` | 解释器初始化、19 个模块注册 |
| 原生 API | `application/PythonAPI/` | pybind11 绑定（`nbt` / `packets` / `game_state`） |
| 网络后端 | `application/Network/` | RakNet / WebSocket / WebRTC / NetherNet |
| 加密 | `application/Crypto/` | AES / ChaCha20 / Rotor / ECC |

## 本节目录

- [Python 内嵌机制](/architecture/python-runtime) —— 解释器怎么起来、模块怎么注册、字符串编码边界
- [静态链接与扩展限制](/architecture/static-linking) —— 为什么没有 `python312.dll`、代价是什么
- [事件系统](/architecture/events) —— C++ → Python 的事件分发规则
- [关键数据包](/architecture/packets) —— `CommandBlockUpdate` / `SettingsCommand` 等易错点
- [RPC 与反作弊校验](/architecture/anti-cheat) —— 服务器如何校验客户端、失败会怎样
