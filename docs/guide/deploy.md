# 部署

## 目录布局

`Program.exe` 必须和运行环境放在同一个目录里。下面以 `Vector/` 代指该目录
（实际路径随你的部署位置而定，本文其余部分同样用相对路径描述）：

```text
Vector/
├── Program.exe            ← CPython 3.12 核心静态链在里面，不需要 python312.dll
├── source/                ← 运行环境
│   ├── Lib/               ← 标准库
│   │   └── site-packages/ ← 第三方库装这里；含 umsgpack.py、RC4.py、chacha/、raknet/、*.pyi
│   ├── init.py            ← 框架入口：启动编排 + kernel 事件注册
│   ├── proton.py          ← 解析数据包
│   ├── logo.py            ← 启动面板（终端里的 NT VECTOR 字样）
│   ├── redirect.py        ← 遗留，source 模式下不执行
│   └── ntvector/          ← 框架实现（被 init.py 导入）
│       ├── common.py      ← 日志与 umsgpack 全局开关
│       ├── plugins.py     ← 插件加载 / 重载 / 文件监视
│       ├── mcp_check.py   ← RPC 反作弊校验
│       ├── mcp_pack.py    ← .mcp 打包工具
│       └── neox.py        ← NeoXHash（.mcp 文件名哈希）
├── scripts/               ← 插件（每个插件一个目录）
├── VectorLauncher.exe
├── mc.cfg                 ← 启动配置（房间 / 账号 / 皮肤）
├── client_cfg.json        ← 客户端配置（no_launch_mcp 等）
├── skin_data.json / skin.png / skins/
├── songs/ / model.json / whitelist.txt
```

::: warning 没有这些文件
`python312.dll`、`python3.dll`、`python312/`（含 `DLLs/*.pyd`）—— 解释器核心静态链在
`Program.exe` 里，与 Python 2.7 时代的形态一致（当年是静态 `python27.lib`）。

代价：官方 `.pyd` 动态扩展无法 drop-in。详见[静态链接与扩展限制](/architecture/static-linking)。
:::

::: tip 为什么标准库在 source/Lib
`Program.exe` 用 `PYTHONHOME=<exe>\source` 定位标准库 —— Windows 上 CPython 的
`getpath` 找的是 prefix 下的 `Lib\os.py` 这个 landmark
（`Modules/getpath.py:193-194`），而缺 `DLLs/` 目录是被显式容忍的（`getpath.py:610-614`）。
:::

> **请勿删改 `source/`**，那是运行环境（框架脚本 + 标准库）；插件放 `scripts/`。

## 从旧布局迁移

先关掉正在运行的客户端，然后：

```bat
:: 在运行目录（Program.exe 所在目录）执行
cd /d "C:\path\to\Vector"
mkdir backup_py312
move python312       backup_py312\
move python312.dll   backup_py312\
move python3.dll     backup_py312\
mkdir source\Lib
xcopy /E /I /Y python312\Lib\* source\Lib\
move Program.exe backup_py312\Program_old.exe
copy <新构建>\Program.exe .
```

迁移完 `source\Lib` 应直接含 `os.py`、`importlib\`、`site-packages\` 等
（即原来 `python312\Lib` 的内容）。

### 回滚

把 `backup_py312` 里的 `Program_old.exe` 改名回 `Program.exe`，把 `python312` /
`python312.dll` / `python3.dll` 移回原位，删掉 `source\Lib`。

## 装第三方库

Vector 内置完整 Python 3.12 标准库。如需第三方库：

```bash
# 用系统 Python 的 pip 安装到 Vector 的 site-packages：
pip install requests --target "Vector\source\Lib\site-packages"
```

或直接把纯 Python 包复制到 `source/Lib/site-packages/`。插件中直接 `import` 即可。

::: danger 只支持纯 Python 包
wheel 文件名形如 `py3-none-any` 的才可以。带平台 tag 的包（`numpy`、`Pillow`、`lxml`
这类 `cp312-...-win_amd64` wheel）装进去也**无法 import** —— 解释器是静态链接的，
官方 `.pyd` 加载不了。

需要这类库只有两条路：
1. 编进 exe（见 `cmake/PythonBuiltinModules.cmake` 白名单）；
2. 对着 `Program.lib` 自编 `.pyd` 放进 `source/Lib/site-packages/`。
:::

## 启动参数

```bash
Program.exe --config mc.cfg --logger
Program.exe --start_nethernet --UserID xxx --DisplayName xxx --MD5Token xxx
```

完整参数表见[项目概览 · 命令行参数](/guide/#命令行参数)。

## 上线检查项

::: tip 2026-09-26 已实测通过
- `PlayStatus value: 3` = PlayerSpawn（正常进服）；`0` = 登录成功；`1/2/4/5/6` 才是失败
- **没有被「因违规游戏行为，您的账号被禁止进入游戏」踢出** —— 这一条是判据：
  静态化改动了初始化路径，只有 MCP 反作弊校验链（rotor + umsgpack + RC4）完好才不会被踢
:::

换机器、或改动 `PythonRuntime.cpp` 的初始化顺序后，需要重新走一遍这两条。

### 一个容易踩的坑

`PythonRuntime.cpp` 的 **MCP 分支会整个清空 `sys.path`**。标准库挪进 `source/Lib`
后，这条分支如果被触发且没有把标准库路径补回去，所有 stdlib import 都会失败。
当前代码已在清空后补回 `./source/Lib` 与 `./source/Lib/site-packages`
（追加在 MCP 自带路径之后，所以 `vanilla.mcp/lib/` 仍然优先）。

## 日志

| 文件 | 内容 |
| --- | --- |
| `log.txt` | 完整日志 |
| `dis.log` | 断开 / 封禁相关 |

排查 Python 问题时，日志里 `[PythonRuntime]` 前缀的行会显示初始化各阶段
（`SetPythonHome` → `AppendStdlibInittab` → `Py_Initialize` → `initModules` →
`import init`）。

## 下一步

- [常见问题](/guide/faq)
- [插件开发](/plugin/)
