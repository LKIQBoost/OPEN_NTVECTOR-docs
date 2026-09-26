# 常见问题

## 构建

### Q: 首次构建很慢？

A: 正常。两件事最耗时：

- **OpenSSL 从源码编译**（约 5–10 分钟）。若本机没有可用的 Perl，会回退到项目自带的
  `.lib`，那就快得多。
- **静态 CPython 核心**（先 `_freeze_module` 再约 198 个核心源文件，几分钟）。

两者产物都缓存在 `build/_deps/`，之后的 configure 会跳过。

### Q: configure 报 `Host Python not found` 或 `MSBuild.exe not found`？

A: 静态核心的构建需要两样东西：

1. **一个 ≥ 3.10 的宿主 Python** —— 只用来跑 `Tools/build/deepfreeze.py` 生成冻结模块，
   **不参与链接**。自动探测顺序：PATH → `%LOCALAPPDATA%\Programs\Python\Python3xx` →
   `py -3`。探测不到就用 `-DNTVECTOR_PY_HOST=<python.exe 路径>` 指定。
2. **`MSBuild.exe`** —— 查找顺序：`CMAKE_VS_MSBUILD_COMMAND` → `vswhere.exe` → PATH。

### Q: 静态核心构建失败，或者换机器 / 换工具集后行为不对？

A: 看 `build/_deps/python-static/freeze.log` 和 `core.log`（脚本报错时会把路径打出来）。

构建缓存带指纹（`pythoncore.vcxproj` / `_freeze_module.vcxproj` / `pyconfig.h` /
工具集 / SDK 的 SHA1），任一变化会自动重编。要强制重建：

```bash
cmake -B build -DNTVECTOR_PY_REBUILD=ON
```

::: warning 工具集不能留空
CPython 的 `python.props` 对 VS 15/16/17 之外的版本会**静默回落到 `v140`**（本机可能没装）。
所以 `NTVECTOR_PY_TOOLSET` 必须显式指定，脚本里的默认值只是兜底。
:::

### Q: 改了 `third_party/Python-3.12.2` 里的东西后，configure 报 `patch anchor not found`？

A: `cmake/BuildPython312.cmake` 会对 `PCbuild/pythoncore.vcxproj` 打 7 处补丁，
锚点按 **3.12.2 原文**写死。升级 CPython 版本要同步核对那几处锚点。

不要直接手改源码树 —— 脚本生成补丁副本到 build 目录，就是为了不污染 `third_party/`。

### Q: 改完 header 重新构建，但运行还是旧行为？

A: MSBuild 增量编译**不会**重编依赖该 header 的 `.cpp`。用 `touch <依赖的.cpp>`
强制重编，或直接 `rm -rf build` 全量重建。

### Q: 链接时报 `LNK2005` 重复符号 / `LNK2001` 无法解析的外部符号？

A: 几个已知点：

- 静态 CPython 核心**不能**带 zlib 实现（会与项目自己的 `zlibstatic` 冲突），
  所以构建时传 `IncludeExternals=false`，只把 zlib 的 include 路径补进去
  （`binascii.c` 无条件带 `USE_ZLIB_CRC32`，需要 `zlib.h`）。
- 核心还需要额外链 `version.lib` 与 `pathcch.lib`
  （`sysmodule.obj` / `posixmodule.obj` / `fileutils.obj` 用到）。
- `C2375 重定义;不同的链接` 是 pybind11 的 `PYBIND11_EXPORT` 与静态侧
  `PyMODINIT_FUNC` 属性不一致，工程里已把前者置空。

## 版本控制

### Q: 推送代码到 GitHub 时报 `RPC failed; curl 65 ... Connection was reset`？

A: 仓库历史较大（含 57 MB 的 `libcrypto_static.lib`），需要增大 HTTP 缓冲区：

```bash
git config http.postBuffer 524288000
```

### Q: 提示 `libcrypto_static.lib` 超过 50 MB 推荐上限？

A: 仅警告，不影响。GitHub 单文件上限 100 MB。如需精简仓库，可改用 Git LFS 或重写历史。

## 其他平台

### Q: Linux / Android 上 `Python.h` 找不到？

A: Py3 迁移 + 静态化后，非 Windows 构建尚未支持 —— `cmake/BuildPython312.cmake`
只对 `WIN32 AND MSVC` 生效，其他平台会回落到 `find_package(Python3 ...)` 动态链接分支。
恢复方法见[构建 · 其他平台](/guide/build#其他平台)。

历史 Py2 构建时该问题常由损坏的 `build/_deps/` 导致，删除后重新 configure 即可。

## 运行

### Q: `PlayStatus value: 3` 是错误吗？

A: 不是。`3` = **PlayerSpawn**，即正常进服。`0` = 登录成功；`1/2/4/5/6` 才是失败。

### Q: 被服务器以「因违规游戏行为，您的账号被禁止进入游戏」踢出？

A: 这是反作弊校验失败，通常是 MCP 校验链（rotor + umsgpack + RC4）出了问题。
排查见 [RPC 与反作弊校验](/architecture/anti-cheat)。

### Q: 控制台输出中文乱码？

A: 网络数据是 UTF-8，Python 3 的 `str` 是 Unicode，**插件内部直接使用即可**，
不影响实际收发。只是 Windows 控制台默认 GBK，`print` 可能显示乱码，可以：

```python
import sys
sys.stdout.reconfigure(encoding='utf-8')     # 或 'gbk'
```
