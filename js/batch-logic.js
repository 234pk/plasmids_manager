/**
 * Batch Logic Module
 * Handles batch import, scanning, and saving logic.
 */
window.createBatchLogic = (refs) => {
    const { 
        plasmids, 
        batchImportItems, 
        showBatchModal, 
        recognitionRules, 
        settings, 
        isElectron, 
        projectManager 
    } = refs;

    const { ipcRenderer } = (window.require && isElectron.value) ? window.require('electron') : { ipcRenderer: null };

    // Batch Modal Tab State
    const batchTab = ref('new'); // 'new' | 'update'

    const toCheckableList = window.Utils.toCheckableList;
    const addBatchItemValue = window.Utils.addBatchItemValue;
    const getSelectedValues = window.Utils.getSelectedValues;

    // 批量导入处理逻辑
    const handleBatchFiles = async (files) => {
        const t = (path) => window.I18n ? window.I18n.t(path) : path;
        window.Utils.log(`[批量导入] 收到待处理文件列表，共 ${files.length} 个`);
        const fileList = Array.from(files);
        
        // 立即开启弹窗显示加载状态
        showBatchModal.value = true;
        batchTab.value = 'new'; // Reset to new tab
        batchImportItems.value = [];

        try {
            const results = [];
            const existingNames = new Set(plasmids.value.map(p => p.文件名));
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const stepPrefix = `[${i + 1}/${fileList.length}]`;
                window.Utils.log(`${stepPrefix} 正在识别文件: ${file.name}`);
                
                if (!file.name) {
                    window.Utils.log(`${stepPrefix} 跳过空文件名`, 'WARN');
                    continue;
                }

                try {
                    // 1. 识别基本信息
                    let recognized = window.Recognition.recognizePlasmid(file, recognitionRules.value, plasmids.value);
                    
                    // 1.1 尝试从文件内容增强识别 (Smart Import)
                    if (isElectron.value) {
                            const pathOrFile = file.path || file;
                            try {
                                const buffer = await ipcRenderer.invoke('read-file-buffer', pathOrFile);
                                if (buffer) {
                                    const contentMeta = await window.Recognition.recognizeFromContent(buffer, file.name);
                                    if (contentMeta) {
                                        window.Utils.log(`${stepPrefix} 智能识别成功，提取到: ${Object.keys(contentMeta).join(', ')}`);
                                        
                                        // 交叉验证策略：
                                        // 1. 对于序列相关字段 (抗性, 启动子, 标签, 荧光蛋白)，优先信赖内容识别结果
                                        // 2. 对于结构性字段 (载体类型, 插入类型, 功能)，结合两者
                                        // 3. 靶基因：内容识别可能更准 (GenBank)，合并去重
                                        
                                        const seqFields = ['大肠杆菌抗性', '哺乳动物抗性', '启动子', '蛋白标签', '荧光蛋白'];
                                        const structFields = ['载体类型', '插入类型', '功能', '物种'];
                                        
                                        // 处理序列字段：如果内容有，则以内容为主或合并
                                        seqFields.forEach(key => {
                                            if (contentMeta[key] && contentMeta[key] instanceof Set && contentMeta[key].size > 0) {
                                                // 如果文件名识别结果较少或不确定，直接用内容结果
                                                if (!recognized[key] || recognized[key].size === 0) {
                                                    recognized[key] = new Set(contentMeta[key]);
                                                } else {
                                                    // 合并
                                                    contentMeta[key].forEach(v => recognized[key].add(v));
                                                }
                                            }
                                        });

                                        // 处理结构字段
                                        structFields.forEach(key => {
                                            if (contentMeta[key] && contentMeta[key] instanceof Set && contentMeta[key].size > 0) {
                                                contentMeta[key].forEach(v => recognized[key].add(v));
                                            }
                                        });

                                        // 处理靶基因
                                         if (contentMeta['靶基因'] && contentMeta['靶基因'].size > 0) {
                                             contentMeta['靶基因'].forEach(v => recognized['靶基因'].add(v));
                                         }

                                        // 重新进行一次全局标准化与去重
                                        Object.keys(recognized).forEach(key => {
                                            if (recognized[key] instanceof Set) {
                                                window.Recognition.normalizeSet(recognized[key]);
                                            }
                                        });

                                        // 重新生成描述
                                        recognized.描述 = window.Recognition.generateDescription(recognized);
                                    }
                                }
                            } catch (e) {
                                // console.warn('Smart import error', e);
                            }
                    }
                    
                    if (recognized) {
                        // 2. 提取序列
                        let sequence = null;
                        if (settings.value.recognitionConfig.saveSequence) {
                            // 优先从 mock 文件的 path 提取（桌面端）
                            const pathOrFile = file.path || file;
                            window.Utils.log(`${stepPrefix} 正在提取序列信息...`);
                            sequence = await window.DataService.extractSequence(pathOrFile);
                            if (sequence) {
                                window.Utils.log(`${stepPrefix} 成功提取序列: ${sequence.length} bp`);
                            } else {
                                window.Utils.log(`${stepPrefix} 未能提取到有效序列`, 'INFO');
                            }
                        }

                        window.Utils.log(`${stepPrefix} 成功提取特征: ${recognized.文件名}`);
                        const isDuplicate = existingNames.has(recognized.文件名);
                        
                        results.push({
                            ...recognized,
                            文件名: (typeof recognized.文件名 === 'string' && recognized.文件名.length > 1) ? recognized.文件名 : (file.name || recognized.文件名),
                            序列: sequence, // 暂存序列，保存时写入文件
                            载体类型: toCheckableList(recognized.载体类型),
                            靶基因: toCheckableList(recognized.靶基因),
                            物种: toCheckableList(recognized.物种),
                            功能: toCheckableList(recognized.功能),
                            插入类型: toCheckableList(recognized.插入类型),
                            大肠杆菌抗性: toCheckableList(recognized.大肠杆菌抗性),
                            哺乳动物抗性: toCheckableList(recognized.哺乳动物抗性),
                            蛋白标签: toCheckableList(recognized.蛋白标签),
                            荧光蛋白: toCheckableList(recognized.荧光蛋白),
                            启动子: toCheckableList(recognized.启动子),
                            突变: toCheckableList(recognized.突变),
                            四环素诱导: toCheckableList(recognized.四环素诱导),
                            isDuplicate: isDuplicate,
                            selected: !isDuplicate,
                            保存位置: '',
                            持有人: '',
                            项目: [],
                            路径: file.path || ''
                        });
                        successCount++;
                    } else {
                        window.Utils.log(`${stepPrefix} 文件识别结果为空`, 'WARN');
                        errorCount++;
                    }
                } catch (innerError) {
                    window.Utils.log(`${stepPrefix} 识别单个文件 ${file.name} 时出错: ${innerError.message}`, 'ERROR');
                    errorCount++;
                }
            }

            window.Utils.log(`[批量导入] 识别任务结束: 成功 ${successCount} 个, 失败/跳过 ${errorCount} 个`);

            if (results.length === 0) {
                showBatchModal.value = false;
                window.Utils.showToast('未能识别到有效的质粒信息，请尝试其他文件');
            } else {
                batchImportItems.value = results;
                
                // 自动切换 Tab
                const hasNew = results.some(i => !i.isDuplicate);
                const hasDup = results.some(i => i.isDuplicate);
                if (!hasNew && hasDup) {
                    batchTab.value = 'update';
                }
                
                window.Utils.showToast(`成功识别 ${results.length} 条质粒记录`);
            }
        } catch (err) {
            window.Utils.log(`[批量导入] 主逻辑异常: ${err.message}`, 'ERROR');
            console.error('批量识别主逻辑出错:', err);
            showBatchModal.value = false;
            window.Utils.showToast('识别过程发生错误，请查看控制台');
        }
    };

    const toggleAllBatchItems = (checked) => {
        batchImportItems.value.forEach(item => {
            if (batchTab.value === 'new') {
                if (!item.isDuplicate) item.selected = checked;
            } else {
                if (item.isDuplicate) item.selected = checked;
            }
        });
    };

    const scanAndImportLocal = async () => {
        if (isElectron.value && ipcRenderer) {
            window.Utils.log('[扫描] 正在执行本地目录一键扫描...');
            try {
                const localFiles = await ipcRenderer.invoke('scan-local-plasmids');
                if (localFiles && localFiles.length > 0) {
                    window.Utils.log(`[扫描] 发现 ${localFiles.length} 个本地文件，准备批量识别`);
                    const mockFiles = localFiles.map(f => ({
                        name: f.name,
                        path: f.path,
                        webkitRelativePath: ""
                    }));
                    handleBatchFiles(mockFiles);
                } else {
                    window.Utils.log('[扫描] 未发现任何支持的质粒文件', 'INFO');
                    window.Utils.showToast('当前目录下未发现质粒文件 (.dna, .gb, .fasta 等)');
                }
            } catch (err) {
                window.Utils.log(`[扫描] 扫描过程发生异常: ${err.message}`, 'ERROR');
            }
        } else {
            window.Utils.log('[扫描] 非桌面环境或 IPC 不可用，已阻止', 'WARN');
            window.Utils.showToast('请在桌面客户端中使用完整功能');
        }
    };

    const triggerBatchImport = async () => {
        // 桌面端环境：使用原生对话框获取绝对路径
        if (isElectron.value && ipcRenderer) {
            window.Utils.log('[导入] 正在调起原生文件选择对话框...');
            try {
                const filePaths = await ipcRenderer.invoke('open-file-dialog');
                if (filePaths && filePaths.length > 0) {
                    window.Utils.log(`[导入] 用户选择了 ${filePaths.length} 个文件`);
                    // 桌面端模拟文件对象，因为我们只需要路径和名字
                    const mockFiles = filePaths.map(p => ({
                        name: p.split(/[\\\/]/).pop(),
                        path: p, // 这里的 path 就是真实的绝对路径
                        webkitRelativePath: "" // 桌面端直接用 path
                    }));
                    handleBatchFiles(mockFiles);
                } else {
                    window.Utils.log('[导入] 用户取消了文件选择', 'INFO');
                }
            } catch (err) {
                window.Utils.log(`[导入] 文件对话框调用失败: ${err.message}`, 'ERROR');
                window.Utils.showToast('选择文件失败');
            }
        } else {
            // 如果在非 Electron 环境运行（理论上不应该，但作为兜底）
            window.Utils.log('[导入] 非桌面环境尝试调起导入，已阻止', 'WARN');
            window.Utils.showToast('请在桌面客户端中使用完整功能');
        }
    };

    const saveBatchImport = async () => {
        const selectedItems = batchImportItems.value.filter(item => item.selected);
        window.Utils.log(`[批量导入] 准备提交导入 ${selectedItems.length} 条记录...`);
        
        if (selectedItems.length === 0) {
            window.Utils.showToast('请至少选择一个质粒进行导入');
            return;
        }

        const formattedItems = [];
        let sequenceSavedCount = 0;
        let sequenceFailedCount = 0;

        for (let i = 0; i < selectedItems.length; i++) {
            const item = selectedItems[i];
            const stepPrefix = `[${i + 1}/${selectedItems.length}]`;
            
            // 如果有暂存序列，保存到文件
            let sequencePath = '';
            if (isElectron.value && (item.序列 || item.路径)) {
                try {
                    // 尝试优先转换为 GB 格式保存 (.dna 文件)
                    let savedAsGb = false;
                    if (item.路径 && item.路径.toLowerCase().endsWith('.dna')) {
                         const gbPath = await window.DataService.convertAndSaveToGb(item.路径, item.文件名);
                         if (gbPath) {
                             sequencePath = gbPath;
                             savedAsGb = true;
                             window.Utils.log(`${stepPrefix} 已将 DNA 转换为 GB 格式保存: ${item.文件名}`);
                         }
                    }

                    if (!savedAsGb && item.序列) {
                        sequencePath = await window.DataService.saveSequenceToFile(item.文件名, item.序列);
                        window.Utils.log(`${stepPrefix} 序列已保存: ${item.文件名}`);
                    }
                    
                    if (sequencePath) sequenceSavedCount++;
                } catch (e) {
                    window.Utils.log(`${stepPrefix} 序列保存失败 (${item.文件名}): ${e.message}`, 'WARN');
                    sequenceFailedCount++;
                }
            }

            // Generate ID
            const newId = 'plasmid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            formattedItems.push({
                id: newId,
                文件名: item.文件名,
                路径: item.路径,
                序列: item.序列 || '', // 原始序列
                序列文件: sequencePath, // 保存的 txt 路径
                载体类型: getSelectedValues(item.载体类型),
                靶基因: getSelectedValues(item.靶基因),
                功能: getSelectedValues(item.功能),
                大肠杆菌抗性: getSelectedValues(item.大肠杆菌抗性),
                哺乳动物抗性: getSelectedValues(item.哺乳动物抗性),
                物种: getSelectedValues(item.物种),
                插入类型: getSelectedValues(item.插入类型),
                蛋白标签: getSelectedValues(item.蛋白标签),
                荧光蛋白: getSelectedValues(item.荧光蛋白),
                启动子: getSelectedValues(item.启动子),
                突变: getSelectedValues(item.突变),
                四环素诱导: getSelectedValues(item.四环素诱导),
                描述: item.描述 || '',
                保存位置: item.保存位置 || '',
                持有人: item.持有人 || '',
                项目: item.项目 ? [item.项目] : [],
                添加时间: Date.now(),
                更新时间: Date.now()
            });
        }
        
        // 最终保存前的查重
        const existingNames = new Set(plasmids.value.map(p => p.文件名));
        const finalItems = formattedItems.filter(item => !existingNames.has(item.文件名));
        const skippedCount = formattedItems.length - finalItems.length;

        if (finalItems.length > 0) {
            window.Utils.log(`[批量导入] 正在写入数据库，新增 ${finalItems.length} 条...`);
            plasmids.value = [...plasmids.value, ...finalItems];

            // 更新项目关联
            if (projectManager && projectManager.value && projectManager.value.addPlasmidsToProject && projectManager.value.projects) {
                const itemsByProject = {};
                finalItems.forEach(p => {
                    if (p.项目 && p.项目.length > 0) {
                        p.项目.forEach(pid => {
                            if (!itemsByProject[pid]) itemsByProject[pid] = [];
                            itemsByProject[pid].push(p);
                        });
                    }
                });

                for (const [pid, pList] of Object.entries(itemsByProject)) {
                    const project = projectManager.value.projects.value.find(p => p.id === pid);
                    if (project) {
                        await projectManager.value.addPlasmidsToProject(project, pList);
                    }
                }
            }

            window.DataService.saveToCache(plasmids.value);
            
            // 桌面端自动同步到文件
            if (isElectron.value) {
                const success = await window.DataService.electronSave(plasmids.value);
                if (success) {
                    window.Utils.log(`[批量导入] 成功同步至本地 JSON: 新增 ${finalItems.length} 条 (序列保存: ${sequenceSavedCount} 成功, ${sequenceFailedCount} 失败)`);
                    window.Utils.showToast(`成功导入 ${finalItems.length} 条质粒`);
                } else {
                    window.Utils.log(`[批量导入] 本地 JSON 同步失败`, 'ERROR');
                    window.Utils.showToast(`导入成功，但本地文件同步失败`, 'ERROR');
                }
            } else {
                let msg = `成功导入 ${finalItems.length} 条质粒`;
                if (skippedCount > 0) {
                    msg += `，跳过 ${skippedCount} 条重复记录`;
                }
                window.Utils.showToast(msg);
            }
        } else if (skippedCount > 0) {
            window.Utils.log(`[批量导入] 无新记录可导入 (跳过 ${skippedCount} 条重复)`, 'INFO');
            window.Utils.showToast(`跳过 ${skippedCount} 条重复记录`);
        }
        
        showBatchModal.value = false;
        batchImportItems.value = [];
    };

    const saveBatchUpdate = async () => {
        const selectedItems = batchImportItems.value.filter(item => item.isDuplicate && item.selected);
        window.Utils.log(`[批量更新] 准备更新 ${selectedItems.length} 条记录...`);
        
        if (selectedItems.length === 0) {
            window.Utils.showToast('请至少选择一条记录进行更新');
            return;
        }

        let updatedCount = 0;
        const timestamp = Date.now();

        for (const item of selectedItems) {
            // Find existing
            const existing = plasmids.value.find(p => p.文件名 === item.文件名);
            if (existing) {
                // Update fields (merge logic)
                // Array fields: merge and unique
                const arrayFields = ['载体类型', '靶基因', '功能', '大肠杆菌抗性', '哺乳动物抗性', '物种', '插入类型', '蛋白标签', '荧光蛋白', '启动子', '突变', '四环素诱导'];
                arrayFields.forEach(field => {
                    const newVal = getSelectedValues(item[field]);
                    const oldVal = window.Utils.ensureArray(existing[field]);
                    existing[field] = [...new Set([...oldVal, ...newVal])];
                });
                
                // Single fields: overwrite if new value exists
                if (item.序列) existing.序列 = item.序列;
                // If there is a new sequence file (converted from .dna), update it
                if (item.路径 && item.路径.toLowerCase().endsWith('.dna')) {
                     try {
                         const gbPath = await window.DataService.convertAndSaveToGb(item.路径, item.文件名);
                         if (gbPath) existing.序列文件 = gbPath;
                     } catch(e) {
                         console.warn('Update sequence failed', e);
                     }
                }
                
                existing.更新时间 = timestamp;
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            window.Utils.showToast(`成功更新 ${updatedCount} 条记录`);
            window.DataService.saveToCache(plasmids.value);
            if (isElectron.value) {
                await window.DataService.electronSave(plasmids.value);
            }
            
            // Remove updated items from the list
            batchImportItems.value = batchImportItems.value.filter(item => !(item.isDuplicate && item.selected));
            
            if (batchImportItems.value.filter(i => i.isDuplicate).length === 0) {
                // If no more duplicates, switch to new tab or close
                if (batchImportItems.value.length > 0) {
                    batchTab.value = 'new';
                } else {
                    showBatchModal.value = false;
                }
            }
        }
    };

    return {
        handleBatchFiles,
        scanAndImportLocal,
        triggerBatchImport,
        saveBatchImport,
        saveBatchUpdate,
        toggleAllBatchItems,
        addBatchItemValue,
        batchTab
    };
};
