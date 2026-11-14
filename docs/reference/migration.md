# Py2 → Py3 迁移

> 项目从 Python 2.7 迁移到 Python 3.12.2 的完整记录。
> **当前状态**：迁移已完成，解释器进一步改为静态链接（见
> [静态链接与扩展限制](/architecture/static-linking)）。

## 迁移阶段

| 阶段 | 内容 |
| --- | --- |
| M0 | Python 3.12 工具链验证（链接 / 嵌入 / DLL 部署） |
| M1 | 简单模块迁移（`mod_log` / `setting` / `utility` / `aes` / `websocket` / `chacha`） |
| M2 | 中型模块（`pkt` / `fop` / `raknet` / `rotor`） |
| M3 | 引擎核心（`engine_wrapper.h` + `engine.cpp` + pybind11 2.13） |
| M4 | 运行时（`PythonRuntime` + `PythonUtils` + CMake 切换） |
| M5 | Python 侧（`source/` 框架 + RC4 / umsgpack 迁移到 `site-packages`） |
| M6 | 部署与回归 |

迁移完成时的部署形态是「`python312.dll` 动态链接 + exe 旁 `python312/` 完整标准库」；
之后又做了一次静态化改造，形态变成现在的「静态核心链进 exe + `source/Lib/`」。

## 主要修复的问题

这些都是迁移过程中踩过并已修掉的坑，按主题归类：

### 编译 / 链接

- **`PY_SSIZE_T_CLEAN`** —— 使用 `s#` / `y#` 格式时必须定义，否则运行期抛
  `PY_SSIZE_T_CLEAN macro must be defined for '#' formats`
- **`byte` 歧义** —— Windows SDK 的 `byte` typedef 与 `std::byte` 冲突。
  解法：禁用 `std::byte`，或让 `windows.h` 先于任何 `using namespace std;` 被包含
- **pybind11 2.13 `create_extension_module(nullptr)` 崩溃** —— 它会对传入指针做
  placement new，必须传真实分配
- **MSBuild 陈旧头文件** —— 改 header 后不重编依赖它的 `.cpp`，需手动 `touch`

### 字符串 / 编码

- **`triggerBytes` 参数必须是 list** —— 二进制事件走 `triggerBytes`，
  且 C++ 侧要求 args 是 list/tuple，否则静默丢弃
- **`GetStartType` 的 str + bytes 混用**
- **`read_string` / `unpack 's'` 返回值** —— Py3 下返回 `str` 而非 bytes

### 数据 / 协议

- **`umsgpack.compatibility = True`** —— 否则 > 31 字节的字符串会打成 `str8` 而不是
  `raw16`，反作弊校验必然失败
- **RC4 / `_mcp_reverse_data` / `_get_calc_check_num`** —— 全部改成 Py3 的 bytes / int 操作
- **`CommandBlockUpdate` 的 `filtered_name`** —— 必须带，缺失会被踢（字段布局验证自 1.21.120，当前协议 898 / 1.21.130 仍然适用）

### Python 2 → 3 语法

| Py2 | Py3 |
| --- | --- |
| `execfile` | `exec(compile(...))` |
| `import thread` | `import _thread` / `import threading` |
| `reload(x)` | `importlib.reload(x)` |
| `print 'x'` | `print('x')` |

完整的插件侧迁移清单见[插件常见问题](/plugin/faq#q-从-python-2-7-迁移到-3-12-我的旧插件要改什么)。

## SNB 迁移基线

项目还经历过一次 **SNB**（StaticNeteaseBot）能力迁移，在独立的 OPEN-VECTOR 工作树中进行。

### 对比结果

| 指标 | 数量 |
| --- | --- |
| OPEN-VECTOR application 文件 | 1241 |
| SNB application 文件 | 1276 |
| 相同路径 | 1044 |
| 相同路径且内容一致 | 1038 |
| 相同路径但内容不同 | 6 |
| 仅 SNB 有的路径 | 232 |
| 仅 OPEN-VECTOR 有的路径 | 197 |

### 迁移规则

1. 只编辑 OPEN-VECTOR 工作树内的文件（SNB 侧为只读参考）
2. 除非 SNB 改进明确要求，否则保留 OPEN-VECTOR 的既有行为
3. 功能迁移与目录重组分为独立阶段
4. 每个迁移的原生 API 都包含实现、声明、测试与文档更新
5. 构建失败或旧行为不兼容时停下来排查，不静默覆盖

### 阶段状态

- [x] 基线与对比
- [x] 构建与测试基础（Ninja + MinGW 基线可链接 `Program.exe`）
- [x] NBT 与原生 Python API
- [x] 数据包对象与通用编解码
- [x] 结构化协议事件
- [x] 异步请求与超时处理
- [x] 玩家、世界、实体与物品栏状态
- [x] 类型声明、文档与最终回归

## 下一步

- [静态链接与扩展限制](/architecture/static-linking) —— 迁移之后的静态化改造
- [架构](/architecture/)
