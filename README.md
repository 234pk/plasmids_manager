# 质粒管理系统 (Plasmid Manager)

这是一个基于 Electron + Vue 3 的高效质粒管理系统桌面应用。专为生物医学研究人员设计，支持质粒数据的自动化识别、批量导入、序列管理以及深度生物信息学集成。

## ✨ 主要功能

*   **🚀 批量识别与导入**: 支持拖拽文件批量导入，通过文件名特征与 GenBank 文件内容（Features）双向交叉验证，自动识别抗性、标签、启动子、复制子等 12 类关键属性。
*   **📋 智能勾选列表**: 批量导入界面采用智能勾选交互，支持动态添加自定义属性值，具备自动去重逻辑，确保数据的纯净与准确。
*   **🧬 序列深度管理**: 自动解析 GenBank/FASTA 格式，支持序列导出、CSV 导出，方便与 SnapGene 等软件协同工作。
*   **🔍 UniProt 深度集成**: 支持基于物种（Taxonomy）的蛋白功能搜索，自动提取细胞定位、RefSeq ID、STRING ID 等信息，并提供 PubMed 文献直达链接。
*   **🌍 国际化支持**: 完整支持中英文界面切换，适应全球实验室环境。
*   **💾 数据持久化与安全**: 数据本地 JSON 存储，支持自动迁移至用户数据目录，确保软件升级时数据不丢失。
*   **📦 跨平台分发**: 提供 Windows 安装版、便携版及 macOS 版本，支持基于 GitHub Actions 的自动化构建发布。

## 🛠️ 技术栈

*   **运行环境**: [Electron](https://www.electronjs.org/) (v40.1.0)
*   **前端框架**: [Vue 3](https://vuejs.org/) (Composition API)
*   **UI 样式**: [Tailwind CSS](https://tailwindcss.com/)
*   **自然语言处理**: [Compromise](https://github.com/spencermountain/compromise)
*   **构建工具**: [Electron Builder](https://www.electron-build.org/)

## 🚀 快速开始

### 1. 环境准备
确保您的电脑已安装 [Node.js](https://nodejs.org/) (建议版本 v18+)。

### 2. 安装与运行
```bash
# 安装依赖
npm install

# 启动开发模式
npm start

# 构建 Windows 打包
npm run build
```

## 📂 目录结构
*   `index.html`: 主入口视图
*   `main.js`: Electron 主进程逻辑（路径管理、IPC 通信）
*   `js/`:
    *   `app.js`: Vue 应用交互逻辑与状态管理
    *   `recognition.js`: 核心识别算法（正则+特征提取）
    *   `batch-logic.js`: 批量导入与交叉验证逻辑
    *   `i18n.js`: 国际化配置引擎
    *   `services/`: 第三方 API 集成（如 UniProt）
*   `locales/`: 语言翻译文件 (JSON)

## 📝 开发日志
详细的开发记录请参考 [质粒管理系统 开发日志.md](./质粒管理系统%20开发日志.md)。
