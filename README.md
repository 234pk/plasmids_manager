# 质粒管理系统 (Plasmid Manager)

这是一个基于 Electron + Vue 3 的质粒管理系统桌面应用，支持质粒数据的批量导入、识别、管理和序列分析。

## 🛠️ 技术栈与组件

本项目采用轻量级架构，核心依赖已包含在项目中，无需复杂的构建配置。

*   **运行环境**: [Electron](https://www.electronjs.org/) (v40.1.0)
*   **前端框架**: [Vue 3](https://vuejs.org/) (Global Build, 位于 `js/lib/vue.global.js`)
*   **UI 样式**: [Tailwind CSS](https://tailwindcss.com/) (本地集成, 位于 `js/lib/tailwind.min.js`)
*   **自然语言处理**: [Compromise](https://github.com/spencermountain/compromise) (用于文本识别, 位于 `js/lib/compromise.js`)

## 🚀 快速开始

### 1. 环境准备

确保您的电脑已安装 [Node.js](https://nodejs.org/) (建议版本 v16+)。

### 2. 安装依赖

在项目根目录下打开终端，运行以下命令安装 Electron 依赖：

```bash
npm install
```

### 3. 启动应用

运行开发模式：

```bash
npm start
```

### 4. 打包构建 (可选)

如果您需要生成 Windows `.exe` 安装包或便携版：

```bash
npm run build
```

构建产物将生成在 `dist` 目录下。

## 📂 目录结构说明

*   `index.html`: 应用主入口文件 (View)
*   `main.js`: Electron 主进程逻辑 (Main Process)
*   `js/`: 前端业务逻辑 (Renderer Process)
    *   `app.js`: Vue 应用主逻辑，包含状态管理和交互
    *   `data-service.js`: 数据层，处理文件读写、导出和 IPC 通信
    *   `recognition.js`: 核心识别算法，解析文件名特征
    *   `lib/`: 第三方库依赖 (Vue, Tailwind, Compromise)
*   `data/`: 运行时数据目录 (自动生成)
    *   `plasmid_database.json`: 数据库文件
    *   `sequences/`: 存放生成的 .fasta 序列文件
    *   `settings.json`: 用户配置文件

## ✨ 主要功能

*   **批量导入**: 支持拖拽文件批量导入，自动识别质粒特征。
*   **智能识别**: 自动从文件名和路径中提取载体类型、抗性、物种等信息。
*   **序列管理**: 自动提取并保存 FASTA 格式序列文件，支持 CSV 导出。
*   **数据持久化**: 数据自动保存到本地 JSON 文件，支持增删改查。
