# 项目概览

> 网易我的世界基岩版机器人客户端（Vector），基于 **C++17** 与 **CMake** 构建，
> 内嵌 **Python 3.12.2** 运行插件（已从 Python 2.7 完成迁移）。

主要开发/运行平台为 **Windows (MSVC)**；Linux x86_64 / Android (Termux) 曾支持，
但 Py3 迁移后尚未同步（见[构建 · 其他平台](/guide/build#其他平台)）。
所有第三方 C/C++ 依赖均随仓库提供并从源码编译，构建时**无需外部包管理器、无需联网**。

## 主要特性

- **Minecraft 基岩版协议客户端**：登录 / 鉴权 / 数据包编解码
- **多种网络后端**
  - SLikeNet（RakNet 魔改分支）— 联机通信
  - libwebsockets — WebSocket 协议
  - libdatachannel — WebRTC DataChannel（含 libjuice / libsrtp / usrsctp）
  - NetherNet 连接模式（`--start_nethernet`）
- **内嵌 Python 3.12.2 运行时**：19 个内置模块（`engine` / `setting` / `mod_log` /
  `utility` / `pkt` / `aes` / `_chacha` / `_websocket` / `rotor` / `fop` / `_client` /
  `client_instance` / `easy_utils` / `_raknet` / `tan_lobby_game_clicpp_wrapper` /
  `api_errors` / `nbt` / `packets` / `game_state`）
- **自包含解释器**：CPython 核心静态链进 `Program.exe`，运行时不需要 `python312.dll`
- **插件热重载**：source 模式下每 1.5 秒扫描 `scripts/` 变更，保存即生效
- **加密与鉴权**：AES-GCM / AES-CTR / AES-ECB、ChaCha20、Rotor、ECC / ECDSA 密钥交换、Base64
- **MCP 文件系统模式**：可由 `client_cfg.json` 中的 `no_launch_mcp` 字段控制（MCP 为遗留功能）
- **皮肤系统**：皮肤数据解析、皮肤 / 模型文件加载与转换

## 环境要求

| 平台 | 要求 |
| --- | --- |
| **Windows**（主平台） | Visual Studio 2026（MSVC，需 `v145` 工具集）、CMake 4.x（最低 3.20）、**宿主 Python ≥ 3.10**（仅 configure 期用） |
| **Linux x86_64** | 历史支持（clang / gcc）；Py3 迁移 + 静态化后构建脚本待更新 |
| **Android ARM64** | 历史支持（Termux 原生编译）；同上待更新 |

::: info 关于那个「宿主 Python」
它**不参与链接**，只在 configure 期被 `cmake/BuildPython312.cmake` 调用来跑
`Tools/build/deepfreeze.py` 生成冻结模块。版本不必与 3.12.2 一致，≥ 3.10 即可。
不指定时自动探测（PATH → `%LOCALAPPDATA%\Programs\Python\Python312` → `py -3`）。
:::

## 项目结构

```text
NTVECTOR_Platform/
├── CMakeLists.txt              # 根 CMake 配置
├── application/                # 主程序源码（目标名：Program）
│   ├── Core/ Crypto/ Network/ Packets/ NBT/ platform/   # 协议、网络、登录、加密等
│   ├── Python/                 # PythonRuntime.cpp（解释器初始化 / 模块注册）等
│   ├── PythonAPI/              # NBT、数据包、game_state 等 pybind11 绑定
│   │   └── Stubs/              # 类型桩（*.pyi，供 IDE 补全）
│   └── include/                # SLikeNet、zlib、pybind11、OpenSSL
├── cmake/                      # FindPrebuiltDeps / BuildOpenSSL / toolchains 等
│   ├── BuildPython312.cmake    # configure 期编出静态 CPython 核心库
│   └── PythonBuiltinModules.cmake  # 编进 exe 的 stdlib C 扩展白名单
├── docs/                       # 文档（已迁移到独立 VitePress 站点）
├── third_party/                # 第三方依赖源码
│   ├── jsoncpp/ libdatachannel/ libwebsockets/ ...
│   └── Python-3.12.2/          # CPython 源码（用于静态核心；含 PCbuild 工程）
└── tools/                      # 辅助脚本与原生测试
```

## 依赖

所有 C/C++ 依赖均随仓库提供并从源码编译，构建过程不需要联网下载。

| 库 | 版本 | 构建方式 |
| --- | --- | --- |
| Python | 3.12.2 | 源码在 `third_party/Python-3.12.2`，configure 期编出静态核心库（`cmake/BuildPython312.cmake`）链进 `Program.exe` |
| OpenSSL | 3.5.0 | cmake 配置期自动构建；Windows 上 Perl 不可用时回退到项目自带 `.lib` |
| jsoncpp | 1.9.6 | `add_subdirectory` |
| libdatachannel | 最新 | `add_subdirectory`（含 libjuice / libsrtp / usrsctp） |
| libwebsockets | 4.5 | `add_subdirectory` |
| SLikeNet | 定制（RakNet 魔改） | `add_subdirectory` |
| zlib | 1.3.1 | `add_subdirectory` |

## 内嵌 Python 模块（19 个）

| 模块 | 用途 |
| --- | --- |
| `engine` | 事件 / 指令 / 坐标 / RPC |
| `setting` | 玩家 / 版本信息 |
| `mod_log` | 日志 |
| `utility` | 加解密 |
| `pkt` | 协议数据包读写 |
| `aes` | AES-128-ECB |
| `_chacha` | ChaCha20 |
| `_websocket` | WebSocket |
| `rotor` | Rotor 加密 |
| `fop` | MCP 文件（遗留） |
| `_client` | 客户端实例（遗留） |
| `client_instance` | pybind11 包装 |
| `easy_utils` | pybind11 加解密 |
| `_raknet` | RakNet（遗留） |
| `tan_lobby_game_clicpp_wrapper` | NetherNet（运行时注册） |
| `api_errors` | 原生接口共享异常 |
| `nbt` | 强类型 NBT 读取 / 修改 / 序列化 |
| `packets` | 协议对象（`CommandRequest` / `Packet`） |
| `game_state` | 已确认的游戏状态查询 |

接口细节见 [Python 原生接口](/api/reference)。

## 编进 exe 的 stdlib C 扩展

静态嵌入下没有 `.pyd` 可加载，CPython 3.12 拆出去的那批 stdlib C 扩展必须编进
`Program.exe` 并注册为 builtin。白名单是 `cmake/PythonBuiltinModules.cmake` 里的一张表，
**加一行 + 重编即可增删**：

`_socket` `select` `_queue` `zlib` `_hashlib` `unicodedata` `_overlapped` `_zoneinfo`
`winsound` `_asyncio` `_uuid` `_multiprocessing` `pyexpat` `_elementtree`

其余大部分（`binascii` / `_struct` / `_json` / `_pickle` / `_random` / `_thread` /
`_sre` / `_csv` / `_datetime` / `math` / `cmath` / `array` / `mmap` / `signal` /
`_winapi` / `winreg` / `cjkcodecs` 等 74 个）本来就是核心内建。

::: warning 需要额外引入第三方源码才能加的
`_bz2`（libbz2）、`_lzma`（liblzma）、`_sqlite3`（sqlite3）、`_ctypes`（libffi）、
`_decimal`（除 libmpdec 外还要 MASM 汇编）、`_tkinter`（Tcl/Tk + 运行时脚本库）。
这些**不在**当前白名单内。详见[静态链接与扩展限制](/architecture/static-linking)。
:::

## 配置文件

| 文件 | 作用 |
| --- | --- |
| `mc.cfg` | 启动配置（JSON）：`room_info`（服务器 IP / 端口）、`player_info`（账号 / 昵称 / token）、`misc`（鉴权服务器地址、引擎版本、网易 SID 等）、`skin_info`（皮肤 / 模型路径） |
| `client_cfg.json` | 客户端配置（JSON）：`no_launch_mcp` 是否启用 MCP 文件系统模式（旧 `options.txt` 已并入） |
| `skin_data.json` | 皮肤数据 |

> 旧版本中的 `options.txt` 已废弃并入 `client_cfg.json`。

## 命令行参数

| 分类 | 参数 | 作用 |
| --- | --- | --- |
| 启动 | `--config <file>` | 指定启动配置文件（默认 `mc.cfg`） |
| | `--start_nethernet` | NetherNet 直连模式启动 |
| | `--do_main <event>` | 触发指定主事件 |
| | `--start_from_launcher=1` | 由启动器拉起 |
| 账号 / 鉴权 | `--UserID <id>` | 用户 ID |
| | `--DisplayName <name>` | 显示名称 |
| | `--MD5Token <token>` | 鉴权 token |
| | `--xuid <xuid>` | Xbox / 网易 XUID |
| | `--operator_name <name>` | 操作员名称 |
| | `--operator_uid <uid>` | 操作员 UID |
| | `--AuthServerUrl <url>` | 鉴权服务器地址 |
| | `--auto_auth_input` | 自动鉴权输入 |
| 服务器 | `--ServerIP <ip>` | 服务器 IP |
| | `--ServerPort <port>` | 服务器端口 |
| | `--NeteaseServerID <sid>` | 网易服务器 SID |
| | `--HostNethernetId <id>` | 主机 NetherNet 会话 ID |
| | `--FromNethernetId <id>` | 来源 NetherNet 会话 ID |
| 版本 | `--protocol <ver>` | 协议版本号 |
| | `--EngineVersion <ver>` | 引擎版本 |
| | `--PatchVersion <ver>` | 补丁版本 |
| | `--ExpandParams <params>` | 附加参数 |
| 皮肤 | `--skin_image_path <path>` | 皮肤图片文件路径 |
| | `--skin_model_path <path>` | 皮肤模型文件路径 |
| | `--operator_client_data <file>` | 指定客户端数据文件 |
| 调试 / 行为 | `--logger` | 启用日志 |
| | `--disout` | 出错即退出 |
| | `--script_mcp` | 启用 MCP 模式 |
| | `--no_request_chunk` | 不请求区块 |
| | `--g79` | 平台模式（g79） |
| | `--pause` | 暂停并等待输入 |

## 验证运行

```bash
Program.exe --config mc.cfg --logger
Program.exe --start_nethernet --UserID xxx --DisplayName xxx --MD5Token xxx
```

- 日志：`log.txt`（完整）、`dis.log`（断开 / 封禁）
- `PlayStatus value: 3` = **PlayerSpawn（正常进服）**，不是错误；`0` = 登录成功；
  `1/2/4/5/6` 才是失败
- 反作弊封禁「因违规游戏行为，您的账号被禁止进入游戏」= RPC / MCP 校验链有问题，
  详见 [RPC 与反作弊校验](/architecture/anti-cheat)

## 下一步

- [构建项目](/guide/build)
- [部署与目录布局](/guide/deploy)
- [插件开发](/plugin/)
