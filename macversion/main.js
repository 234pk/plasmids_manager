const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');

if (!app.isPackaged) {
  try {
    const devUserData = path.join(app.getPath('appData'), `${app.getName()}-dev`);
    app.setPath('userData', devUserData);
    app.setPath('cache', path.join(devUserData, 'Cache'));
  } catch (_) {}
}

function getAppDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

function getLogPath() {
  return path.join(getAppDataDir(), 'app_debug.log');
}

function ensureUtf8BomFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, bom);
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    fs.writeFileSync(filePath, bom);
    return;
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(3);
    const bytesRead = fs.readSync(fd, head, 0, 3, 0);
    if (bytesRead === 3 && head.equals(bom)) return;
  } finally {
    fs.closeSync(fd);
  }

  if (stat.size > 5 * 1024 * 1024) {
    const bakPath = `${filePath}.bak`;
    try {
      if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
    } catch (_) {}
    fs.renameSync(filePath, bakPath);
    fs.writeFileSync(filePath, bom);
    fs.appendFileSync(filePath, `[${new Date().toLocaleString()}] [INFO] Log rotated to preserve UTF-8 BOM. Previous log: ${path.basename(bakPath)}\n`, 'utf8');
    return;
  }

  const existing = fs.readFileSync(filePath);
  fs.writeFileSync(filePath, Buffer.concat([bom, existing]));
}

function createWindow() {
  const dataDir = getAppDataDir();
  const logPath = getLogPath();
  ensureUtf8BomFile(logPath);

  const iconPath = process.platform === 'darwin' 
    ? path.join(__dirname, 'assets', 'icon.icns') 
    : path.join(__dirname, 'assets', 'icon.png');
  const image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
  
  // 打印日志到文件以供调试
  fs.appendFileSync(logPath, `[${new Date().toLocaleString()}] [INFO] App started. DataDir: ${dataDir}\n`, 'utf8');

  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "质粒管理系统 - 桌面版",
    icon: image,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // 允许在桌面端加载本地资源
    }
  });

  win.loadFile('index.html');

  // win.webContents.openDevTools({ mode: 'detach' });

  win.webContents.on('console-message', (event) => {
    try {
      const fullTime = new Date().toLocaleString();
      const logPath = getLogPath();
      ensureUtf8BomFile(logPath);
      if (!event || typeof event !== 'object' || !('message' in event)) {
        fs.appendFileSync(logPath, `[${fullTime}] [INFO] [RendererConsole] (console-message event missing payload)\n`, 'utf8');
        return;
      }

      const levelText = event.level === 3 ? 'ERROR' : event.level === 2 ? 'WARN' : 'INFO';
      fs.appendFileSync(logPath, `[${fullTime}] [${levelText}] [RendererConsole] ${event.message} (${event.sourceId}:${event.line})\n`, 'utf8');
    } catch (e) {
      console.error('Failed to mirror renderer console message:', e);
    }
  });
  
  // 生产环境下可以在非 Mac 平台关闭菜单栏
  if (app.isPackaged && process.platform !== 'darwin') {
    win.setMenu(null);
  }
}

// 核心功能：静默保存文件（用于自动保存数据库）
ipcMain.handle('save-file-silent', async (event, { data, path: targetPath }) => {
    try {
        const userDataPath = app.isPackaged ? app.getPath('userData') : __dirname;
        const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(userDataPath, targetPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // 如果是对象，则转换为字符串保存
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        fs.writeFileSync(fullPath, content, 'utf8');
        return true;
    } catch (err) {
        console.error('Silent save error:', err);
        return false;
    }
});

// 核心功能：静默读取文件
ipcMain.handle('read-file-silent', async (event, targetPath) => {
    try {
        const userDataPath = app.isPackaged ? app.getPath('userData') : __dirname;
        const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(userDataPath, targetPath);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf8');
        }
        return null;
    } catch (err) {
        console.error('Silent read error:', err);
        return null;
    }
});

// 核心功能：检查并初始化必要文件
ipcMain.handle('check-init-files', async () => {
    const userDataPath = app.isPackaged ? app.getPath('userData') : __dirname;
    const dataDir = path.join(userDataPath, 'data');
    const dbPath = path.join(dataDir, 'plasmid_database.json');
    const settingsPath = path.join(dataDir, 'settings.json');
    const historyPath = path.join(dataDir, 'app_history.json');
    
    let created = false;
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(historyPath)) {
        fs.writeFileSync(historyPath, JSON.stringify({ lastDatabase: '', recentDatabases: [] }, null, 2), 'utf8');
    }

    if (!fs.existsSync(dbPath)) {
        // 尝试从本地或根目录寻找旧版数据库文件（用于迁移）
        const localDbPath = path.join(__dirname, 'data', 'plasmid_database.json');
        const oldDbPath = path.join(__dirname, 'plasmid_database.json');
        
        if (fs.existsSync(localDbPath)) {
            fs.copyFileSync(localDbPath, dbPath);
        } else if (fs.existsSync(oldDbPath)) {
            fs.copyFileSync(oldDbPath, dbPath);
        } else {
            fs.writeFileSync(dbPath, '[]', 'utf8');
        }
        created = true;
    }
    
    if (!fs.existsSync(settingsPath)) {
        const localSettingsPath = path.join(__dirname, 'data', 'settings.json');
        if (fs.existsSync(localSettingsPath)) {
            fs.copyFileSync(localSettingsPath, settingsPath);
        } else {
            const defaultSettings = {
                theme: 'light',
                autoSave: true,
                externalSoftwarePath: '',
                recognitionConfig: {
                    minMatchScore: 0.75,
                    enableNlp: true,
                    extractTargetGene: true,
                    saveSequence: true // 新增：是否自动保存序列
                },
                displayConfig: {
                    showTags: true,
                    showDate: true,
                    itemsPerPage: 20,
                    batchPathPrefix: '',
                    columnVisibility: {
                        '质粒信息': true,
                        '特征与分类': true,
                        '抗性': true,
                        '专业特征': true,
                        '序列信息': true, // 新增：序列信息列
                        '描述': true
                    }
                }
            };
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
        }
        created = true;
    }

    // 初始化序列存储目录
    const seqDir = path.join(dataDir, 'sequences');
    if (!fs.existsSync(seqDir)) {
        fs.mkdirSync(seqDir, { recursive: true });
    }

    return created;
});

