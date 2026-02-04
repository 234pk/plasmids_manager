if (typeof Vue === 'undefined') {
    const msg = '[系统] Vue 全局对象缺失，页面无法启动（请检查 js/lib/vue.global.js 是否加载成功）';
    console.error(msg);
    const loader = document.getElementById('init-loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.innerHTML = `<div class="text-center">
            <p class="text-red-600 font-bold text-lg">启动失败</p>
            <p class="text-gray-500 text-sm mt-2">${msg}</p>
        </div>`;
    }
    throw new Error(msg);
}

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const mountElForTemplate = document.getElementById('app');
const appTemplate = mountElForTemplate ? mountElForTemplate.innerHTML : '';
if (window.Utils) {
    window.Utils.log(`[系统] 模板提取: ${mountElForTemplate ? '找到 #app' : '未找到 #app'} | length=${appTemplate.length}`);
}

const App = {
    template: appTemplate,
    setup() {
        window.Utils && window.Utils.log('Vue setup() 开始执行...');
        const plasmids = ref([]);
        
        // 监听 plasmids 变化
        watch(plasmids, (newVal) => {
            if (window.Utils && newVal.length > 0) {
                window.Utils.log(`数据状态更新: 当前内存中共有 ${newVal.length} 条记录`);
            }
        }, { deep: false });
        const recognitionRules = ref(null);
        const dbFileHandle = ref(null);
        const settingsFileHandle = ref(null);
        const settings = ref({
            theme: 'light',
            autoSave: true,
            externalSoftwarePath: '',
            recognitionConfig: {
                minMatchScore: 0.5,
                enableNlp: true,
                extractTargetGene: true
            },
            displayConfig: {
                showTags: true,
                showDate: true,
                itemsPerPage: 20,
                columnVisibility: {
                    '质粒信息': true,
                    '特征与分类': true,
                    '抗性': true,
                    '专业特征': true,
                    '描述': true
                }
            }
        });

        const searchQuery = ref('');
        const activeFilters = ref({ 
            '载体类型': [], 
            '功能': [], 
            '物种': [], 
            '大肠杆菌抗性': [],
            '插入类型': [],
            '蛋白标签': [],
            '荧光蛋白': [],
            '启动子': [],
            '突变': [],
            '四环素诱导': []
        });
        const currentPage = ref(1);
        const pageSize = ref(20);
        const isDragging = ref(false);

        // 设置面板
        const showSettingsModal = ref(false);
        const showExportModal = ref(false);
        const exportFields = ref([
            { id: '文件名', label: '文件名', selected: true },
            { id: '载体类型', label: '载体类型', selected: true },
            { id: '靶基因', label: '靶基因', selected: true },
            { id: '物种', label: '物种', selected: true },
            { id: '功能', label: '功能', selected: true },
            { id: '大肠杆菌抗性', label: '大肠杆菌抗性', selected: true },
            { id: '哺乳动物抗性', label: '哺乳动物抗性', selected: true },
            { id: '插入类型', label: '插入类型', selected: true },
            { id: '蛋白标签', label: '蛋白标签', selected: true },
            { id: '荧光蛋白', label: '荧光蛋白', selected: true },
            { id: '启动子', label: '启动子', selected: true },
            { id: '突变', label: '突变', selected: true },
            { id: '四环素诱导', label: '四环素诱导', selected: true },
            { id: '序列', label: '序列 (ATCG)', selected: true },
            { id: '序列文件', label: '序列文件路径', selected: true },
            { id: '路径', label: '路径', selected: true },
            { id: '描述', label: '描述', selected: true }
        ]);

        // 编辑相关
        const editingItem = ref(null);
        const editForm = ref({});

        // 序列查看器相关
        const showSequenceModal = ref(false);
        const currentSequence = ref('');
        const currentSequenceItem = ref(null);
        const currentSequenceFileName = computed(() => {
            try {
                return currentSequenceItem.value ? currentSequenceItem.value.文件名 : '';
            } catch (e) {
                return '';
            }
        });
        const currentSequencePath = computed(() => {
            try {
                return currentSequenceItem.value ? currentSequenceItem.value.路径 : '';
            } catch (e) {
                return '';
            }
        });
        const currentSequenceLength = computed(() => {
            try {
                return (currentSequence.value || '').length;
            } catch (e) {
                return 0;
            }
        });
        const sequenceViewerOptions = reactive({
            coloring: true,
            showNumbers: true,
            wrap: true
        });

        // 批量导入相关
        const batchImportItems = ref([]);
        const showBatchModal = ref(false);
        
        const isElectron = ref(false);
        let ipc = null;
        try {
            // 严格检查 Electron 环境，防止在普通浏览器或某些代理环境下误判
            if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
                if (typeof window.require === 'function') {
                    const electron = window.require('electron');
                    if (electron && electron.ipcRenderer) {
                        ipc = electron.ipcRenderer;
                        isElectron.value = true;
                    }
                }
            }
        } catch (e) {
            console.warn('Electron environment detection failed:', e);
        }
        const ipcRenderer = ipc;

        // 只有在 Electron 环境下才允许直接劫持日志
        const systemLogs = ref([...(window.Utils ? window.Utils.logs : [])]);
        if (window.Utils && isElectron.value) {
            window.Utils.logs = systemLogs.value;
        }
        const showLogModal = ref(false);

        // 数据库连接状态
        const isDatabaseReady = ref(false);

        // 用户引导
        const showGuide = ref(false);
        const guideStep = ref(0);
        const guideSteps = [
            { title: '欢迎使用', content: '这是一个高效的质粒管理系统。我们将带您快速了解核心功能。', target: null },
            { title: '数据管理', content: '您可以通过“批量导入”快速扫描文件夹中的质粒文件，系统会自动识别其特征。', target: '#btn-batch-import' },
            { title: '搜索与过滤', content: '利用强大的搜索框和标签过滤功能，您可以从成千上万条记录中瞬间找到目标。', target: '#section-search' },
            { title: '自动保存', content: '系统会自动将所有更改同步到本地 data 目录下的 JSON 文件中，无需担心数据丢失。', target: '#btn-save-db' }
        ];

        const startGuide = () => {
            showGuide.value = true;
            guideStep.value = 0;
            updateGuideHighlight();
        };

        const updateGuideHighlight = () => {
            // 清除之前的提示
            document.querySelectorAll('.highlight-target').forEach(el => {
                el.classList.remove('highlight-target');
            });

            const currentStep = guideSteps[guideStep.value];
            if (currentStep.target) {
                setTimeout(() => {
                    const targetEl = document.querySelector(currentStep.target);
                    if (targetEl) {
                        targetEl.classList.add('highlight-target');
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        };

        const nextGuide = () => {
            if (guideStep.value < guideSteps.length - 1) {
                guideStep.value++;
                updateGuideHighlight();
            } else {
                showGuide.value = false;
                document.querySelectorAll('.highlight-target').forEach(el => el.classList.remove('highlight-target'));
                localStorage.setItem('has_seen_guide', 'true');
            }
        };

        const skipGuide = () => {
            showGuide.value = false;
            document.querySelectorAll('.highlight-target').forEach(el => el.classList.remove('highlight-target'));
            localStorage.setItem('has_seen_guide', 'true');
        };

        // 挂载时加载数据
        onMounted(async () => {
            window.Utils.log('[系统] Vue 实例已挂载，启动初始化流程...');
            
            // 立即移除加载层（双重保险）
            const loader = document.getElementById('init-loader');
            if (loader) {
                setTimeout(() => {
                    loader.style.display = 'none';
                    window.Utils.log('[系统] 已手动隐藏 init-loader');
                }, 500);
            }

            window.Utils.log(`[系统] 运行环境检测: ${isElectron.value ? 'Electron 桌面端' : '普通浏览器'}`);
            
            // 1. 核心初始化 (IPC 检查)
            try {
                if (isElectron.value && ipcRenderer) {
                    window.Utils.log('[系统] 正在通过 IPC 检查必要的本地文件结构...');
                    const created = await ipcRenderer.invoke('check-init-files');
                    if (created) {
                        window.Utils.log('[系统] 检测到首次运行，已自动创建初始数据库');
                    }
                    
                    if (!localStorage.getItem('has_seen_guide')) {
                        window.Utils.log('[系统] 用户首次登录，准备展示功能引导');
                        startGuide();
                    }
                }
            } catch (e) {
                window.Utils.log('[系统] IPC 初始化调用异常: ' + e.message, 'ERROR');
            }

            // 2. 加载基础资源 (非阻塞)
            const loadResources = async () => {
                window.Utils.log('[系统] 异步加载基础配置资源...');
                try {
                    const loadedSettings = await window.DataService.loadSettings();
                    if (loadedSettings) {
                        // Deep merge to ensure structure integrity
                        const defaultSettings = settings.value;
                        const merged = { ...defaultSettings, ...loadedSettings };
                        
                        // Ensure displayConfig exists and merge
                        merged.displayConfig = { 
                            ...defaultSettings.displayConfig, 
                            ...(loadedSettings.displayConfig || {}) 
                        };
                        
                        // Ensure columnVisibility exists and merge
                        merged.displayConfig.columnVisibility = { 
                            ...defaultSettings.displayConfig.columnVisibility, 
                            ...(loadedSettings.displayConfig?.columnVisibility || {}) 
                        };

                        settings.value = merged;
                        pageSize.value = settings.value.displayConfig.itemsPerPage;
                        window.Utils.log('[系统] 用户个性化设置已应用');
                    }
                } catch (e) {
                    window.Utils.log('[系统] 加载设置文件失败: ' + e.message, 'ERROR');
                }

                try {
                    window.Utils.log('[系统] 正在解析质粒识别规则库...');
                    recognitionRules.value = await window.Recognition.loadRecognitionRules();
                    window.Utils.log('[系统] 识别引擎已就绪');
                } catch (e) {
                    window.Utils.log('[系统] 加载识别规则失败: ' + e.message, 'ERROR');
                }
            };
            loadResources(); 

            // 3. 数据库加载
            try {
                window.Utils.log('[系统] 正在请求加载质粒数据库...');
                const dbData = await window.DataService.loadDatabase();
                if (dbData && dbData.length > 0) {
                    plasmids.value = dbData;
                    window.Utils.log(`[系统] 数据库加载成功，共载入 ${dbData.length} 条质粒记录`);
                } else {
                    window.Utils.log('[系统] 数据库为空，尝试扫描程序所在目录...');
                    if (isElectron.value && ipcRenderer) {
                        const localFiles = await ipcRenderer.invoke('scan-local-plasmids');
                        if (localFiles && localFiles.length > 0) {
                            window.Utils.log(`[系统] 扫描到 ${localFiles.length} 个潜在质粒文件，建议手动导入`);
                        }
                    }
                }
            } catch (e) {
                window.Utils.log('[系统] 数据库读取严重故障: ' + e.message, 'ERROR');
            } finally {
                isDatabaseReady.value = true;
                window.Utils.log('[系统] 业务逻辑初始化完毕，UI 已切换至就绪状态');
            }
        });

        // 监听设置变化
        watch(settings, (newSettings) => {
            window.DataService.saveSettings(newSettings);
            pageSize.value = newSettings.displayConfig.itemsPerPage;
        }, { deep: true });

        const saveSettingsFile = async () => {
            if (isElectron.value) {
                const success = await window.DataService.electronSave(settings.value, 'data/settings.json');
                if (success) {
                    window.Utils.showToast('设置已保存到 settings.json');
                    return;
                }
            }
            
            const handle = await window.DataService.saveToFile(settings.value, 'settings.json', settingsFileHandle.value);
            if (handle) {
                settingsFileHandle.value = handle;
                await window.DataService.setHandle('settings_handle', handle);
                window.Utils.showToast('设置已保存');
            } else {
                window.DataService.downloadJSON(settings.value, 'settings.json');
                window.Utils.showToast('请手动保存并替换 settings.json');
            }
        };

        const saveDatabaseFile = async () => {
            if (isElectron.value) {
                const success = await window.DataService.electronSave(plasmids.value, 'data/plasmid_database.json');
                if (success) {
                    window.Utils.showToast('数据库已同步至本地文件');
                    return;
                }
            }

            const handle = await window.DataService.saveToFile(plasmids.value, 'plasmid_database.json', dbFileHandle.value);
            if (handle) {
                dbFileHandle.value = handle;
                await window.DataService.setHandle('db_handle', handle);
                window.Utils.showToast('数据库已保存');
            } else {
                window.DataService.downloadJSON(plasmids.value, 'plasmid_database.json');
                window.Utils.showToast('请手动保存并替换 plasmid_database.json');
            }
        };

        // 链接本地文件
        const linkLocalDatabase = async () => {
            // 1. Electron 环境：使用原生对话框
            if (isElectron.value) {
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
                                plasmids.value = data;
                                window.DataService.saveToCache(plasmids.value);
                                isDatabaseReady.value = true;
                                window.Utils.showToast('已加载本地数据库');
                            } catch (e) {
                                window.Utils.showToast('数据库文件格式错误', 'ERROR');
                            }
                        }
                    }
                } catch (err) {
                    console.error(err);
                    window.Utils.showToast('打开文件失败: ' + err.message, 'ERROR');
                }
                return;
            }

            // 2. 浏览器环境
            if (window.showOpenFilePicker) {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [{
                            description: 'JSON Files',
                            accept: { 'application/json': ['.json'] },
                        }],
                    });
                    if (handle) {
                        const file = await handle.getFile();
                        const content = await file.text();
                        plasmids.value = JSON.parse(content);
                    dbFileHandle.value = handle;
                    await window.DataService.setHandle('db_handle', handle);
                    window.DataService.saveToCache(plasmids.value);
                    isDatabaseReady.value = true;
                    window.Utils.showToast('已链接本地数据库文件');
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error(e);
                        // 失败则降级
                        const input = document.getElementById('db-file-input');
                        if (input) input.click();
                    }
                }
            } else {
                const input = document.getElementById('db-file-input');
                if (input) input.click();
            }
        };

        // 文件处理
        const handleFileSelect = (event) => {
            const file = event.target.files[0];
            if (file) readFile(file);
        };

        const handleDrop = (event) => {
            isDragging.value = false;
            const files = event.dataTransfer.files;
            if (files.length === 0) return;

            // 如果只拖入了一个 JSON，走数据库加载逻辑
            if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
                readFile(files[0]);
            } else {
                // 否则全部走批量导入逻辑
                handleBatchFiles(files);
            }
        };

        const readFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    plasmids.value = data;
                    window.DataService.saveToCache(plasmids.value);
                    isDatabaseReady.value = true;
                } catch (err) {
                    alert('文件格式错误，请确保选择的是有效的 JSON 数据库文件');
                }
            };
            reader.readAsText(file);
        };

        const resetData = async () => {
            if (confirm('确定要清空当前所有数据吗？此操作不可撤销。')) {
                window.Utils.log('[系统] 正在清空数据库...');
                plasmids.value = [];
                window.DataService.clearCache();
                
                // 桌面端自动同步到文件
                if (isElectron.value) {
                    window.Utils.log('[系统] 正在同步清空至本地数据库文件...');
                    const success = await window.DataService.electronSave(plasmids.value);
                    if (success) {
                        window.Utils.log('[系统] 本地数据库已成功清空');
                        window.Utils.showToast('本地数据库已清空');
                    } else {
                        window.Utils.log('[系统] 本地数据库清空同步失败', 'ERROR');
                        window.Utils.showToast('清空失败', 'ERROR');
                    }
                } else {
                    window.Utils.log('[系统] 浏览器缓存已清空');
                    window.Utils.showToast('缓存已清空');
                }
            }
        };

        // 重新生成所有序列文件
        const regenerateAllSequences = async () => {
            if (!isElectron.value) return;
            if (!confirm('确定要重新扫描并生成所有质粒的序列文件吗？\n这将覆盖现有的 sequences 文件夹内容。')) return;

            window.Utils.log('[维护] 开始重新生成序列文件...');
            let successCount = 0;
            let failCount = 0;
            const total = plasmids.value.length;
            
            // 显示加载状态（复用批量导入的 modal 或简单 toast）
            window.Utils.showToast(`正在后台处理 ${total} 个文件...`, 'INFO');

            for (let i = 0; i < total; i++) {
                const item = plasmids.value[i];
                if (!item.路径) {
                    failCount++;
                    continue;
                }

                try {
                    // 1. 提取序列
                    const sequence = await window.DataService.extractSequence(item.路径);
                    if (sequence) {
                        item.序列 = sequence;
                        // 2. 保存文件
                        const savedPath = await window.DataService.saveSequenceToFile(item.文件名, sequence);
                        if (savedPath) {
                            item.序列文件 = savedPath;
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } else {
                        failCount++;
                    }
                } catch (err) {
                    console.error(`Failed to regenerate for ${item.文件名}:`, err);
                    failCount++;
                }

                // 每处理 10 个更新一次日志/UI防止卡顿
                if (i % 10 === 0) {
                    window.Utils.log(`[维护] 进度: ${i + 1}/${total}`);
                }
            }

            // 保存更新后的数据库
            window.DataService.saveToCache(plasmids.value);
            await window.DataService.electronSave(plasmids.value);

            window.Utils.log(`[维护] 完成: 成功 ${successCount}, 失败/跳过 ${failCount}`);
            window.Utils.showToast(`处理完成：成功生成 ${successCount} 个序列文件`);
        };

        // 导出功能
        const handleDownloadJSON = () => {
            window.DataService.downloadJSON(plasmids.value);
            window.Utils.showToast('数据已导出 JSON');
        };

        const handleDownloadCSV = () => {
            if (plasmids.value.length === 0) {
                window.Utils.log('[导出] 数据库为空，取消导出', 'WARN');
                return;
            }
            const selectedFields = exportFields.value.filter(f => f.selected).map(f => f.id);
            if (selectedFields.length === 0) {
                window.Utils.log('[导出] 未选择任何导出字段', 'WARN');
                window.Utils.showToast('请至少选择一个导出字段', 'WARN');
                return;
            }
            const dataToExport = filteredPlasmids.value;
            window.Utils.log(`[导出] 正在导出 ${dataToExport.length} 条记录至 CSV (字段: ${selectedFields.join(', ')})`);
            try {
                window.DataService.downloadCSV(dataToExport, `plasmid_export_${new Date().toLocaleDateString()}.csv`, selectedFields);
                window.Utils.log(`[导出] CSV 文件已生成`);
                window.Utils.showToast(`已导出 ${dataToExport.length} 条数据到 CSV`);
                showExportModal.value = false;
            } catch (err) {
                window.Utils.log(`[导出] 导出失败: ${err.message}`, 'ERROR');
                window.Utils.showToast('导出失败', 'ERROR');
            }
        };

        const handleCSVImport = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            window.Utils.log(`[导入] 收到 CSV 导入请求: ${file.name}`);
            try {
                const text = await file.text();
                const importedData = window.DataService.parseCSV(text);
                if (importedData && importedData.length > 0) {
                    window.Utils.log(`[导入] 解析 CSV 成功，共 ${importedData.length} 条记录`);
                    // 查重并合并
                    let addedCount = 0;
                    let updatedCount = 0;
                    
                    importedData.forEach(item => {
                        const index = plasmids.value.findIndex(p => p.文件名 === item.文件名);
                        if (index > -1) {
                            plasmids.value[index] = { ...plasmids.value[index], ...item };
                            updatedCount++;
                        } else {
                            plasmids.value.push(item);
                            addedCount++;
                        }
                    });

                    window.Utils.log(`[导入] 合并完成: 新增 ${addedCount} 条, 更新 ${updatedCount} 条`);
                    window.DataService.saveToCache(plasmids.value);
                    if (isElectron.value) {
                        window.Utils.log(`[导入] 正在同步数据库文件...`);
                        const success = await window.DataService.electronSave(plasmids.value);
                        if (success) {
                            window.Utils.log('[导入] 数据库文件同步成功');
                        } else {
                            window.Utils.log('[导入] 数据库文件同步失败', 'WARN');
                        }
                    }
                    
                    window.Utils.showToast(`导入成功：新增 ${addedCount} 条，更新 ${updatedCount} 条`);
                } else {
                    window.Utils.log('[导入] CSV 文件内容为空或格式不正确', 'WARN');
                    window.Utils.showToast('CSV 文件内容为空或格式错误', 'ERROR');
                }
            } catch (err) {
                window.Utils.log(`[导入] 发生错误: ${err.message}`, 'ERROR');
                console.error('CSV Import error:', err);
                window.Utils.showToast('导入 CSV 失败，请检查文件格式', 'ERROR');
            }
            // 清除 input 值，方便下次选择同一文件
            event.target.value = '';
        };

        const toggleAllExportFields = (selected) => {
            exportFields.value.forEach(f => f.selected = selected);
        };

        // 编辑功能
        const editItem = async (item) => {
            window.Utils.log(`开始编辑质粒: ${item.文件名}`);
            editingItem.value = item;
            
            // 如果是 Electron 环境且没有序列信息，尝试从本地加载
            let sequence = item.序列 || '';
            if (!sequence && item.路径 && isElectron.value) {
                try {
                    const extracted = await window.DataService.extractSequence(item.路径);
                    if (extracted) sequence = extracted;
                } catch (e) {
                    console.warn('Failed to load sequence for editing:', e);
                }
            }

            editForm.value = {
                ...item,
                序列: sequence,
                载体类型: window.Utils.ensureString(item.载体类型),
                靶基因: window.Utils.ensureString(item.靶基因),
                功能: window.Utils.ensureString(item.功能),
                大肠杆菌抗性: window.Utils.ensureString(item.大肠杆菌抗性),
                哺乳动物抗性: window.Utils.ensureString(item.哺乳动物抗性),
                物种: window.Utils.ensureString(item.物种),
                插入类型: window.Utils.ensureString(item.插入类型),
                蛋白标签: window.Utils.ensureString(item.蛋白标签),
                荧光蛋白: window.Utils.ensureString(item.荧光蛋白),
                启动子: window.Utils.ensureString(item.启动子),
                突变: window.Utils.ensureString(item.突变),
                四环素诱导: window.Utils.ensureString(item.四环素诱导)
            };
        };

        const saveEdit = async () => {
            if (!editingItem.value) return;
            const originalName = editingItem.value.文件名;
            window.Utils.log(`[编辑] 正在保存修改: ${originalName}`);

            try {
                const updatedItem = {
                    ...editForm.value,
                    序列: editForm.value.序列 || '',
                    载体类型: window.Utils.ensureArray(editForm.value.载体类型),
                    靶基因: window.Utils.ensureArray(editForm.value.靶基因),
                    功能: window.Utils.ensureArray(editForm.value.功能),
                    大肠杆菌抗性: window.Utils.ensureArray(editForm.value.大肠杆菌抗性),
                    哺乳动物抗性: window.Utils.ensureArray(editForm.value.哺乳动物抗性),
                    物种: window.Utils.ensureArray(editForm.value.物种),
                    插入类型: window.Utils.ensureArray(editForm.value.插入类型),
                    蛋白标签: window.Utils.ensureArray(editForm.value.蛋白标签),
                    荧光蛋白: window.Utils.ensureArray(editForm.value.荧光蛋白),
                    启动子: window.Utils.ensureArray(editForm.value.启动子),
                    突变: window.Utils.ensureArray(editForm.value.突变),
                    四环素诱导: window.Utils.ensureArray(editForm.value.四环素诱导)
                };
                
                const index = plasmids.value.findIndex(p => p.文件名 === originalName);
                if (index > -1) {
                    const newName = updatedItem.文件名;
                    window.Utils.log(`[编辑] 正在更新内存记录: ${newName}`);

                    plasmids.value[index] = updatedItem;
                    window.DataService.saveToCache(plasmids.value);
                    
                    // 桌面端自动同步到文件
                    if (isElectron.value) {
                        // 如果有序列，同步到 sequences 目录
                        if (updatedItem.序列) {
                            window.Utils.log(`[编辑] 正在同步序列文件: ${newName}`);
                            await window.DataService.saveSequenceToFile(newName, updatedItem.序列);
                        }

                        window.Utils.log(`[编辑] 正在同步数据库文件...`);
                        const success = await window.DataService.electronSave(plasmids.value);
                        if (success) {
                            window.Utils.log(`[编辑] 成功保存并同步至本地数据库`);
                            window.Utils.showToast('修改已同步至本地数据库');
                        } else {
                            window.Utils.log(`[编辑] 数据库文件同步失败`, 'WARN');
                            window.Utils.showToast('本地文件同步失败，已暂存至缓存', 'ERROR');
                        }
                    } else {
                        window.Utils.showToast('修改已保存至浏览器缓存');
                    }
                    
                    editingItem.value = null;
                } else {
                    window.Utils.log(`[编辑] 未找到匹配的原始记录: ${originalName}`, 'ERROR');
                }
            } catch (err) {
                window.Utils.log(`[编辑] 发生错误: ${err.message}`, 'ERROR');
                window.Utils.showToast('保存失败，请检查日志');
            }
        };

        // 过滤与搜索
        const filterOptions = computed(() => {
            const opt = { 
                '载体类型': new Set(), 
                '功能': new Set(), 
                '物种': new Set(), 
                '大肠杆菌抗性': new Set(),
                '插入类型': new Set(),
                '蛋白标签': new Set(),
                '荧光蛋白': new Set(),
                '启动子': new Set()
            };
            if (!Array.isArray(plasmids.value)) return {};
            plasmids.value.forEach(p => {
                Object.keys(opt).forEach(k => {
                    if (p[k]) (Array.isArray(p[k]) ? p[k] : [p[k]]).forEach(v => opt[k].add(v));
                });
            });
            const res = {};
            Object.keys(opt).forEach(k => res[k] = Array.from(opt[k]).filter(v => v && v !== '无').sort());
            return res;
        });

        const filteredPlasmids = computed(() => {
            if (!Array.isArray(plasmids.value)) return [];
            const s = searchQuery.value.trim().toLowerCase();
            
            let results = plasmids.value.map(p => {
                // 搜索匹配得分
                let searchScore = 0;
                if (!s) {
                    searchScore = 100;
                } else {
                    // 对重要字段赋予更高权重
                    const weights = {
                        '文件名': 1.5,
                        '靶基因': 1.2,
                        '载体类型': 1.0,
                        '功能': 0.8,
                        '大肠杆菌抗性': 0.8,
                        '哺乳动物抗性': 0.8,
                        '物种': 0.8,
                        '插入类型': 0.9,
                        '蛋白标签': 0.9,
                        '荧光蛋白': 0.9,
                        '启动子': 0.9,
                        '突变': 1.1,
                        '序列': 0.7,
                        '描述': 0.5
                    };

                    for (const [key, weight] of Object.entries(weights)) {
                        const val = window.Utils.ensureString(p[key]);
                        const score = window.Utils.fuzzyMatch(s, val);
                        // 提高门槛：分值必须大于 50 或者是较长搜索词的部分匹配
                        if (score > 50 || (s.length > 3 && score > 20)) {
                            searchScore = Math.max(searchScore, score * weight);
                        }
                    }
                }

                return { plasmid: p, score: searchScore };
            });

            // 过滤掉分数为 0 的（如果不搜索则全保留）
            if (s) {
                results = results.filter(r => r.score > 0);
            }

            // 应用筛选过滤器
            const filtered = results.filter(r => {
                const p = r.plasmid;
                for (const [k, v] of Object.entries(activeFilters.value)) {
                    if (v.length > 0) {
                        const pv = Array.isArray(p[k]) ? p[k] : (p[k] ? [p[k]] : []);
                        if (!v.some(val => pv.includes(val))) return false;
                    }
                }
                return true;
            });

            // 如果在搜索，按得分排序
            if (s) {
                filtered.sort((a, b) => b.score - a.score);
            }

            const finalResult = filtered.map(r => r.plasmid);
            
            // 记录日志，限制频率
            if (window.Utils && plasmids.value.length > 0) {
                if (!window._lastFilterLog || Date.now() - window._lastFilterLog > 3000) {
                    window.Utils.log(`数据过滤更新: 原始 ${plasmids.value.length} 条 -> 过滤后 ${finalResult.length} 条 (搜索词: "${s}")`);
                    window._lastFilterLog = Date.now();
                }
            }
            
            return finalResult;
        });

        const paginatedPlasmids = computed(() => filteredPlasmids.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value));
        const totalPages = computed(() => Math.ceil(filteredPlasmids.value.length / pageSize.value) || 1);
        
        const toggleFilter = (k, o) => {
            window.Utils.log(`切换筛选条件: ${k} = ${o}`);
            const i = activeFilters.value[k].indexOf(o);
            if (i > -1) activeFilters.value[k].splice(i, 1);
            else activeFilters.value[k].push(o);
            currentPage.value = 1;
            window.Utils.log(`当前活跃筛选: ${JSON.stringify(activeFilters.value)}`);
        };

        const isFilterActive = (k, o) => activeFilters.value[k].includes(o);
        watch([searchQuery, pageSize], () => currentPage.value = 1);

        // 自动匹配建议
        const suggestions = computed(() => {
            const keys = ['载体类型', '靶基因', '物种', '功能', '大肠杆菌抗性', '哺乳动物抗性', '插入类型', '蛋白标签', '荧光蛋白', '启动子', '四环素诱导', '突变'];
            const result = {};
            keys.forEach(k => {
                const set = new Set();
                plasmids.value.forEach(p => {
                    const val = p[k];
                    if (val) (Array.isArray(val) ? val : [val]).forEach(v => set.add(v));
                });
                result[k] = Array.from(set).filter(Boolean).sort();
            });
            return result;
        });

        // 批量导入
        const handleBatchFiles = async (files) => {
            window.Utils.log(`[批量导入] 收到待处理文件列表，共 ${files.length} 个`);
            const fileList = Array.from(files);
            
            // 立即开启弹窗显示加载状态
            showBatchModal.value = true;
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
                        const recognized = window.Recognition.recognizePlasmid(file, recognitionRules.value, plasmids.value);
                        
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
                                序列: sequence, // 暂存序列，保存时写入文件
                                载体类型: window.Utils.ensureString(recognized.载体类型),
                                靶基因: window.Utils.ensureString(recognized.靶基因),
                                物种: window.Utils.ensureString(recognized.物种),
                                功能: window.Utils.ensureString(recognized.功能),
                                大肠杆菌抗性: window.Utils.ensureString(recognized.大肠杆菌抗性),
                                哺乳动物抗性: window.Utils.ensureString(recognized.哺乳动物抗性),
                                isDuplicate: isDuplicate,
                                selected: !isDuplicate
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
                if (!item.isDuplicate) {
                    item.selected = checked;
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
                if (item.序列 && isElectron.value) {
                    try {
                        sequencePath = await window.DataService.saveSequenceToFile(item.文件名, item.序列);
                        window.Utils.log(`${stepPrefix} 序列已保存: ${item.文件名}`);
                        sequenceSavedCount++;
                    } catch (e) {
                        window.Utils.log(`${stepPrefix} 序列保存失败 (${item.文件名}): ${e.message}`, 'WARN');
                        sequenceFailedCount++;
                    }
                }

                formattedItems.push({
                    文件名: item.文件名,
                    路径: item.路径,
                    序列: item.序列 || '', // 原始序列
                    序列文件: sequencePath, // 保存的 txt 路径
                    载体类型: window.Utils.ensureArray(item.载体类型),
                    靶基因: window.Utils.ensureArray(item.靶基因),
                    功能: window.Utils.ensureArray(item.功能),
                    大肠杆菌抗性: window.Utils.ensureArray(item.大肠杆菌抗性),
                    哺乳动物抗性: window.Utils.ensureArray(item.哺乳动物抗性),
                    物种: window.Utils.ensureArray(item.物种),
                    插入类型: window.Utils.ensureArray(item.插入类型),
                    蛋白标签: window.Utils.ensureArray(item.蛋白标签),
                    荧光蛋白: window.Utils.ensureArray(item.荧光蛋白),
                    启动子: window.Utils.ensureArray(item.启动子),
                    突变: window.Utils.ensureArray(item.突变),
                    四环素诱导: window.Utils.ensureArray(item.四环素诱导),
                    描述: item.描述 || ''
                });
            }
            
            // 最终保存前的查重
            const existingNames = new Set(plasmids.value.map(p => p.文件名));
            const finalItems = formattedItems.filter(item => !existingNames.has(item.文件名));
            const skippedCount = formattedItems.length - finalItems.length;

            if (finalItems.length > 0) {
                window.Utils.log(`[批量导入] 正在写入数据库，新增 ${finalItems.length} 条...`);
                plasmids.value = [...plasmids.value, ...finalItems];
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



        // 原生文件打开 (Electron 专用)
        const openFileNative = async (filePath) => {
            if (!isElectron.value || !filePath) return;
            try {
                const softwarePath = settings.value.externalSoftwarePath || '';
                const result = await ipcRenderer.invoke('open-file-native', {
                    filePath,
                    softwarePath
                });
                if (!result.success) {
                    alert('无法打开文件: ' + result.error);
                }
            } catch (err) {
                console.error('Open native error:', err);
                alert('打开文件失败，请检查路径是否正确');
            }
        };

        const viewSequence = async (item) => {
            if (!item) return;
            
            let seq = item.序列 || '';
            
            // 如果内存中没有序列，尝试从序列文件加载
            if (!seq && item.序列文件 && isElectron.value) {
                try {
                    const content = await ipcRenderer.invoke('read-file-silent', item.序列文件);
                    if (content) {
                        seq = content;
                        // 更新到内存中，避免下次重复加载
                        item.序列 = seq;
                    }
                } catch (e) {
                    window.Utils.log(`读取序列文件失败: ${item.序列文件}`, 'ERROR');
                }
            }
            
            // 如果还是没有序列，尝试从原始路径提取
            if (!seq && item.路径 && isElectron.value) {
                try {
                    seq = await window.DataService.extractSequence(item.路径);
                    if (seq) {
                        item.序列 = seq;
                    }
                } catch (e) {
                    window.Utils.log(`提取序列失败: ${item.路径}`, 'ERROR');
                }
            }

            if (!seq) {
                window.Utils.showToast('该记录暂无序列信息', 'WARN');
                return;
            }

            // 先设置数据，再打开弹窗，确保 Vue 渲染时数据已就绪
            currentSequenceItem.value = item;
            currentSequence.value = seq;
            showSequenceModal.value = true;
        };

        const copySequence = () => {
            if (!currentSequence.value) return;
            navigator.clipboard.writeText(currentSequence.value);
            window.Utils.showToast('序列已复制到剪贴板');
        };

        // 选择外部软件路径 (Electron 专用)
        const selectExternalSoftware = async () => {
            if (!isElectron.value) return;
            try {
                const path = await ipcRenderer.invoke('select-executable');
                if (path) {
                    settings.value.externalSoftwarePath = path;
                    window.DataService.saveSettings(settings.value);
                }
            } catch (err) {
                console.error('Select executable error:', err);
            }
        };

        // 生成外部生物信息数据库链接
        const getBioLinks = (gene, species) => {
            if (!gene) return [];
            
            // 物种映射表：中文名 -> { 英文名, TaxonomyID }
            const speciesMap = {
                '人': { en: 'Human', taxId: '9606' },
                '小鼠': { en: 'Mouse', taxId: '10090' },
                '大鼠': { en: 'Rat', taxId: '10116' },
                '食蟹猴': { en: 'Cynomolgus', taxId: '9541' },
                '猪': { en: 'Pig', taxId: '9823' },
                '果蝇': { en: 'Drosophila', taxId: '7227' },
                '斑马鱼': { en: 'Zebrafish', taxId: '7955' },
                '大肠杆菌': { en: 'E.coli', taxId: '562' },
                '拟南芥': { en: 'Arabidopsis', taxId: '3702' }
            };

            // 处理多个基因的情况（逗号分隔）
            const genes = Array.isArray(gene) ? gene : gene.split(/[,，\s]+/);
            
            // 获取物种的国际化搜索词
            const rawSpecies = Array.isArray(species) ? species[0] : (species || '');
            const mapped = speciesMap[rawSpecies];
            
            const links = [];
            genes.forEach(g => {
                if (!g || g === '无') return;
                
                // 1. UniProt 链接：推荐使用 Taxonomy ID 过滤，并优先显示已审核 (Swiss-Prot) 条目
                // 针对 UniProt 2026 数据库调整：增加 (reviewed:true) 权重或过滤，确保结果可靠
                let uniprotQuery = encodeURIComponent(g);
                if (mapped) {
                    uniprotQuery += encodeURIComponent(` taxonomy_id:${mapped.taxId}`);
                }
                // 优先显示经过人工审核的条目，避免受 2026 年 TrEMBL 大规模删减非参考蛋白组条目的影响
                const uniprotUrl = `https://www.uniprot.org/uniprotkb?query=${uniprotQuery}%20AND%20(reviewed:true%20OR%20* )&sort=score`;
                
                // 2. NCBI 链接：使用基因名 + 英文物种名
                let ncbiQuery = encodeURIComponent(g);
                if (mapped) {
                    ncbiQuery += encodeURIComponent(` ${mapped.en}`);
                }

                links.push({
                    name: g,
                    uniprot: uniprotUrl,
                    ncbi: `https://www.ncbi.nlm.nih.gov/search/all/?term=${ncbiQuery}`,
                    geneCards: `https://www.genecards.org/Search/Keyword?queryString=${encodeURIComponent(g)}`
                });
            });
            return links;
        };

        const deleteItem = async (item) => {
            if (!confirm(`确定要删除质粒 "${item.文件名}" 吗？此操作不可撤销。`)) return;
            
            window.Utils.log(`[删除] 正在处理删除请求: ${item.文件名}`);
            try {
                const index = plasmids.value.findIndex(p => p.文件名 === item.文件名);
                if (index > -1) {
                    plasmids.value.splice(index, 1);
                    window.DataService.saveToCache(plasmids.value);
                    window.Utils.log(`[删除] 内存记录已移除`);
                    
                    if (isElectron.value) {
                        window.Utils.log(`[删除] 正在同步数据库文件...`);
                        const success = await window.DataService.electronSave(plasmids.value);
                        if (success) {
                            window.Utils.log('[删除] 成功同步至本地数据库');
                            window.Utils.showToast('记录已删除');
                        } else {
                            window.Utils.log('[删除] 数据库文件同步失败', 'WARN');
                            window.Utils.showToast('删除失败，请重试', 'ERROR');
                        }
                    } else {
                        window.Utils.showToast('记录已从缓存中删除');
                    }
                } else {
                    window.Utils.log(`[删除] 未找到匹配记录: ${item.文件名}`, 'WARN');
                }
            } catch (err) {
                window.Utils.log(`[删除] 发生错误: ${err.message}`, 'ERROR');
                window.Utils.showToast('删除失败，请检查日志');
            }
        };

        // 暴露方法和数据
        return { 
            plasmids, searchQuery, activeFilters, currentPage, pageSize, 
            filterOptions, filteredPlasmids, paginatedPlasmids, totalPages, 
            toggleFilter, isFilterActive, 
            copyText: (text, msg) => window.Utils.copyText(text, msg, window.Utils.showToast), 
            openFileNative, getBioLinks,
            handleFileSelect, handleDrop, isDragging, resetData,
            editingItem, editForm, editItem, saveEdit, deleteItem,
            downloadJSON: handleDownloadJSON, 
            downloadCSV: handleDownloadCSV,
            saveDatabaseFile, saveSettingsFile,
            linkLocalDatabase, dbFileHandle,
            settings, showSettingsModal,
            suggestions,
            isDatabaseReady,
            systemLogs, showLogModal,
            batchImportItems, showBatchModal, triggerBatchImport, scanAndImportLocal, saveBatchImport, handleBatchFiles, toggleAllBatchItems,
            isElectron, selectExternalSoftware, regenerateAllSequences,
            
            // 用户引导
            showGuide,
            guideStep,
            guideSteps,
            nextGuide,
            skipGuide,
            startGuide,

            // 序列相关
            showSequenceModal,
            currentSequence,
            currentSequenceItem,
            currentSequenceFileName,
            currentSequencePath,
            currentSequenceLength,
            sequenceViewerOptions,
            viewSequence,
            copySequence,

            // CSV 相关
            showExportModal,
            exportFields,
            handleCSVImport,
            toggleAllExportFields
        };
    }
};

