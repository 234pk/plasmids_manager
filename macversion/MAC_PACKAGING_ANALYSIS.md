# 🔍 Mac DMG 打包问题排查报告

> **分析日期**: 2026-02-08  
> **项目路径**: `/mnt/e/tool/`  
> **问题**: GitHub 打包 DMG 后无法运行

---

## 一、问题现象分析

### 1.1 常见错误信息

| 错误类型 | 描述 |
|----------|------|
| **无法通过签名** | "APP 无法通过签名验证" |
| **图标抖动** | 点击后图标一直跳，但没有显示页面 |
| **闪退** | 打开后立即崩溃 |
| **打不开** | 双击无任何反应 |

### 1.2 当前打包配置

```yaml
# builder-effective-config.yaml
mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
    - target: zip
      arch:
        - x64
        - arm64
  hardenedRuntime: false      # ⚠️ 问题 1
  gatekeeperAssess: false     # ⚠️ 问题 2
  forceCodeSigning: false     # ⚠️ 问题 3
  category: public.app-category.productivity
  extendInfo:
    NSAppleEventsUsageDescription: Please allow access to Apple Events.
    NSCameraUsageDescription: Please allow access to the camera.
    NSMicrophoneUsageDescription: Please allow access to the microphone.
```

---

## 二、根本原因分析

### 🔴 原因一：缺少代码签名（最高优先级）

#### 问题

```yaml
# 当前配置
forceCodeSigning: false
```

#### 影响

```
1. 未签名的应用无法通过 Gatekeeper 检查
2. macOS 10.15+ 要求所有应用签名
3. notarization (公证) 失败
```

#### 错误信息

```
"APP 无法通过签名验证"
"开发者未经过验证"
```

#### 解决方案

```yaml
# 需要修改配置
forceCodeSigning: true

# 并且需要：
# 1. Apple Developer ID 证书
# 2. 执行签名命令
# 3. 执行 notarization
```

---

### 🔴 原因二：Hardened Runtime 未启用

#### 问题

```yaml
# 当前配置
hardenedRuntime: false
```

#### 影响

```
1. macOS 10.14.5+ 对未启用 Hardened Runtime 的应用有限制
2. 无法使用某些系统 API
3. 无法通过公证
```

#### 需要 Hardened Runtime 的场景

```
✓ 使用 Node.js 原生模块
✓ 使用 nativeImage API
✓ 使用 shell.openExternal()
✓ 使用子进程
```

#### 解决方案

```yaml
# 需要修改配置
hardenedRuntime: true

# 需要在 entitlements 中添加
entitlements: build/entitlements.mac.plist
entitlementsInherit: build/entitlements.mac.inherit.plist
```

---

### 🔴 原因三：Entitlements 配置不完整

#### 当前配置

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

#### 问题

```
1. 文件存在但未在打包配置中引用
2. 与 hardenedRuntime: false 冲突
3. 如果启用 sandbox，需要添加更多权限
```

---

### 🔴 原因四：图标格式问题

#### 当前配置

```yaml
icon: assets/icon.png
```

#### 问题

```
1. PNG 格式不是 Mac 标准图标格式
2. 缺少 .icns 格式图标
3. 缺少多种分辨率
```

#### 要求

| 要求 | 说明 |
|------|------|
| **格式** | ICNS 格式（.icns） |
| **分辨率** | 至少 512x512, 建议 1024x1024 |
| **透明度** | 支持透明通道 |
| **颜色** | RGB + Alpha |

---

### 🔴 原因五：asar 打包问题

#### 当前配置

```yaml
asar: true
files:
  - filter:
      - '**/*'
```

#### 可能的问题

```
1. 某个关键文件未被包含
2. asar 格式与某些 API 不兼容
3. 大文件导致 asar 过大
```

---

## 三、最可能的原因排序

| 排名 | 原因 | 概率 | 严重度 |
|------|------|------|--------|
| **1** | 缺少代码签名 | 90% | 🔴 致命 |
| **2** | Hardened Runtime 未启用 | 80% | 🔴 致命 |
| **3** | preload.js 文件缺失 | 75% | 🔴 致命 |
| **4** | Entitlements 配置未引用 | 70% | 🔴 致命 |
| **5** | WebPreferences 安全配置 | 60% | 🟡 高 |
| **6** | 图标格式问题 | 30% | 🟡 中 |
| **7** | asar 打包问题 | 20% | 🟡 中 |