// 核心功能：历史记录管理
ipcMain.handle('get-app-history', async () => {
    try {
        const historyPath = path.join(getAppDataDir(), 'app_history.json');
        if (fs.existsSync(historyPath)) {
            return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }
        return { lastDatabase: '', recentDatabases: [] };
    } catch (err) {
        return { lastDatabase: '', recentDatabases: [] };
    }
});

ipcMain.handle('save-app-history', async (event, history) => {
    try {
        const historyPath = path.join(getAppDataDir(), 'app_history.json');
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
        return true;
    } catch (err) {
        return false;
    }
});

// 核心功能：读取文件 Buffer（用于 DNA 等二进制或特殊格式文件）
ipcMain.handle('read-file-buffer', async (event, relativePath) => {
    try {
        const baseDir = app.getPath('userData');
        const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(baseDir, relativePath);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath);
        }
        return null;
    } catch (err) {
        console.error('Buffer read error:', err);
        return null;
    }
});

// 核心功能：获取真实绝对路径
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
  const defaultFilters = [
    { name: '质粒文件', extensions: ['dna', 'gb', 'gbk', 'fasta', 'seq', 'txt'] },
    { name: '所有文件', extensions: ['*'] }
  ];
  
  const filters = options.filters || defaultFilters;
  const properties = options.properties || ['openFile', 'multiSelections'];

  const result = await dialog.showOpenDialog({
    properties: properties,
    filters: filters
  });
  return result.filePaths; // 返回 100% 真实的绝对路径
});

// 核心功能：获取文件夹内的所有文件绝对路径
ipcMain.handle('open-directory-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return [];
  
  const dirPath = result.filePaths[0];
  // 可以在这里递归获取所有文件，或者直接返回目录路径
  return dirPath;
});

// 核心功能：打开文件（支持默认软件或指定路径）
ipcMain.handle('open-file-native', async (event, { filePath, softwarePath }) => {
    try {
        if (!filePath) return { success: false, error: '路径为空' };
        if (!fs.existsSync(filePath)) {
            return { success: false, error: '文件不存在: ' + filePath };
        }

        if (softwarePath && fs.existsSync(softwarePath)) {
            if (process.platform === 'darwin') {
                execFile('open', ['-a', softwarePath, filePath], (error) => {
                    if (error) console.error('open -a error:', error);
                });
                return { success: true };
            }

            if (process.platform === 'win32') {
                const command = `"${softwarePath}" "${filePath}"`;
                exec(command, (error) => {
                    if (error) console.error('Exec error:', error);
                });
                return { success: true };
            }

            execFile(softwarePath, [filePath], (error) => {
                if (error) console.error('execFile error:', error);
            });
            return { success: true };
        } else {
            // 使用系统默认关联软件打开
            await shell.openPath(filePath);
            return { success: true };
        }
    } catch (err) {
        console.error('Open file error:', err);
        return { success: false, error: err.message };
    }
});

// 核心功能：打开文件所在文件夹并选中
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    try {
        if (!filePath) return false;
        const baseDir = app.getPath('userData');
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
        if (!fs.existsSync(fullPath)) return false;
        
        shell.showItemInFolder(fullPath);
        return true;
    } catch (err) {
        console.error('Show item error:', err);
        return false;
    }
});

// 核心功能：新建数据库对话框
ipcMain.handle('save-database-dialog', async () => {
    const dataDir = getAppDataDir();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const result = await dialog.showSaveDialog({
        title: '新建数据库',
        defaultPath: path.join(dataDir, 'new_database.json'),
        filters: [
            { name: 'JSON Database', extensions: ['json'] }
        ]
    });
    return result.filePath;
});

// 核心功能：选择执行文件路径
ipcMain.handle('select-executable', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Executables', extensions: ['exe', 'app', 'sh'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 核心功能：扫描当前目录下的质粒文件
ipcMain.handle('scan-local-plasmids', async () => {
    try {
        const files = fs.readdirSync(__dirname);
        const plasmidExtensions = ['.dna', '.gb', '.gbk', '.fasta', '.seq', '.txt'];
        const plasmidFiles = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return plasmidExtensions.includes(ext);
        }).map(f => ({
            name: f,
            path: path.join(__dirname, f)
        }));
        return plasmidFiles;
    } catch (err) {
        console.error('Scan error:', err);
        return [];
    }
});

ipcMain.on('write-debug-log', (event, logLine) => {
    try {
        const logPath = getLogPath();
        ensureUtf8BomFile(logPath);
        fs.appendFileSync(logPath, logLine, 'utf8');
    } catch (err) {
        console.error('Failed to write debug log:', err);
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
