/**
 * 数据持久化与文件操作服务
 */
window.DataService = {
    CACHE_KEY: 'plasmid_data_cache',
    SETTINGS_KEY: 'plasmid_settings_cache',
    DB_NAME: 'PlasmidSystemDB',
    STORE_NAME: 'fileHandles',
    currentDatabasePath: 'data/plasmid_database.json', // Default path

    /**
     * Set the current database path for saving
     */
    setDatabasePath: (path) => {
        window.DataService.currentDatabasePath = path;
    },

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

    loadProjects: async () => {
        // 桌面端环境
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const content = await ipcRenderer.invoke('read-file-silent', 'data/projects.json');
                if (content) {
                    return JSON.parse(content);
                }
            } catch (e) {
                console.warn('Could not load projects.json via IPC');
            }
        }
        return { projects: [] };
    },

    saveProjects: async (data) => {
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            await window.DataService.electronSave(data, 'data/projects.json');
            return true;
        }
        return false;
    },

    loadDatabase: async (customPath = null) => {
        // 桌面端环境
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const path = customPath || window.DataService.currentDatabasePath;
                const content = await ipcRenderer.invoke('read-file-silent', path);
                if (content) {
                    const data = JSON.parse(content);
                    window.DataService.saveToCache(data);
                    // Update current path if load successful
                    if (customPath) window.DataService.currentDatabasePath = customPath;
                    return data;
                }
            } catch (e) {
                console.warn('Could not load database via IPC:', e);
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
    electronSave: async (data, relativePath = null) => {
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                // Use provided path or default to current database path
                const targetPath = relativePath || window.DataService.currentDatabasePath;
                const result = await ipcRenderer.invoke('save-file-silent', {
                    data: JSON.stringify(data, null, 2),
                    path: targetPath
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
        
        // 默认表头添加 时间字段
        const headers = customHeaders || [
            "文件名", "载体类型", "靶基因", "物种", "功能", 
            "大肠杆菌抗性", "哺乳动物抗性", "插入类型", "蛋白标签", 
            "荧光蛋白", "启动子", "突变", "四环素诱导", 
            "保存位置", "持有人", "项目", 
            "添加时间", "更新时间", // 新增
            "序列", "序列文件", "路径", "描述"
        ];
        
        const rows = data.map(p => {
            return headers.map(header => {
                let val = p[header];
                
                // 时间字段格式化
                if ((header === '添加时间' || header === '更新时间') && val) {
                    try {
                        val = new Date(val).toLocaleString();
                    } catch (e) {
                        val = "";
                    }
                } else {
                    val = val || "";
                }

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
            // .dna 文件可能是 XML 格式或二进制格式
            if (ext === 'dna') {
                const text = decoder.decode(content);
                
                // 3.1 尝试解析 XML 格式
                // 宽松检查：只要包含 XML 特征标签即可
                if (text.trim().startsWith('<?xml') || text.includes('<SnapGene') || text.includes('<Plasmid')) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, "text/xml");
                        // 尝试从 Plasmid -> Sequence 或直接 Sequence 标签获取 (忽略大小写)
                        const seqNode = doc.querySelector('Sequence') || doc.querySelector('sequence');
                        if (seqNode) {
                            return seqNode.textContent.replace(/[^a-zA-Z]/g, '').toUpperCase();
                        }
                    } catch (e) {
                        console.warn('XML parsing failed for .dna file, falling back to binary extraction', e);
                    }
                }
                
                // 3.2 尝试匹配 <Sequence> 标签 (正则备份)
                const seqMatch = text.match(/<Sequence>([\s\S]+?)<\/Sequence>/i);
                if (seqMatch) {
                    return seqMatch[1].replace(/[^a-zA-Z]/g, '').toUpperCase();
                }
                
                // 3.3 二进制回退逻辑
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
     * 将 SnapGene XML 内容转换为 GenBank 格式
     */
    snapGeneXmlToGenBank: (xmlContent, plasmidName) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, "text/xml");
            
            // Helper for case-insensitive selection
            const getOne = (parent, tagName) => {
                return parent.querySelector(tagName) || parent.querySelector(tagName.toLowerCase());
            };
            const getAll = (parent, tagName) => {
                const els = parent.querySelectorAll(tagName);
                return els.length > 0 ? els : parent.querySelectorAll(tagName.toLowerCase());
            };

            const seqNode = getOne(doc, 'Sequence');
            if (!seqNode) return null;
            
            const sequence = seqNode.textContent.replace(/[^a-zA-Z]/g, '').toLowerCase();
            const length = sequence.length;
            const date = new Date().toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}).toUpperCase().replace(/ /g, '-');
            
            // 构建 GenBank 头部
            let gb = `LOCUS       ${(plasmidName || 'Unknown').substring(0, 16).padEnd(16)} ${String(length).padStart(11)} bp    DNA     circular SYN ${date}\n`;
            gb += `DEFINITION  ${plasmidName || 'Unknown'}\n`;
            gb += `ACCESSION   ${plasmidName || 'Unknown'}\n`;
            gb += `VERSION     ${plasmidName || 'Unknown'}\n`;
            gb += `KEYWORDS    .\n`;
            gb += `SOURCE      Unknown.\n`;
            gb += `  ORGANISM  Unknown.\n`;
            gb += `FEATURES             Location/Qualifiers\n`;
            
            // 提取特征
            let features = getAll(doc, 'Feature');

            features.forEach(f => {
                const name = f.getAttribute('name') || 'feature';
                const type = f.getAttribute('type') || 'misc_feature';
                const directionality = f.getAttribute('directionality'); // 1: forward, 2: reverse
                
                // 尝试获取位置信息
                const segments = getAll(f, 'Segment');
                segments.forEach(seg => {
                    const start = seg.getAttribute('start');
                    const end = seg.getAttribute('end');
                    
                    if (start && end) {
                        let locStr = `${start}..${end}`;
                        // 如果方向是反向 (SnapGene: directionality="2" often means reverse)
                        if (directionality === '2') {
                            locStr = `complement(${locStr})`;
                        }
                        
                        let gbType = 'misc_feature';
                        const t = type.toLowerCase();
                        
                        // Enhanced mapping for SnapGene types
                        if (t === 'cds') gbType = 'CDS';
                        else if (t.includes('promoter')) gbType = 'promoter';
                        else if (t.includes('terminator')) gbType = 'terminator';
                        else if (t.includes('origin') || t.includes('ori')) gbType = 'rep_origin';
                        else if (t.includes('primer')) gbType = 'primer_bind';
                        else if (t.includes('enhancer')) gbType = 'enhancer';
                        else if (t.includes('polya') || t.includes('poly a')) gbType = 'polyA_signal';
                        else if (t.includes('signal')) gbType = 'sig_peptide';
                        else if (t.includes('gene')) gbType = 'gene';
                        else if (t.includes('exon')) gbType = 'exon';
                        else if (t.includes('intron')) gbType = 'intron';
                        else if (t.includes('ltr')) gbType = 'LTR';
                        else if (t.includes('utr')) gbType = "5'UTR"; 
                        else if (t.includes('source')) gbType = 'source';
                        else if (t.includes('misc')) gbType = 'misc_feature';
                        
                        gb += `     ${gbType.padEnd(16)}${locStr}\n`;
                        gb += `                     /label="${name}"\n`;
                        gb += `                     /note="${name}"\n`;
                    }
                });
            });
            
            gb += `ORIGIN\n`;
            
            // 序列内容 (每行60个字符，10个一组)
            for (let i = 0; i < length; i += 60) {
                const lineSeq = sequence.substr(i, 60);
                const chunks = lineSeq.match(/.{1,10}/g) || [];
                gb += `${String(i + 1).padStart(9)} ${chunks.join(' ')}\n`;
            }
            
            gb += `//\n`;
            return gb;
        } catch (e) {
            console.error('XML to GB conversion failed:', e);
            return null;
        }
    },

    /**
     * 尝试将 XML/DNA 文件转换为 GB 格式并保存
     * 返回保存的相对路径 (如 data/sequences/xxx.gb)
     */
    convertAndSaveToGb: async (filePath, plasmidName) => {
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const { ipcRenderer } = window.require('electron');
                const buffer = await ipcRenderer.invoke('read-file-buffer', filePath);
                if (!buffer) return null;
                
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(buffer);
                
                // 检查是否为 SnapGene XML
                // 宽松检查：只要包含 XML 特征标签即可
                if (text.trim().startsWith('<?xml') || text.includes('<SnapGene') || text.includes('<Plasmid')) {
                    const gbContent = window.DataService.snapGeneXmlToGenBank(text, plasmidName);
                    if (gbContent) {
                        const safeName = plasmidName.replace(/[\\\/:\*\?"<>\|]/g, '_');
                        const relativePath = `data/sequences/${safeName}.gb`;
                        
                        await ipcRenderer.invoke('save-file-silent', {
                            data: gbContent,
                            path: relativePath
                        });
                        return relativePath;
                    }
                }
                // 检查是否为标准 GenBank 格式 (直接复制)
                else if (text.includes('LOCUS') && text.includes('ORIGIN')) {
                    const safeName = plasmidName.replace(/[\\\/:\*\?"<>\|]/g, '_');
                    const relativePath = `data/sequences/${safeName}.gb`;
                    
                    await ipcRenderer.invoke('save-file-silent', {
                        data: text,
                        path: relativePath
                    });
                    return relativePath;
                }
            } catch (e) {
                console.warn('Convert to GB failed:', e);
            }
        }
        return null;
    },

    /**
     * 保存 GB 内容到文件
     */
    saveGbFile: async (plasmidName, gbContent) => {
        if (!gbContent) return null;
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            const { ipcRenderer } = window.require('electron');
            const safeName = plasmidName.replace(/[\\\/:\*\?"<>\|]/g, '_');
            const relativePath = `data/sequences/${safeName}.gb`;
            
            try {
                await ipcRenderer.invoke('save-file-silent', {
                    data: gbContent,
                    path: relativePath
                });
                return relativePath;
            } catch (e) {
                console.error('Save GB file failed:', e);
            }
        }
        return null;
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

        const rawHeaders = splitCSVLine(lines[0].replace(/^\uFEFF/, '')); // 移除 BOM
        
        // 支持常见表头映射
        const headerMap = {
            'Name': '文件名', 'Plasmid Name': '文件名', 'Plasmid': '文件名', 'Title': '文件名',
            'Vector': '载体类型', 'Vector Type': '载体类型',
            'Gene': '靶基因', 'Target Gene': '靶基因', 'Target': '靶基因',
            'Species': '物种', 'Organism': '物种',
            'Function': '功能', 'Role': '功能',
            'Resistance': '大肠杆菌抗性', 'Antibiotic': '大肠杆菌抗性', 'Ampicillin': '大肠杆菌抗性',
            'Mammalian Resistance': '哺乳动物抗性', 'Selection': '哺乳动物抗性',
            'Promoter': '启动子',
            'Tag': '蛋白标签', 'Tags': '蛋白标签',
            'Mutation': '突变', 'Mutations': '突变',
            'Location': '保存位置', 'Box': '保存位置', 'Freezer': '保存位置',
            'Owner': '持有人', 'Author': '持有人',
            'Project': '项目',
            'Sequence': '序列', 'Seq': '序列',
            'Description': '描述', 'Notes': '描述', 'Comments': '描述',
            'Created': '添加时间', 'Date Added': '添加时间', 'Created Time': '添加时间',
            'Updated': '更新时间', 'Last Modified': '更新时间', 'Updated Time': '更新时间'
        };
        const headers = rawHeaders.map(h => headerMap[h] || h);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = splitCSVLine(lines[i]);
            const item = {};
            
            headers.forEach((header, index) => {
                let val = values[index] || "";
                // 处理数组字段 (用 ; 分隔)
                const arrayFields = ["载体类型", "靶基因", "物种", "功能", "大肠杆菌抗性", "哺乳动物抗性", "插入类型", "蛋白标签", "荧光蛋白", "启动子", "突变", "四环素诱导", "项目"];
                if (arrayFields.includes(header)) {
                    item[header] = val ? val.split(';').map(v => v.trim()).filter(v => v) : [];
                } else if (header === '添加时间' || header === '更新时间') {
                    // 尝试将时间字符串转换为时间戳
                    const timestamp = Date.parse(val);
                    item[header] = !isNaN(timestamp) ? timestamp : (val || Date.now());
                } else {
                    item[header] = val;
                }
            });

            if (item.文件名) {
                // 确保每条记录都有唯一 ID，这对批量操作至关重要
                if (!item.id) {
                    item.id = `plasmid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                data.push(item);
            }
        }
        return data;
    }
};
