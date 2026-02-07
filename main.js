const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function createWindow() {
  // 数据目录：打包后应使用用户数据目录，开发环境使用本地 data 目录
  const userDataPath = app.isPackaged ? app.getPath('userData') : __dirname;
  const logDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const iconPath = path.join(__dirname, 'assets', 'icon.png'); // 优先使用 PNG 提高兼容性
  const image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
  
  // 打印日志到文件以供调试
  fs.appendFileSync(path.join(logDir, 'app_debug.log'), `[${new Date().toLocaleString()}] [INFO] App started. UserData: ${userDataPath}\n`);

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

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    try {
      const fullTime = new Date().toLocaleString();
      const logPath = path.join(__dirname, 'data', 'app_debug.log');
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const levelText = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
      fs.appendFileSync(logPath, `[${fullTime}] [${levelText}] [RendererConsole] ${message} (${sourceId}:${line})\n`, 'utf8');
    } catch (e) {
      console.error('Failed to mirror renderer console message:', e);
    }
  });
  
  // 生产环境下可以关闭菜单栏
    // win.setMenu(null);
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
    
    let created = false;
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
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

// 核心功能：读取文件 Buffer（用于 DNA 等二进制或特殊格式文件）
ipcMain.handle('read-file-buffer', async (event, relativePath) => {
    try {
        const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(__dirname, relativePath);
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
            // 使用指定软件打开，处理路径中的空格
            const command = `"${softwarePath}" "${filePath}"`;
            exec(command, (error) => {
                if (error) {
                    console.error('Exec error:', error);
                }
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
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
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
    const result = await dialog.showSaveDialog({
        title: '新建数据库',
        defaultPath: path.join(__dirname, 'data', 'new_database.json'),
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
        const logPath = path.join(__dirname, 'data', 'app_debug.log');
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
