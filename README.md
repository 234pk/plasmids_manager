# 质粒管理系统 (Plasmid Manager)

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

Plasmid Manager is an efficient desktop application designed for biomedical researchers to manage plasmid data. It provides automated recognition, batch processing, and deep bioinformatics integration.

### ✨ Key Features

*   **🚀 Advanced Batch Import & Recognition**: 
    *   Cross-validation between filenames and GenBank file features for highly accurate attribute extraction.
    *   Smart checkable lists for 12+ key attributes (Resistance, Tags, Promoters, etc.) with dynamic value addition and auto-deduplication.
    *   Support for bulk pasting plasmid names for rapid entry.
*   **🔍 Deep UniProt Integration**: 
    *   Species-specific (Taxonomy ID) protein function searches.
    *   Extraction of subcellular locations, RefSeq/STRING IDs, and direct PubMed links.
    *   Prioritizes reviewed entries for higher data quality.
*   **🧬 Sequence Management**: 
    *   Automatic parsing of GenBank/FASTA formats.
    *   Secure sequence viewing and exporting, compatible with external software like SnapGene.
*   **🌍 Full Internationalization (i18n)**: 
    *   Complete English and Chinese UI support.
    *   Optimized for global laboratory environments with persistent language settings.
*   **📦 Optimized Distribution**: 
    *   Cross-platform support for Windows (.exe, portable) and macOS (DMG).
    *   **Universal macOS binaries** (support for both Intel and Apple Silicon/M1/M2/M3).
    *   High-fidelity custom branding with optimized icons for Retina displays.
    *   Automated CI/CD via GitHub Actions.
*   **💾 Data Security & Portability**: 
    *   Data stored in user-specific directories (`userData`) to ensure safety during upgrades.
    *   Automatic database migration and backup mechanisms.

### 🛠️ Tech Stack

*   **Runtime**: [Electron](https://www.electronjs.org/)
*   **Frontend**: [Vue 3](https://vuejs.org/) (Composition API)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **NLP**: [Compromise](https://github.com/spencermountain/compromise)
*   **Build**: [Electron Builder](https://www.electron-build.org/)

---

<a name="中文"></a>
## 中文

质粒管理系统是一款专为生物医学研究人员设计的高效桌面应用，旨在简化质粒数据的管理、识别与生物信息学集成分析。

### ✨ 核心功能

*   **🚀 高级批量导入与识别**:
    *   实现文件名与 GenBank 文件特征的交叉验证，确保 12 种以上关键属性（如抗性、标签、启动子等）的精准提取。
    *   智能可勾选列表界面，支持动态添加自定义属性值并自动去重。
    *   支持批量粘贴名称导入，极大提升录入效率。
*   **🔍 UniProt 深度集成**:
    *   支持基于物种（Taxonomy ID）的精确蛋白质功能搜索。
    *   自动提取亚细胞定位、RefSeq/STRING ID 及 PubMed 文献链接。
    *   搜索策略优先匹配人工审阅数据，确保结果相关性。
*   **🧬 序列管理与协作**:
    *   自动解析 GenBank/FASTA 格式。
    *   支持序列查看与导出，实现与 SnapGene 等外部软件的无缝数据协作。
*   **🌍 完整的国际化支持 (i18n)**:
    *   全界面中英文双语支持，适用于全球化实验室环境。
    *   优化了设置页面和操作反馈的翻译质量。
*   **📦 优化的分发与体验**:
    *   支持 Windows（安装版、便携版）和 macOS（DMG）跨平台运行。
    *   **macOS 通用二进制支持**（原生兼容 Intel 及 Apple Silicon M1/M2/M3 芯片）。
    *   针对 macOS Retina 屏幕优化的 1024x1024 高清自定义图标。
    *   通过 GitHub Actions 实现自动化构建与发布。
*   **💾 数据安全与迁移**:
    *   数据存储于用户目录 (`userData`)，确保软件升级时不丢失数据且具备读写权限。
    *   内置数据库自动迁移机制，保障数据持续可用。

### 🛠️ 技术栈

*   **运行时**: [Electron](https://www.electronjs.org/)
*   **前端框架**: [Vue 3](https://vuejs.org/) (Composition API)
*   **样式方案**: [Tailwind CSS](https://tailwindcss.com/)
*   **自然语言处理**: [Compromise](https://github.com/spencermountain/compromise)
*   **构建工具**: [Electron Builder](https://www.electron-build.org/)

---
© 2026 Plasmid Manager Team
