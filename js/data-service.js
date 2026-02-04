/**
 * 数据持久化与文件操作服务
 */
window.DataService = {
    CACHE_KEY: 'plasmid_data_cache',
    SETTINGS_KEY: 'plasmid_settings_cache',
    DB_NAME: 'PlasmidSystemDB',
    STORE_NAME: 'fileHandles',

    /**
     * IndexedDB 辅助函数：存储/获取文件句柄
     */
    getHandle: async (key) => {
        return new Promise((resolve) => {
            const request = indexedDB.open(window.DataService.DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(window.DataService.STORE_NAME);
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(window.DataService.STORE_NAME, 'readonly');
                const store = tx.objectStore(window.DataService.STORE_NAME);
                const getReq = store.get(key);
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    },

    setHandle: async (key, handle) => {
        return new Promise((resolve) => {
            const request = indexedDB.open(window.DataService.DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(window.DataService.STORE_NAME);
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(window.DataService.STORE_NAME, 'readwrite');
                const store = tx.objectStore(window.DataService.STORE_NAME);
                store.put(handle, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            };
        });
    },

    saveToCache: (data) => {
        try {
            const jsonStr = JSON.stringify(data);
            if (jsonStr.length < 5000000) { // 5MB 限制
                localStorage.setItem(window.DataService.CACHE_KEY, jsonStr);
                return true;
            }
        } catch (e) {
            console.warn('Data too large for localStorage cache');
        }
        return false;
    },

    loadFromCache: () => {
        const cachedData = localStorage.getItem(window.DataService.CACHE_KEY);
        if (cachedData) {
            try {
                return JSON.parse(cachedData);
            } catch (e) {
                localStorage.removeItem(window.DataService.CACHE_KEY);
            }
        }
        return null;
    },

    loadDatabase: async () => {
        // 桌面端环境
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const content = await ipcRenderer.invoke('read-file-silent', 'data/plasmid_database.json');
                if (content) {
                    const data = JSON.parse(content);
                    window.DataService.saveToCache(data);
                    return data;
                }
            } catch (e) {
                console.warn('Could not load plasmid_database.json via IPC');
            }
        }

        // 其次从缓存加载 (作为 Electron 环境下的内存/本地缓存兜底)
        return window.DataService.loadFromCache();
    },

    loadSettings: async () => {
        // 桌面端优先从本地文件加载
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const content = await ipcRenderer.invoke('read-file-silent', 'data/settings.json');
                if (content) {
                    const settings = JSON.parse(content);
                    localStorage.setItem(window.DataService.SETTINGS_KEY, JSON.stringify(settings));
                    return settings;
                }
            } catch (e) {
                console.warn('Could not load settings.json via IPC');
            }
        }

        // 其次从 localStorage 加载
        const cached = localStorage.getItem(window.DataService.SETTINGS_KEY);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error('Failed to parse cached settings');
            }
        }

        return null;
    },

    saveSettings: async (settings) => {
        try {
            localStorage.setItem(window.DataService.SETTINGS_KEY, JSON.stringify(settings));
            
            // 桌面端自动同步到 settings.json
            if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
                await window.DataService.electronSave(settings, 'data/settings.json');
            }
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    },

    clearCache: () => {
        localStorage.removeItem(window.DataService.CACHE_KEY);
        localStorage.removeItem(window.DataService.SETTINGS_KEY);
    },

    /**
     * File System Access API: 直接保存到本地文件
     */
    saveToFile: async (data, filename, existingHandle = null) => {
        try {
            let handle = existingHandle;
            
            // 如果没有句柄，或者句柄权限已过期，则弹出选择器
            if (!handle) {
                handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
            } else {
                // 验证权限
                const options = { mode: 'readwrite' };
                if (await handle.queryPermission(options) !== 'granted') {
                    if (await handle.requestPermission(options) !== 'granted') {
                        throw new Error('Permission denied');
                    }
                }
            }
            
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            return handle; // 返回句柄以便后续使用
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Direct save failed:', e);
            }
            return null;
        }
    },

    /**
     * Electron 专用：静默保存到硬盘
     */
    electronSave: async (data, relativePath = 'data/plasmid_database.json') => {
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('save-file-silent', {
                    data: JSON.stringify(data, null, 2),
                    path: relativePath
                });
                return result;
            } catch (err) {
                console.error('Electron silent save failed:', err);
                return false;
            }
        }
        return false;
    },

    downloadJSON: (data, filename = 'plasmid_database_updated.json') => {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    downloadCSV: (data, filename = 'plasmid_export.csv', customHeaders = null) => {
        if (!data || data.length === 0) return;
        
        const headers = customHeaders || ["文件名", "载体类型", "靶基因", "物种", "功能", "大肠杆菌抗性", "哺乳动物抗性", "插入类型", "蛋白标签", "荧光蛋白", "启动子", "突变", "四环素诱导", "序列", "路径", "描述"];
        
        const rows = data.map(p => {
            return headers.map(header => {
                let val = p[header] || "";
                if (Array.isArray(val)) val = val.join("; ");
                val = val.toString().replace(/"/g, '""');
                return `"${val}"`;
            }).join(",");
        });
        
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * 解析序列文件
     * 支持 FASTA, TXT, GB, DNA (SnapGene)
     */
    extractSequence: async (fileOrPath) => {
        try {
            let content;
            let fileName;

            if (typeof fileOrPath === 'string') {
                // 桌面端路径
                fileName = fileOrPath.split(/[\\\/]/).pop();
                const { ipcRenderer } = window.require('electron');
                const buffer = await ipcRenderer.invoke('read-file-buffer', fileOrPath);
                if (!buffer) return null;
                content = buffer;
            } else {
                // 浏览器 File 对象
                fileName = fileOrPath.name;
                content = await fileOrPath.arrayBuffer();
            }

            const ext = fileName.split('.').pop().toLowerCase();
            const decoder = new TextDecoder('utf-8');

            // 1. FASTA / TXT / SEQ 直接读取
            if (['fasta', 'fas', 'fa', 'txt', 'seq'].includes(ext)) {
                const text = decoder.decode(content);
                if (ext === 'fasta' || ext === 'fas' || ext === 'fa') {
                    // 移除 FASTA 头
                    return text.split('\n').filter(line => !line.startsWith('>')).join('').replace(/\s/g, '').toUpperCase();
                }
                return text.replace(/[^a-zA-Z]/g, '').toUpperCase();
            }

            // 2. GenBank (GB/GBK) 解析
            if (['gb', 'gbk'].includes(ext)) {
                const text = decoder.decode(content);
                const originMatch = text.match(/ORIGIN\s+([\s\S]+?)\/\//i);
                if (originMatch) {
                    return originMatch[1].replace(/[\d\s]/g, '').toUpperCase();
                }
                return null;
            }

            // 3. SnapGene (DNA) 解析
            // .dna 文件是基于 XML 的，但头部有一些二进制数据
            if (ext === 'dna') {
                const text = decoder.decode(content);
                // 尝试匹配 <Sequence> 标签
                const seqMatch = text.match(/<Sequence>([\s\S]+?)<\/Sequence>/i);
                if (seqMatch) {
                    return seqMatch[1].replace(/[^a-zA-Z]/g, '').toUpperCase();
                }
                
                // 如果直接解码失败，尝试从二进制中找 DNA 序列特征
                // SnapGene 的序列通常紧跟在特定二进制头之后
                const uint8 = new Uint8Array(content);
                // 寻找简单的 ATCG 序列（针对非 XML 格式的旧版或加密版）
                // 这里仅做简单提取，实际可能更复杂
                let rawText = "";
                for(let i=0; i<uint8.length; i++) {
                    const c = String.fromCharCode(uint8[i]);
                    if(/[ATCGatcg]/.test(c)) rawText += c;
                    else if(rawText.length > 20) break; // 假设序列是连续的
                    else rawText = "";
                }
                return rawText.toUpperCase();
            }

            return null;
        } catch (err) {
            console.error('Sequence extraction failed:', err);
            return null;
        }
    },

    /**
     * 保存序列到本地文件 (FASTA 格式)
     */
    saveSequenceToFile: async (plasmidName, sequence) => {
        if (!sequence) return null;
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            const { ipcRenderer } = window.require('electron');
            const safeName = plasmidName.replace(/[\\\/:\*\?"<>\|]/g, '_');
            const relativePath = `data/sequences/${safeName}.fasta`;
            
            // 转换为 FASTA 格式
            const fastaContent = `>${plasmidName}\n${sequence.replace(/(.{60})/g, '$1\n').trim()}`;
            
            await ipcRenderer.invoke('save-file-silent', {
                data: fastaContent,
                path: relativePath
            });
            return relativePath;
        }
        return null;
    },

    parseCSV: (text) => {
        if (!text) return [];
        
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];

        // 处理带引号的 CSV 分割
        const splitCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i+1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = splitCSVLine(lines[0].replace(/^\uFEFF/, '')); // 移除 BOM
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = splitCSVLine(lines[i]);
            const item = {};
            
            headers.forEach((header, index) => {
                let val = values[index] || "";
                // 处理数组字段 (用 ; 分隔)
                const arrayFields = ["载体类型", "靶基因", "物种", "功能", "大肠杆菌抗性", "哺乳动物抗性", "插入类型", "蛋白标签", "荧光蛋白", "启动子", "突变", "四环素诱导"];
                if (arrayFields.includes(header)) {
                    item[header] = val ? val.split(';').map(v => v.trim()).filter(v => v) : [];
                } else {
                    item[header] = val;
                }
            });

            if (item.文件名) {
                data.push(item);
            }
        }
        return data;
    }
};