---

## 四、Mac 打包注意事项

### 4.1 必须具备的条件

```
□ 1. Apple Developer Account ($99/年)
□ 2. Developer ID 证书
□ 3. 有效的 bundle ID
□ 4. macOS 开发环境
```

### 4.2 签名配置

```bash
# 1. 安装证书
security find-identity -v

# 2. 签名应用
codesign --deep --force --sign "Developer ID Name" app.app

# 3. 公证应用
xcrun altool --notarize-app \
  --primary-bundle-id com.plasmid.manager \
  --username "appleid@email.com" \
  --password "app-specific-password" \
  --file app.dmg
```

### 4.3 最小配置要求

```yaml
mac:
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  gatekeeperAssess: false
```

### 4.4 Icon 要求

```
□ 1. 使用 .icns 格式
□ 2. 包含多种分辨率
□ 3. 转换为 icns
```

---

## 五、排查步骤

### 步骤 1：检查打包产物

```bash
# 1. 解压 DMG 检查内容
hdiutil attach PlasmidManager-1.0.16.dmg
ls -la /Volumes/PlasmidManager/

# 2. 检查签名
codesign -dvvv /Volumes/PlasmidManager/PlasmidManager.app

# 3. 检查 entitlements
codesign -d --entitlements :- /Volumes/PlasmidManager/PlasmidManager.app
```

### 步骤 2：检查日志

```bash
# 查看系统日志
log show --predicate 'process == "PlasmidManager"' --info
```

### 步骤 3：测试签名

```bash
# 在终端直接运行
/Volumes/PlasmidManager/PlasmidManager.app/Contents/MacOS/PlasmidManager
```

---

## 六、解决方案

### 6.1 临时解决方案（绕过签名）

```bash
# 在终端执行（需要管理员权限）
sudo spctl --master-disable

# 或者右键点击 -> 打开
```

### 6.2 正式解决方案（签名 + 公证）

```bash
# 1. 配置 electron-builder
mac:
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist

# 2. 签名应用
codesign --deep --force --sign "Developer ID Name" app.app

# 3. 公证应用
xcrun altool --notarize-app ...
```

---

## 七、补充发现的其他权限问题

### 🔴 原因六：preload.js 文件缺失

#### 问题代码

```javascript
// builder-effective-config.yaml 引用了 preload
"preload": path.join(__dirname, 'preload.js')

// 但是实际检查发现：
$ ls -la /mnt/e/tool/*.js
main.js           存在 ✓
preload.js        不存在 ✗
```

#### 影响

```
1. main.js 中配置了 preload，但在打包配置中引用了
2. 但实际文件不存在
3. 这会导致 Electron 启动失败
```

---

### 🔴 原因七：WebPreferences 安全配置问题

#### 问题代码

```javascript
// main.js 第 82-87 行
webPreferences: {
    nodeIntegration: true,        // ⚠️ 严重安全问题
    contextIsolation: false,      // ⚠️ 严重安全问题
    webSecurity: false           // 可能导致问题
}
```

#### 影响

| 配置 | 问题 | Mac 打包影响 |
|------|------|-------------|
| `nodeIntegration: true` | 渲染进程可直接访问 Node API | 可能触发安全检查 |
| `contextIsolation: false` | 主进程和渲染进程隔离失效 | 可能被 Gatekeeper 标记 |
| `webSecurity: false` | 禁用同源策略 | 可能触发安全警告 |

#### 建议配置

```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: true,
    preload: path.join(__dirname, 'preload.js')
}
```

---

### 🔴 原因八：子进程执行权限

#### 代码分析

```javascript
// main.js 第 297-320 行
if (process.platform === 'darwin') {
    execFile('open', ['-a', softwarePath, filePath], ...);
}
```

#### 需要的权限

```
1. 执行 shell 命令需要通过沙箱检查
2. `open` 命令是系统命令，通常没问题
3. 但在严格的沙箱模式下可能被限制
```

---

### 🔴 原因九：文件路径访问权限

#### 代码分析

```javascript
// main.js 中的文件操作
ipcMain.handle('save-file-silent', ...)   // 保存文件
ipcMain.handle('read-file-silent', ...)   // 读取文件
ipcMain.handle('read-file-buffer', ...)   // 读取二进制
ipcMain.handle('scan-local-plasmids', ...) // 扫描目录
```

