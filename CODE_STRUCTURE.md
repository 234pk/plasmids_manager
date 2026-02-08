# 质粒管理系统代码结构文档 (Code Structure Audit)

## 1. 核心架构概述
本项目是一个基于 Electron + Vue 3 (Composition API) 的桌面端应用，用于管理和识别质粒（Plasmid）数据。应用采用了多模块化的 JavaScript 设计，虽然没有使用现代的构建工具（如 Vite/Webpack），但通过在 `index.html` 中有序加载脚本实现了逻辑解耦。

## 2. 文件系统结构
```text
e:\tool\
├── main.js                 # Electron 主进程入口：管理窗口、IPC 通信、原生文件操作
├── preload.js              # 预加载脚本：通过 contextBridge 安全暴露原生 API 给渲染进程
├── index.html              # 视图入口：HTML 结构、Vue 模板、脚本加载顺序管理
├── package.json            # 项目配置、依赖管理、Electron 启动参数
├── js/                     # 渲染进程逻辑目录
│   ├── app.js              # Vue 应用核心：状态管理、组件逻辑、生命周期挂载
│   ├── data-service.js     # 数据持久化层：IndexedDB 管理、文件读写代理
│   ├── db-manager.js       # 数据库管理：新建/切换外部 JSON 数据库
│   ├── recognition.js      # 识别引擎：NLP 提取、规则匹配、UniProt 增强、模糊匹配
│   ├── batch-logic.js      # 批量操作逻辑：文件扫描、批量导入识别、序列提取
│   ├── project-window.js   # 项目/分组管理逻辑
│   ├── utils.js            # 工具类：日志记录、字符串处理、UI 交互辅助、业务逻辑封装 (如描述生成)
│   ├── i18n.js             # 国际化逻辑：语言切换、翻译映射
│   ├── translations_data.js# 翻译字典数据 (140KB+)
│   └── lib/                # 第三方库 (Vue, Tailwind, Compromise 等)
├── assets/                 # 静态资源 (图标等)
└── locales/                # 国际化 JSON 配置 (en, zh)
```

## 3. 核心模块职责与交互

### 3.1 主进程与预加载 (`main.js`, `preload.js`)
- **职责**: 负责窗口生命周期、GPU 稳定性控制、磁盘文件静默读写、原生对话框弹出。
- **交互**: 通过 `ipcMain.handle` 响应渲染进程请求，通过 `preload.js` 暴露 `window.electronAPI` 接口。

### 3.2 识别引擎 (`recognition.js`)
- **职责**: 核心算法层。通过正则、词法分析 (Compromise.js) 和模糊匹配算法 (Levenshtein) 从文件名和文件内容中提取质粒特征（抗性、启动子、靶基因等）。
- **关键算法**: `fuzzyMatch` (混合权重算法), `similarity` (编辑距离), `tokenizeName` (文件名分词)。

### 3.3 数据服务 (`data-service.js`)
- **职责**: 抽象数据访问。优先使用 IndexedDB (浏览器缓存)，同时支持同步到本地 JSON 文件。
- **并发控制**: 使用事务处理数据库读写，确保数据一致性。

### 3.4 Vue 应用层 (`app.js`, `index.html`)
- **职责**: UI 渲染与状态响应。
- **特点**: 采用了巨型单文件 Vue 实例模式。由于没有组件化拆分，`index.html` 承载了所有 HTML 模板（2300+ 行），`app.js` 承载了大部分交互逻辑。

## 4. 潜在问题与技术债务

### 4.1 内存与性能风险 (高风险)
- **DOM 规模**: `index.html` 过于庞大，包含大量 Vue 指令和 Tailwind 类。Vue 在挂载时需要扫描整个 DOM，这在低性能机器上极易导致渲染进程响应超时或崩溃。
- **大型静态资源**: `tailwind.min.css` (2.8MB) 的全量加载会阻塞渲染并消耗大量内存。

### 4.2 初始化竞争风险 (中风险)
- **全局变量依赖**: 模块间通过 `window.XXX` 互相访问。如果 `index.html` 中的脚本加载顺序被打乱（例如使用了 `async` 或某些环境下的 `defer`），会导致 `app.js` 启动时找不到依赖项。
- **挂载时机**: 应用在 `DOMContentLoaded` 后立即执行 `mountApp`，但在 Electron 环境下，有些 API 可能尚未完全注入。

### 4.3 架构耦合度 (低风险)
- **逻辑与模板分离不足**: 由于没有使用 `.vue` 单文件组件，HTML 模板与 JS 逻辑分布在两个巨大的文件中，维护难度随功能增加呈指数级上升。

## 5. 崩溃 (0xC0000005) 原因推断
基于代码审计，崩溃点位于 **Vue 挂载大型 DOM 树** 与 **加载超大 CSS 资源** 的交汇处。渲染引擎在尝试分配大量内存来构建 Render Tree 和响应 Vue 的双向绑定扫描时，触发了系统的内存访问冲突。

---
*文档生成日期: 2026-02-08*
