---
layout: home

hero:
  name: OPEN_NTVECTOR
  text: 标准网易我的世界机器人
  tagline: C++17 客户端 · 静态嵌入 CPython 3.12 · 插件热重载
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/
    - theme: alt
      text: 插件开发
      link: /plugin/
    - theme: alt
      text: 架构
      link: /architecture/

features:
  - title: 自包含解释器
    details: CPython 3.12.2 编译成静态库直接链进 Program.exe，无需外部依赖。
  - title: 插件热重载
    details: source 模式下每 1.5 秒扫描 scripts/ 变更，改完保存即生效，只重载被修改的插件。
  - title: 四种网络后端
    details: SLikeNet · libwebsockets · libdatachannel（WebRTC DataChannel）· NetherNet 直连。
  - title: 加密与鉴权
    details: AES-GCM / CTR / ECB、ChaCha20、Rotor、ECC / ECDSA 密钥交换、Base64，以及网易 RPC 校验链。
  - title: 构建零联网
    details: OpenSSL、jsoncpp、libdatachannel、libwebsockets、SLikeNet、zlib 以及 CPython 源码全部随仓库提供，从源码编译。
  - title: Python 原生接口
    details: 19 个 C++ 实现的模块（engine / nbt / packets / game_state / pkt / …），附带类型桩供 IDE 补全。
---

## 这是什么

OPEN_NTVECTOR 是一个**网易我的世界基岩版（MCBE）协议客户端**，用 C++17 实现网络、登录与数据包，
内嵌 CPython 3.12.2 执行 Python 插件。

它面向的是**写插件的开发者**：C++ 侧负责协议、连接和状态维护，你只需要写 Python。

```python
# scripts/my_plugin/my_plugin/__init__.py

def on_start(args):
    engine.message('', 'Hello, world!')

engine.register(on_start, "ModEventStartUp")
```

## 从这里开始

| 我想…… | 去看 |
| --- | --- |
| 把项目跑起来 | [项目概览](/guide/) → [构建](/guide/build) → [部署](/guide/deploy) |
| 写一个插件 | [插件开发](/plugin/) |
| 查某个函数怎么用 | [engine API](/plugin/engine) · [Python 原生接口](/api/reference) |
| 搞懂内部怎么实现的 | [架构](/architecture/) |
| 把 Python 2.7 的旧插件迁过来 | [Py2 → Py3 迁移](/reference/migration) |

## 当前状态

| 项目 | 值 |
| --- | --- |
| 协议版本 | `ProtocolVersion = 860`（MCBE **1.21.120**） |
| 内嵌 Python | **CPython 3.12.2**（静态链接，无外部 依赖） |
| C++ 标准 | C++17 |
| 主平台 | Windows（Visual Studio 2026 / MSVC x64） |
| 构建系统 | CMake 4.x（最低 3.20） |
| 第三方依赖 | 全部随仓库提供，构建过程无需包管理器 |

::: tip 一句话理解这个项目
C++ 负责「连上服务器、收发协议包、维护游戏状态」，Python 负责「你的业务逻辑」。
两者之间是 19 个原生模块和一套事件系统。
:::
