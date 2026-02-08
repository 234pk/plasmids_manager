/**
 * Database Management Module
 * Handles database creation, switching, and loading logic.
 */

window.DbManager = {
    /**
     * 调试用 Ping 方法
     */
    ping: () => {
        console.log('DEBUG: [DbManager] Ping Success');
        return true;
    },

    /**
     * Create a new empty database file
     */
    createNewDatabase: async () => {
        console.log('DEBUG: [DbManager] createNewDatabase called');
        if (!window.isElectron) {
            window.Utils.showToast('Web版暂不支持新建外部数据库文件', 'WARN');
            return null;
        }

        if (!window.electronAPI) {
             console.error('DEBUG: [DbManager] window.electronAPI is missing despite isElectron=true');
             window.Utils.showToast('系统内部错误: Electron API 未初始化', 'ERROR');
             return null;
        }

        try {
            console.log('DEBUG: [DbManager] Invoking save-database-dialog');
            const filePath = await window.electronAPI.invoke('save-database-dialog');
            
            if (!filePath) {
                console.log('DEBUG: [DbManager] Save dialog canceled by user');
                return null;
            }

            console.log(`DEBUG: [DbManager] Selected path: ${filePath}`);
            // Create empty database
            const emptyDb = [];
            const success = await window.electronAPI.invoke('save-file-silent', { 
                data: emptyDb, 
                path: filePath 
            });

            if (success) {
                console.log('DEBUG: [DbManager] New database created successfully');
                return { filePath, data: emptyDb };
            } else {
                throw new Error('Failed to create database file');
            }
        } catch (err) {
            console.error('DEBUG: [DbManager] Create DB Error:', err);
            window.Utils.showToast('新建数据库失败: ' + err.message, 'ERROR');
            return null;
        }
    },

    /**
     * Open/Switch to an existing database
     */
    switchDatabase: async () => {
        console.log('DEBUG: [DbManager] switchDatabase called');
        if (!window.isElectron) {
             console.log('DEBUG: [DbManager] Not in Electron, skipping switchDatabase');
             return null;
        }

        if (!window.electronAPI) {
             console.error('DEBUG: [DbManager] window.electronAPI is missing despite isElectron=true');
             window.Utils.showToast('系统内部错误: Electron API 未初始化', 'ERROR');
             return null;
        }

        try {
            console.log('DEBUG: [DbManager] Invoking open-file-dialog');
            const filePaths = await window.electronAPI.invoke('open-file-dialog', {
                filters: [{ name: 'JSON Database', extensions: ['json'] }],
                properties: ['openFile']
            });
            
            if (filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                console.log(`DEBUG: [DbManager] Reading file: ${filePath}`);
                const content = await window.electronAPI.invoke('read-file-silent', filePath);
                if (content) {
                    try {
                        const data = JSON.parse(content);
                        console.log('DEBUG: [DbManager] Database loaded and parsed successfully');
                        return { filePath, data };
                    } catch (e) {
                        console.error('DEBUG: [DbManager] JSON Parse Error');
                        throw new Error('Invalid JSON format');
                    }
                }
            }
            console.log('DEBUG: [DbManager] No file selected or empty content');
            return null;
        } catch (err) {
            console.error('DEBUG: [DbManager] Switch DB Error:', err);
            window.Utils.showToast('切换数据库失败: ' + err.message, 'ERROR');
            return null;
        }
    }
};
