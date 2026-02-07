/**
 * 辅助函数：处理数组与字符串转换
 */
window.Utils = {
    ensureArray: (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return val.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    },

    ensureString: (val) => {
        if (!val) return "";
        if (Array.isArray(val)) return val.filter(s => s && String(s).trim()).join(", ");
        return String(val).trim();
    },

    /**
     * 复制文本到剪贴板
     */
    copyText: (text, message, callback) => {
        navigator.clipboard.writeText(text).then(() => {
            if (callback) callback(message);
        });
    },

    /**
     * 系统日志记录
     */
    logs: [],
    log: (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        const fullTime = new Date().toLocaleString();
        const logEntry = { time, msg, type };
        window.Utils.logs.push(logEntry);
        // 保持最近 100 条日志
        if (window.Utils.logs.length > 100) window.Utils.logs.shift();
        
        const prefix = `[${time}] [${type.toUpperCase()}]`;
        if (type === 'error') console.error(prefix, msg);
        else if (type === 'warn') console.warn(prefix, msg);
        else console.log(prefix, msg);

        // 如果是 Electron 环境，尝试写入物理日志文件
        if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
            try {
                const electron = window.require('electron');
                if (electron && electron.ipcRenderer) {
                    const logLine = `[${fullTime}] [${type.toUpperCase()}] ${msg}\n`;
                    electron.ipcRenderer.send('write-debug-log', logLine);
                }
            } catch (e) {
                // 静默失败，不影响主流程
            }
        }
    },

    /**
     * 显示提示信息
     */
    showToast: (message) => {
        const toast = document.getElementById('toast');
        const toastText = document.getElementById('toast-text');
        if (!toast || !toastText) return;
        
        toastText.innerText = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 3000);
    },

    /**
     * 转义正则表达式特殊字符
     */
    escapeRegExp: (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * 生成 UUID
     */
    generateUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * 将值转换为带选中状态的对象列表
     */
    toCheckableList: (val) => {
        let items = [];
        if (val instanceof Set) {
            items = Array.from(val);
        } else {
            items = window.Utils.ensureArray(val);
        }
        return items.map(v => ({ value: v, selected: true }));
    },

    /**
     * 获取列表中选中的值
     */
    getSelectedValues: (list) => {
        if (!Array.isArray(list)) return window.Utils.ensureArray(list);
        if (list.length > 0 && typeof list[0] === 'object' && 'selected' in list[0]) {
            return list.filter(i => i.selected).map(i => i.value);
        }
        return window.Utils.ensureArray(list);
    },

    /**
     * 向批量项添加值并清空输入框
     */
    addBatchItemValue: (item, field, newValue) => {
        if (!newValue || !newValue.trim()) return "";
        const val = newValue.trim();
        if (!item[field]) item[field] = [];
        // 检查重复
        if (!item[field].some(i => i.value === val)) {
            item[field].push({ value: val, selected: true });
        }
        return ""; // 清空输入框
    },

    /**
     * 根据字段自动生成描述
     */
    generateDescription: (item) => {
        const parts = [];
        const getVals = (f) => {
            const vals = window.Utils.getSelectedValues(item[f]);
            return vals.length > 0 ? vals.join(', ') : '';
        };
        
        const vector = getVals('载体类型');
        if (vector) parts.push(`载体: ${vector}`);
        
        const target = getVals('靶基因');
        if (target) parts.push(`靶基因: ${target}`);
        
        const species = getVals('物种');
        if (species) parts.push(`物种: ${species}`);
        
        const insert = getVals('插入类型');
        if (insert) parts.push(`插入类型: ${insert}`);
        
        const coliRes = getVals('大肠杆菌抗性');
        const mamRes = getVals('哺乳动物抗性');
        const resistance = [coliRes, mamRes].filter(Boolean).join(', ');
        if (resistance) parts.push(`抗性: ${resistance}`);

        const promoter = getVals('启动子');
        if (promoter) parts.push(`启动子: ${promoter}`);

        const tags = getVals('蛋白标签');
        const fluo = getVals('荧光蛋白');
        const allTags = [tags, fluo].filter(Boolean).join(', ');
        if (allTags) parts.push(`标签: ${allTags}`);

        const mutation = getVals('突变');
        if (mutation) parts.push(`突变: ${mutation}`);

        return parts.join('; ');
    },

    /**
     * 增强版搜索算法：平衡模糊度与准确度
     */
    fuzzyMatch: (query, target) => {
        if (!query) return 100;
        if (!target) return 0;
        
        query = query.toLowerCase().trim();
        target = target.toLowerCase().trim();
        
        // 1. 完全匹配 (最高优先级)
        if (target === query) return 100;
        
        // 2. 包含匹配 (核心匹配)
        if (target.includes(query)) {
            // 如果是开头匹配，分数更高
            if (target.startsWith(query)) return 95;
            return 90;
        }
        
        // 3. 多关键词联合匹配 (按空格拆分)
        const keywords = query.split(/\s+/).filter(k => k.length > 0);
        if (keywords.length > 1) {
            let matchedCount = 0;
            let totalWeight = 0;
            keywords.forEach(k => {
                if (target.includes(k)) {
                    matchedCount++;
                    totalWeight += (k.length / query.length) * 100;
                }
            });
            
            // 如果包含所有关键词
            if (matchedCount === keywords.length) return 85;
            // 如果包含部分关键词
            if (matchedCount > 0) return (matchedCount / keywords.length) * 70;
        }

        // 4. 拼音/首字母或极其微弱的模糊匹配 (保守开启)
        // 只有当查询较长且匹配度较高时才认为是有效匹配
        if (query.length > 2) {
            let sIdx = 0;
            let tIdx = 0;
            let lastMatchIdx = -1;
            let gaps = 0;
            
            while (sIdx < query.length && tIdx < target.length) {
                if (query[sIdx] === target[tIdx]) {
                    if (lastMatchIdx !== -1) {
                        gaps += (tIdx - lastMatchIdx - 1);
                    }
                    lastMatchIdx = tIdx;
                    sIdx++;
                }
                tIdx++;
            }
            
            if (sIdx === query.length) {
                // 间距越小，分数越高。如果间距太大（超过目标长度一半），则视为无效匹配
                if (gaps < target.length / 2) {
                    return 60 - (gaps * 2);
                }
            }
        }

        return 0;
    }
};
