# Plasmid Manager Development Log

## 2026-02-07 Update
- **Feature Removal**: Removed the UniProt pop-up query function, now directly opens the UniProt webpage.
  - Modified `index.html`: Changed the 'U' button behavior to `openExternalLink`.
  - Modified `js/app.js`: Deleted related code such as `showUniProtModal`, `uniProtModalData`, `openUniProtModal`.
  - Optimized the external link opening experience on macOS (`open -a` logic in `main.js`).
- **macOS Optimization**:
  - Confirmed `main.js` includes `window-all-closed` and `activate` event handling, conforming to macOS application lifecycle specifications.
  - Ensured `package.json` includes macOS build configurations (`dmg`, `zip`, `entitlements`).
- **CI/CD**:
  - Updated `.github/workflows/release.yml` to support automated building and publishing of Windows/macOS versions via GitHub Actions.

---

# 质粒管理系统开发日志

## 2026-02-07 更新
- **功能移除**: 移除了 UniProt 弹窗查询功能，改为直接打开 UniProt 网页。
  - 修改 `index.html`: 将 U 按钮行为改为 `openExternalLink`。
  - 修改 `js/app.js`: 删除了 `showUniProtModal`, `uniProtModalData`, `openUniProtModal` 等相关代码。
  - 优化了 macOS 下的外部链接打开体验 (`main.js` 中的 `open -a` 逻辑)。
- **macOS 优化**:
  - 确认 `main.js` 包含 `window-all-closed` 和 `activate` 事件处理，符合 macOS 应用生命周期规范。
  - 确保 `package.json` 中包含 macOS 构建配置 (`dmg`, `zip`, `entitlements`)。
- **CI/CD**:
  - 更新 `.github/workflows/release.yml`，支持 GitHub Actions 自动构建和发布 Windows/macOS 版本。
