# Plasmid Manager

An efficient desktop application for plasmid management based on Electron + Vue 3. Designed specifically for biomedical researchers, it supports automated plasmid data recognition, batch import, sequence management, and deep bioinformatics integration.

## ✨ Key Features

*   **🚀 Batch Recognition & Import**: Drag and drop files for batch import. Features cross-validation between filename patterns and GenBank file content (Features) to automatically identify 12 types of key attributes including resistance, tags, promoters, replicons, etc.
*   **📋 Smart Checkable Lists**: The batch import interface uses smart checkable lists, supporting dynamic addition of custom attribute values with automatic deduplication logic to ensure data purity and accuracy.
*   **🧬 Deep Sequence Management**: Automatically parses GenBank/FASTA formats, supports sequence export, and CSV export for seamless collaboration with software like SnapGene.
*   **🔍 UniProt Integration**: Supports protein function search based on species (Taxonomy), automatically extracting subcellular location, RefSeq ID, STRING ID, and providing direct PubMed literature links.
*   **🌍 Internationalization (i18n)**: Full support for switching between Chinese and English interfaces, suitable for global laboratory environments.
*   **💾 Data Persistence & Safety**: Local JSON storage with automatic migration to the user data directory, ensuring no data loss during software upgrades.
*   **📦 Cross-platform Distribution**: Provides Windows installer, portable version, and macOS version, with automated build and release via GitHub Actions.

## 🛠️ Tech Stack

*   **Runtime**: [Electron](https://www.electronjs.org/) (v40.1.0)
*   **Frontend**: [Vue 3](https://vuejs.org/) (Composition API)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **NLP**: [Compromise](https://github.com/spencermountain/compromise)
*   **Build Tool**: [Electron Builder](https://www.electron-build.org/)

## 🚀 Quick Start

### 1. Prerequisites
Ensure [Node.js](https://nodejs.org/) (v18+ recommended) is installed on your computer.

### 2. Install & Run
```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build for Windows
npm run build
```

## 📂 Directory Structure
*   `index.html`: Main entry view
*   `main.js`: Electron main process logic (path management, IPC)
*   `js/`:
    *   `app.js`: Vue app interaction logic and state management
    *   `recognition.js`: Core recognition algorithm (Regex + Feature extraction)
    *   `batch-logic.js`: Batch import and cross-validation logic
    *   `i18n.js`: Internationalization configuration engine
    *   `services/`: Third-party API integration (e.g., UniProt)
*   `locales/`: Translation files (JSON)

## 📝 Dev Log
For detailed development records, please refer to [Plasmid Manager Development Log (ZH)](./质粒管理系统%20开发日志.md).
