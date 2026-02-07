# 质粒管理系统 (Plasmid Manager)

基于 Electron + Vue 3 的高效质粒管理桌面应用。专为生物医学研究人员设计，支持自动化质粒数据识别、批量导入、序列管理以及深度的生物信息学集成。

An efficient desktop application for plasmid management based on Electron + Vue 3. Designed specifically for biomedical researchers, it supports automated plasmid data recognition, batch import, sequence management, and deep bioinformatics integration.

## ✨ 核心功能 | Key Features

*   **🚀 批量识别与导入 | Batch Recognition & Import**: 拖放文件进行批量导入。具备文件名模式与 GenBank 文件内容（特征）之间的交叉验证，自动识别包括抗性、标签、启动子、复制子等在内的 12 种关键属性。
    Drag and drop files for batch import. Features cross-validation between filename patterns and GenBank file content (Features) to automatically identify 12 types of key attributes including resistance, tags, promoters, replicons, etc.
*   **📋 智能可勾选列表 | Smart Checkable Lists**: 批量导入界面采用智能可勾选列表，支持动态添加自定义属性值，并具备自动去重逻辑，确保数据的纯净与准确。
    The batch import interface uses smart checkable lists, supporting dynamic addition of custom attribute values with automatic deduplication logic to ensure data purity and accuracy.
*   **🧬 深度序列管理 | Deep Sequence Management**: 自动解析 GenBank/FASTA 格式，支持序列导出及 CSV 导出，实现与 SnapGene 等软件的无缝协作。
    Automatically parses GenBank/FASTA formats, supports sequence export, and CSV export for seamless collaboration with software like SnapGene.
*   **🔍 UniProt 集成 | UniProt Integration**: 支持基于物种（Taxonomy）的蛋白质功能搜索，自动提取亚细胞定位、RefSeq ID、STRING ID，并提供直接的 PubMed 文献链接。
    Supports protein function search based on species (Taxonomy), automatically extracting subcellular location, RefSeq ID, STRING ID, and providing direct PubMed literature links.
*   **🌍 国际化 (i18n) | Internationalization**: 全方位支持中英文界面切换，适用于全球化实验室环境。
    Full support for switching between Chinese and English interfaces, suitable for global laboratory environments.
*   **💾 数据持久化与安全 | Data Persistence & Safety**: 本地 JSON 存储，支持自动迁移至用户数据目录，确保软件升级过程中数据不丢失。
    Local JSON storage with automatic migration to the user data directory, ensuring no data loss during software upgrades.
*   **📦 跨平台分发 | Cross-platform Distribution**: 提供 Windows 安装程序、便携版以及 macOS 版本，通过 GitHub Actions 实现自动化构建与发布。
    Provides Windows installer, portable version, and macOS version, with automated build and release via GitHub Actions.

## 🛠️ 技术栈 | Tech Stack

*   **运行时 | Runtime**: [Electron](https://www.electronjs.org/) (v40.1.0)
*   **前端 | Frontend**: [Vue 3](https://vuejs.org/) (Composition API)
*   **样式 | Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **自然语言处理 | NLP**: [Compromise](https://github.com/spencermountain/compromise)
*   **构建工具 | Build Tool**: [Electron Builder](https://www.electron-build.org/)

## 🚀 快速开始 | Quick Start

### 1. 前提条件 | Prerequisites
确保您的电脑上已安装 [Node.js](https://nodejs.org/)（推荐 v18+）。
Ensure [Node.js](https://nodejs.org/) (v18+ recommended) is installed on your computer.

### 2. 安装与运行 | Install & Run
```bash
# 安装依赖 | Install dependencies
npm install

# 启动开发模式 | Start development mode
npm start

# 构建 Windows 版本 | Build for Windows
npm run build
```

## 📂 目录结构 | Directory Structure
*   `index.html`: 主入口视图 | Main entry view
*   `main.js`: Electron 主进程逻辑 | Electron main process logic
*   `js/`:
    *   `app.js`: Vue 应用交互逻辑 | Vue app interaction logic
    *   `recognition.js`: 核心识别算法 | Core recognition algorithm
    *   `batch-logic.js`: 批量导入逻辑 | Batch import logic
    *   `i18n.js`: 国际化引擎 | i18n engine
*   `locales/`: 翻译文件 | Translation files (JSON)

---
© 2026 Plasmid Manager Team
