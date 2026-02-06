/**
 * Database Management Module
 * Handles database creation, switching, and loading logic.
 */

window.DbManager = {
    /**
     * Create a new empty database file
     */
    createNewDatabase: async () => {
        if (!window.isElectron) {
            window.Utils.showToast('Web版暂不支持新建外部数据库文件', 'WARN');
            return null;
        }

        try {
            const { ipcRenderer } = window.require('electron');
            const filePath = await ipcRenderer.invoke('save-database-dialog');
            
            if (!filePath) return null; // User canceled

            // Create empty database
            const emptyDb = [];
            const success = await ipcRenderer.invoke('save-file-silent', { 
                data: emptyDb, 
                path: filePath 
            });

            if (success) {
                return { filePath, data: emptyDb };
            } else {
                throw new Error('Failed to create database file');
            }
        } catch (err) {
            console.error('Create DB Error:', err);
            window.Utils.showToast('新建数据库失败: ' + err.message, 'ERROR');
            return null;
        }
    },

    /**
     * Open/Switch to an existing database
     */
    switchDatabase: async () => {
        if (!window.isElectron) {
             // Web fallback (using File System Access API if available, or input)
             // This is handled in app.js for now as it involves UI refs
             return null;
        }

        try {
            const { ipcRenderer } = window.require('electron');
            const filePaths = await ipcRenderer.invoke('open-file-dialog', {
                filters: [{ name: 'JSON Database', extensions: ['json'] }],
                properties: ['openFile']
            });
            
            if (filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                const content = await ipcRenderer.invoke('read-file-silent', filePath);
                if (content) {
                    try {
                        const data = JSON.parse(content);
                        return { filePath, data };
                    } catch (e) {
                        throw new Error('Invalid JSON format');
                    }
                }
            }
            return null;
        } catch (err) {
            console.error('Switch DB Error:', err);
            window.Utils.showToast('切换数据库失败: ' + err.message, 'ERROR');
            return null;
        }
    }
};