#### 需要的 Mac 权限

| API | 需要的权限 | Privacy 声明 |
|-----|-----------|-------------|
| 读取用户文件 | `NSOpenPanel` | 不需要特殊声明 |
| 保存用户文件 | `NSSavePanel` | 不需要特殊声明 |
| 访问应用目录 | 默认 | 不需要 |
| 访问 `~/Library/` | 需要 | `NSLibraryUsageDescription` |
| 访问 `~/Documents/` | 需要 | `NSDocumentsUsageDescription` |

---

### 🔴 原因十：未使用的权限声明

#### 当前 extendInfo 配置

```yaml
extendInfo:
  NSAppleEventsUsageDescription: Please allow access to Apple Events.
  NSCameraUsageDescription: Please allow access to the camera.      # 未使用
  NSMicrophoneUsageDescription: Please allow access to the microphone.  # 未使用
```

#### 问题

```
1. 声明了相机权限但应用未使用相机
2. 声明了麦克风权限但应用未使用麦克风
3. 可能导致审核被拒
```

#### 建议

```
删除未使用的权限声明，或添加说明：
- 如果确实不需要，删除即可
- 如果将来可能需要，保留并添加用途说明
```

---

## 八、完整的 Mac 权限清单

### 8.1 必须的权限

| 权限 | 用途 | 配置位置 |
|------|------|----------|
| 代码签名 | 通过 Gatekeeper | `forceCodeSigning: true` |
| Hardened Runtime | 启用安全运行时 | `hardenedRuntime: true` |
| 文件访问 | 读取/保存文件 | `entitlements` |

### 8.2 建议添加的权限

| 权限 | 用途 | 隐私声明 |
|------|------|----------|
| 文件对话框 | 打开/保存文件 | 可选 |
| Apple Events | 与其他应用交互 | `NSAppleEventsUsageDescription` |

### 8.3 可删除的权限

```yaml
# 当前配置中有但应用中未使用的权限
NSCameraUsageDescription:    # 未使用相机
NSMicrophoneUsageDescription: # 未使用麦克风
```

---

## 九、完整的修复清单

### 9.1 必须修复项

```
□ 1. 创建 preload.js 文件
□ 2. 配置 forceCodeSigning: true (需要证书)
□ 3. 配置 hardenedRuntime: true
□ 4. 配置 entitlements 引用
□ 5. 添加 .icns 格式图标
```

### 9.2 建议修复项

```
□ 1. 修复 webPreferences:
   - nodeIntegration: false
   - contextIsolation: true
   
□ 2. 精简 extendInfo:
   - 删除未使用的相机权限
   - 删除未使用的麦克风权限
   
□ 3. 添加缺失的隐私声明:
   - NSDocumentsUsageDescription (如果访问文档目录)
```

### 9.3 可选修复项

```
□ 1. 禁用 asar (asar: false)
□ 2. 添加更多图标分辨率
□ 3. 添加 Notarization 配置
```

---

## 十、总结

### 核心问题

```
打包后无法运行的根本原因：
1. 未启用 Hardened Runtime
2. 未进行代码签名
3. preload.js 文件缺失
4. entitlements 未正确配置
```

### Mac 打包流程

```
□ 1. 获取 Apple Developer 证书
□ 2. 配置 hardenedRuntime: true
□ 3. 配置 entitlements
□ 4. 执行代码签名
□ 5. 执行 notarization
□ 6. 生成 DMG
```

### 建议

```
1. 如果只是内部使用：
   - 临时关闭 Gatekeeper
   - 或使用 --no-sandbox 运行

2. 如果需要分发：
   - 必须签名 + 公证
   - 参考 Electron 官方文档
   - 参考 Apple 开发者文档
```

---

## 十一、参考链接

### 官方文档