const app = createApp(App);
if (window.Utils) {
    window.Utils.log(`[系统] Vue 版本: ${Vue.version} | runtimeCompiler: ${typeof Vue.compile === 'function' ? '是' : '否'}`);
}

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
    console.error('Vue Error:', err, info);
    if (window.Utils) {
        window.Utils.log(`Vue 运行时错误: ${err.message} (在 ${info} 中)`, 'ERROR');
    }
};

window.addEventListener('error', (event) => {
    if (window.Utils) {
        window.Utils.log(`浏览器未捕获错误: ${event.message} at ${event.filename}:${event.lineno}`, 'ERROR');
    }
});

try {
    app.mount('#app');
    if (window.Utils) {
        window.Utils.log('[系统] app.mount(#app) 成功');
    }
    setTimeout(() => {
        const el = document.getElementById('app');
        const hasVApp = !!(el && el.hasAttribute('data-v-app'));
        const hasRawMustache = !!(el && el.textContent && el.textContent.includes('{{'));
        if (window.Utils) {
            window.Utils.log(`[系统] 渲染自检: data-v-app=${hasVApp ? '是' : '否'} | rawMustache=${hasRawMustache ? '是' : '否'}`);
            if (hasRawMustache) {
                window.Utils.log('[系统] 检测到未渲染模板文本（{{ }}），请重点检查模板编译/挂载流程', 'ERROR');
            }
        }
    }, 80);
} catch (err) {
    console.error('Vue mount failed:', err);
    const appEl = document.getElementById('app');
    if (appEl) appEl.setAttribute('v-cloak', '');
    const loader = document.getElementById('init-loader');
    if (loader) {
        loader.style.display = 'flex';
        const msg = err && err.message ? err.message : String(err);
        loader.innerHTML = `<div class="text-center">
            <p class="text-red-600 font-bold text-lg">启动失败</p>
            <p class="text-gray-500 text-sm mt-2">app.mount 出错：${msg}</p>
            <p class="text-[10px] text-gray-400 mt-4 opacity-70">请查看控制台或 data/app_debug.log</p>
        </div>`;
    }
    if (window.Utils) {
        window.Utils.log(`Vue 挂载失败: ${err && err.message ? err.message : String(err)}`, 'ERROR');
    }
}