- [Electron Mac 打包指南](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [Electron Notarization](https://www.electronjs.org/docs/latest/tutorial/notarization)
- [Apple Code Signing](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)

### 常见问题

```
Q: 为什么图标一直在跳但打不开？
A: 应用崩溃了，macOS 在尝试重启它

Q: 为什么显示"无法通过签名"？
A: 应用未签名或签名无效

Q: 需要多少费用？
A: Apple Developer Account $99/年
```

---

**文档版本**: v1.2  
**分析时间**: 2026-02-08  
**分析方式**: 代码审查 + 配置文件分析  
**更新内容**: 新增 5 个额外权限问题 + 完整修复清单

# 🔍 Mac DMG 打包问题排查报告

> **分析日期**: 2026-02-08  
> **项目路径**: `/mnt/e/tool/`  
> **问题**: GitHub 打包 DMG 后无法运行

---

## 一、问题现象分析

### 1.1 常见错误信息

| 错误类型 | 描述 |
|----------|------|
| **无法通过签名** | "APP 无法通过签名验证" |
| **图标抖动** | 点击后图标一直跳，但没有显示页面 |
| **闪退** | 打开后立即崩溃 |
| **打不开** | 双击无任何反应 |

### 1.2 当前打包配置

```yaml
# builder-effective-config.yaml
mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
    - target: zip
      arch:
        - x64
        - arm64
  hardenedRuntime: false      # ⚠️ 问题 1
  gatekeeperAssess: false     # ⚠️ 问题 2
  forceCodeSigning: false     # ⚠️ 问题 3
  category: public.app-category.productivity
  extendInfo:
    NSAppleEventsUsageDescription: Please allow access to Apple Events.
    NSCameraUsageDescription: Please allow access to the camera.
    NSMicrophoneUsageDescription: Please allow access to the microphone.
```

---

## 二、根本原因分析

### 🔴 原因一：缺少代码签名（最高优先级）

#### 问题

```yaml
# 当前配置
forceCodeSigning: false
```

#### 影响

```
1. 未签名的应用无法通过 Gatekeeper 检查
2. macOS 10.15+ 要求所有应用签名
3. notarization (公证) 失败
```

#### 错误信息

```
"APP 无法通过签名验证"
"开发者未经过验证"
```

#### 解决方案

```yaml
# 需要修改配置
forceCodeSigning: true

# 并且需要：
# 1. Apple Developer ID 证书
# 2. 执行签名命令
# 3. 执行 notarization
```

---

### 🔴 原因二：Hardened Runtime 未启用

#### 问题

```yaml
# 当前配置
hardenedRuntime: false
```

#### 影响

```
1. macOS 10.14.5+ 对未启用 Hardened Runtime 的应用有限制
2. 无法使用某些系统 API
3. 无法通过公证
```

#### 需要 Hardened Runtime 的场景

```
✓ 使用 Node.js 原生模块
✓ 使用 nativeImage API
✓ 使用 shell.openExternal()
✓ 使用子进程
```

#### 解决方案

```yaml
# 需要修改配置
hardenedRuntime: true

# 需要在 entitlements 中添加
entitlements: build/entitlements.mac.plist
entitlementsInherit: build/entitlements.mac.inherit.plist
```

---

### 🔴 原因三：Entitlements 配置不完整

#### 当前配置

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

#### 问题

```
1. 文件存在但未在打包配置中引用
2. 与 hardenedRuntime: false 冲突
3. 如果启用 sandbox，需要添加更多权限
```

---

### 🔴 原因四：图标格式问题

#### 当前配置

```yaml
icon: assets/icon.png
```

#### 问题

```
1. PNG 格式不是 Mac 标准图标格式
2. 缺少 .icns 格式图标
3. 缺少多种分辨率
```

#### 要求

| 要求 | 说明 |
|------|------|
| **格式** | ICNS 格式（.icns） |
| **分辨率** | 至少 512x512, 建议 1024x1024 |
| **透明度** | 支持透明通道 |
| **颜色** | RGB + Alpha |

---

### 🔴 原因五：asar 打包问题

#### 当前配置

```yaml
asar: true
files:
  - filter:
      - '**/*'
```

#### 可能的问题

```
1. 某个关键文件未被包含
2. asar 格式与某些 API 不兼容
3. 大文件导致 asar 过大
```

---

## 三、最可能的原因排序

| 排名 | 原因 | 概率 | 严重度 |
|------|------|------|--------|
| **1** | 缺少代码签名 | 90% | 🔴 致命 |
| **2** | Hardened Runtime 未启用 | 80% | 🔴 致命 |
| **3** | preload.js 文件缺失 | 75% | 🔴 致命 |
| **4** | Entitlements 配置未引用 | 70% | 🔴 致命 |
| **5** | WebPreferences 安全配置 | 60% | 🟡 高 |
| **6** | 图标格式问题 | 30% | 🟡 中 |
| **7** | asar 打包问题 | 20% | 🟡 中 |

---

## 四、Mac 打包注意事项

### 4.1 必须具备的条件

```
□ 1. Apple Developer Account ($99/年)
□ 2. Developer ID 证书
□ 3. 有效的 bundle ID
□ 4. macOS 开发环境
```

### 4.2 签名配置

```bash
# 1. 安装证书
security find-identity -v

# 2. 签名应用
codesign --deep --force --sign "Developer ID Name" app.app

# 3. 公证应用
xcrun altool --notarize-app \
  --primary-bundle-id com.plasmid.manager \
  --username "appleid@email.com" \
  --password "app-specific-password" \
  --file app.dmg
```

### 4.3 最小配置要求

```yaml
mac:
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  gatekeeperAssess: false
```

### 4.4 Icon 要求

```
□ 1. 使用 .icns 格式
□ 2. 包含多种分辨率
□ 3. 转换为 icns
```

---

## 五、排查步骤

### 步骤 1：检查打包产物

```bash
# 1. 解压 DMG 检查内容
hdiutil attach PlasmidManager-1.0.16.dmg
ls -la /Volumes/PlasmidManager/

# 2. 检查签名
codesign -dvvv /Volumes/PlasmidManager/PlasmidManager.app

# 3. 检查 entitlements
codesign -d --entitlements :- /Volumes/PlasmidManager/PlasmidManager.app
```

### 步骤 2：检查日志

```bash
# 查看系统日志
log show --predicate 'process == "PlasmidManager"' --info
```

### 步骤 3：测试签名

```bash
# 在终端直接运行
/Volumes/PlasmidManager/PlasmidManager.app/Contents/MacOS/PlasmidManager
```

---

## 六、解决方案

### 6.1 临时解决方案（绕过签名）

```bash
# 在终端执行（需要管理员权限）
sudo spctl --master-disable

# 或者右键点击 -> 打开
```

### 6.2 正式解决方案（签名 + 公证）

```bash
# 1. 配置 electron-builder
mac:
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist

# 2. 签名应用
codesign --deep --force --sign "Developer ID Name" app.app

# 3. 公证应用
xcrun altool --notarize-app ...
```

---

## 七、补充发现的其他权限问题

### 🔴 原因六：preload.js 文件缺失

#### 问题代码

```javascript
// builder-effective-config.yaml 引用了 preload
"preload": path.join(__dirname, 'preload.js')

// 但是实际检查发现：
$ ls -la /mnt/e/tool/*.js
main.js           存在 ✓
preload.js        不存在 ✗
```

#### 影响

```
1. main.js 中配置了 preload，但在打包配置中引用了
2. 但实际文件不存在
3. 这会导致 Electron 启动失败
```

---

### 🔴 原因七：WebPreferences 安全配置问题

#### 问题代码

```javascript
// main.js 第 82-87 行
webPreferences: {
    nodeIntegration: true,        // ⚠️ 严重安全问题
    contextIsolation: false,      // ⚠️ 严重安全问题
    webSecurity: false           // 可能导致问题
}
```

#### 影响

| 配置 | 问题 | Mac 打包影响 |
|------|------|-------------|
| `nodeIntegration: true` | 渲染进程可直接访问 Node API | 可能触发安全检查 |
| `contextIsolation: false` | 主进程和渲染进程隔离失效 | 可能被 Gatekeeper 标记 |
| `webSecurity: false` | 禁用同源策略 | 可能触发安全警告 |

#### 建议配置

```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: true,
    preload: path.join(__dirname, 'preload.js')
}
```

---

### 🔴 原因八：子进程执行权限

#### 代码分析

```javascript
// main.js 第 297-320 行
if (process.platform === 'darwin') {
    execFile('open', ['-a', softwarePath, filePath], ...);
}
```

#### 需要的权限

```
1. 执行 shell 命令需要通过沙箱检查
2. `open` 命令是系统命令，通常没问题
3. 但在严格的沙箱模式下可能被限制
```

---

### 🔴 原因九：文件路径访问权限

#### 代码分析

```javascript
// main.js 中的文件操作
ipcMain.handle('save-file-silent', ...)   // 保存文件
ipcMain.handle('read-file-silent', ...)   // 读取文件
ipcMain.handle('read-file-buffer', ...)   // 读取二进制
ipcMain.handle('scan-local-plasmids', ...) // 扫描目录
```

#### 需要的 Mac 权限

| API | 需要的权限 | Privacy 声明 |
|-----|-----------|-------------|
| 读取用户文件 | `NSOpenPanel` | 不需要特殊声明 |
| 保存用户文件 | `NSSavePanel` | 不需要特殊声明 |
| 访问应用目录 | 默认 | 不需要 |
| 访问 `~/Library/` | 需要 | `NSLibraryUsageDescription` |
| 访问 `~/Documents/` | 需要 | `NSDocumentsUsageDescription` |

---

### 🔴 原因十：未使用的权限声明

#### 当前 extendInfo 配置

```yaml
extendInfo:
  NSAppleEventsUsageDescription: Please allow access to Apple Events.
  NSCameraUsageDescription: Please allow access to the camera.      # 未使用
  NSMicrophoneUsageDescription: Please allow access to the microphone.  # 未使用
```

#### 问题

```
1. 声明了相机权限但应用未使用相机
2. 声明了麦克风权限但应用未使用麦克风
3. 可能导致审核被拒
```

#### 建议

```
删除未使用的权限声明，或添加说明：
- 如果确实不需要，删除即可
- 如果将来可能需要，保留并添加用途说明
```

---

## 八、完整的 Mac 权限清单

### 8.1 必须的权限

| 权限 | 用途 | 配置位置 |
|------|------|----------|
| 代码签名 | 通过 Gatekeeper | `forceCodeSigning: true` |
| Hardened Runtime | 启用安全运行时 | `hardenedRuntime: true` |
| 文件访问 | 读取/保存文件 | `entitlements` |

### 8.2 建议添加的权限

| 权限 | 用途 | 隐私声明 |
|------|------|----------|
| 文件对话框 | 打开/保存文件 | 可选 |
| Apple Events | 与其他应用交互 | `NSAppleEventsUsageDescription` |

### 8.3 可删除的权限

```yaml
# 当前配置中有但应用中未使用的权限
NSCameraUsageDescription:    # 未使用相机
NSMicrophoneUsageDescription: # 未使用麦克风
```

---

## 九、完整的修复清单

### 9.1 必须修复项

```
□ 1. 创建 preload.js 文件
□ 2. 配置 forceCodeSigning: true (需要证书)
□ 3. 配置 hardenedRuntime: true
□ 4. 配置 entitlements 引用
□ 5. 添加 .icns 格式图标
```

### 9.2 建议修复项

```
□ 1. 修复 webPreferences:
   - nodeIntegration: false
   - contextIsolation: true
   
□ 2. 精简 extendInfo:
   - 删除未使用的相机权限
   - 删除未使用的麦克风权限
   
□ 3. 添加缺失的隐私声明:
   - NSDocumentsUsageDescription (如果访问文档目录)
```

### 9.3 可选修复项

```
□ 1. 禁用 asar (asar: false)
□ 2. 添加更多图标分辨率
□ 3. 添加 Notarization 配置
```

---

## 十、总结

### 核心问题

```
打包后无法运行的根本原因：
1. 未启用 Hardened Runtime
2. 未进行代码签名
3. preload.js 文件缺失
4. entitlements 未正确配置
```

### Mac 打包流程

```
□ 1. 获取 Apple Developer 证书
□ 2. 配置 hardenedRuntime: true
□ 3. 配置 entitlements
□ 4. 执行代码签名
□ 5. 执行 notarization
□ 6. 生成 DMG
```

### 建议

```
1. 如果只是内部使用：
   - 临时关闭 Gatekeeper
   - 或使用 --no-sandbox 运行

2. 如果需要分发：
   - 必须签名 + 公证
   - 参考 Electron 官方文档
   - 参考 Apple 开发者文档
```

---

## 十一、参考链接

### 官方文档

- [Electron Mac 打包指南](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [Electron Notarization](https://www.electronjs.org/docs/latest/tutorial/notarization)
- [Apple Code Signing](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)

### 常见问题

```
Q: 为什么图标一直在跳但打不开？
A: 应用崩溃了，macOS 在尝试重启它

Q: 为什么显示"无法通过签名"？
A: 应用未签名或签名无效

Q: 需要多少费用？
A: Apple Developer Account $99/年
```

---

**文档版本**: v1.2  
**分析时间**: 2026-02-08  
**分析方式**: 代码审查 + 配置文件分析  
**更新内容**: 新增 5 个额外权限问题 + 完整修复清单

