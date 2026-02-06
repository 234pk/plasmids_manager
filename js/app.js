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

        // 初始化 ProjectManager
        let projectManager = {};
        // 延迟初始化，等待 ipcRenderer 定义
        // 但是 setup 内部是同步的。
        // isElectron 和 ipcRenderer 是后面定义的。
        // 我应该把 ProjectManager 初始化放在后面，或者把 ipcRenderer 定义提前。

        
        // 监听 plasmids 变化
        watch(plasmids, (newVal) => {
            if (window.Utils && newVal.length > 0) {
                window.Utils.log(`数据状态更新: 当前内存中共有 ${newVal.length} 条记录`);
            }
            // 清理已删除的选中项
            if (selectedPlasmids.value.size > 0) {
                const currentIds = new Set(newVal.map(p => p.id));
                const toRemove = [];
                selectedPlasmids.value.forEach(id => {
                    if (!currentIds.has(id)) toRemove.push(id);
                });
                toRemove.forEach(id => selectedPlasmids.value.delete(id));
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
                minMatchScore: 0.75,
                enableNlp: true,
                extractTargetGene: true
            },
            displayConfig: {
                showTags: true,
                showDate: true,
                itemsPerPage: 20,
                tableDensity: 'comfortable',
                columnWidths: {}, // Store column widths
                columnVisibility: {
                    '质粒信息': true,
                    '特征与分类': true,
                    '抗性': true,
                    '专业特征': true,
                    '保存位置': true,
                    '持有人': true,
                    '项目': false,
                    '时间信息': false, // 新增
                    '序列信息': true,
                    '描述': true
                }
            },
            zoomLevel: 0, // Electron zoom level
            defaultOwner: '',
            customHolders: []
        });

        const searchQuery = ref('');
        const filterLogic = ref('OR'); // 'AND' 或 'OR'
        const sortConfig = ref({ key: '添加时间', order: 'desc' }); // Default sort by add time descending

        const refreshRecognitionContext = () => {
            if (window.Recognition && window.Recognition.setContext) {
                window.Recognition.setContext({
                    rules: recognitionRules.value,
                    plasmids: plasmids.value,
                    config: {
                        minMatchScore: settings.value?.recognitionConfig?.minMatchScore ?? 0.75,
                        nameModelMinScore: 3,
                        nameModelMinRatio: 0.5
                    }
                });
            }
        };
        
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
            '四环素诱导': [],
            '保存位置': []
        });

        const hasActiveFilters = computed(() => {
            return Object.values(activeFilters.value).some(v => v.length > 0);
        });

        const clearAllFilters = () => {
            Object.keys(activeFilters.value).forEach(k => {
                activeFilters.value[k] = [];
            });
            searchQuery.value = '';
            currentPage.value = 1;
        };
        const currentPage = ref(1);
        const pageSize = ref(20);
        const isDragging = ref(false);
        const tableDensityClass = computed(() => {
            const density = settings.value.displayConfig.tableDensity || 'comfortable';
            return density === 'compact' ? 'density-compact' : 'density-comfortable';
        });

        // 批量操作相关
        const selectedPlasmids = ref(new Set());
        const lastSelectedPlasmid = ref(null); // 用于 Shift 多选

        const toggleSelection = (p, event) => {
            const id = p.id;
            if (!id) return;

            if (event && event.shiftKey && lastSelectedPlasmid.value) {
                // Shift 多选逻辑
                const list = filteredPlasmids.value; // 使用当前筛选后的列表
                const lastIdx = list.findIndex(item => item.id === lastSelectedPlasmid.value);
                const currIdx = list.findIndex(item => item.id === id);
                
                if (lastIdx > -1 && currIdx > -1) {
                    const start = Math.min(lastIdx, currIdx);
                    const end = Math.max(lastIdx, currIdx);
                    for (let i = start; i <= end; i++) {
                        selectedPlasmids.value.add(list[i].id);
                    }
                }
            } else {
                if (selectedPlasmids.value.has(id)) {
                    selectedPlasmids.value.delete(id);
                } else {
                    selectedPlasmids.value.add(id);
                }
            }
            
            if (selectedPlasmids.value.has(id)) {
                lastSelectedPlasmid.value = id;
            }
        };

        const selectAll = () => {
            if (selectedPlasmids.value.size === filteredPlasmids.value.length) {
                selectedPlasmids.value.clear();
            } else {
                filteredPlasmids.value.forEach(p => {
                    if (p.id) selectedPlasmids.value.add(p.id);
                });
            }
        };

        const batchDelete = async () => {
            const count = selectedPlasmids.value.size;
            if (count === 0) return;
            
            if (!confirm(`确定要删除选中的 ${count} 条记录吗？此操作不可恢复。`)) return;

            // 1. 从 plasmids 中移除
            plasmids.value = plasmids.value.filter(p => !selectedPlasmids.value.has(p.id));
            
            // 2. 从项目中移除关联 (虽然项目逻辑会自动清理无效ID，但最好主动清理)
            // 这里暂不处理项目那边的反向引用，因为 loadProjects 时会自动忽略无效ID，或者下次保存项目时更新
            
            selectedPlasmids.value.clear();
            window.Utils.showToast(`已删除 ${count} 条记录`);
            await saveDatabaseFile();
        };

        // 批量修改保存位置
        const batchUpdateLocation = async () => {
            console.log('[Batch] batchUpdateLocation clicked');
            window.Utils.log(`[Batch] 批量修改位置被点击, 选中数量: ${selectedPlasmids.value.size}`);
            const count = selectedPlasmids.value.size;
            if (count === 0) {
                 window.Utils.showToast('请先选择至少一个质粒');
                 return;
            }

            openBatchInputModal('批量修改保存位置', `请输入新的保存位置 (将应用到 ${count} 条记录):`, async (val) => {
                if (!val) return;
                let updatedCount = 0;
                const timestamp = Date.now();
                plasmids.value.forEach(p => {
                    if (selectedPlasmids.value.has(p.id)) {
                        p.保存位置 = val;
                        p.更新时间 = timestamp;
                        updatedCount++;
                    }
                });
                if (updatedCount > 0) {
                    window.Utils.showToast(`已更新 ${updatedCount} 条记录`);
                    await saveDatabaseFile();
                }
            }, uniqueLocations.value);
        };

        // 批量修改持有人
        const batchUpdateOwner = async () => {
            console.log('[Batch] batchUpdateOwner clicked');
            window.Utils.log(`[Batch] 批量修改持有人被点击, 选中数量: ${selectedPlasmids.value.size}`);
            const count = selectedPlasmids.value.size;
            if (count === 0) {
                 window.Utils.showToast('请先选择至少一个质粒');
                 return;
            }

            openBatchInputModal('批量修改持有人', `请输入新的持有人 (将应用到 ${count} 条记录):`, async (val) => {
                if (!val) return;
                let updatedCount = 0;
                const timestamp = Date.now();
                plasmids.value.forEach(p => {
                    if (selectedPlasmids.value.has(p.id)) {
                        p.持有人 = val;
                        p.更新时间 = timestamp;
                        updatedCount++;
                    }
                });
                if (updatedCount > 0) {
                    window.Utils.showToast(`已更新 ${updatedCount} 条记录`);
                    await saveDatabaseFile();
                }
            }, uniqueHolders.value);
        };

        // 批量输入弹窗相关
        const showBatchInputModalState = ref(false);
        const batchInputTitle = ref('');
        const batchInputLabel = ref('');
        const batchInputValue = ref('');
        const batchInputOptions = ref([]);
        let batchInputResolve = null;

        const openBatchInputModal = (title, label, callback, options = []) => {
            batchInputTitle.value = title;
            batchInputLabel.value = label;
            batchInputValue.value = '';
            batchInputOptions.value = options;
            showBatchInputModalState.value = true;
            batchInputResolve = callback;
        };

        const confirmBatchInput = () => {
            if (batchInputResolve) {
                batchInputResolve(batchInputValue.value);
            }
            showBatchInputModalState.value = false;
        };

        // 持有人管理
        // (createHolder moved to later section)

        // 批量添加到项目
        const showBatchProjectModal = ref(false);
        const showProjectModal = ref(false);
        const batchProjectTarget = ref([]); // 选中的项目ID列表

        // 打开文件所在文件夹
        const openFolder = async (filePath) => {
            if (!isElectron.value) return;
            try {
                const { ipcRenderer } = window.require('electron');
                const success = await ipcRenderer.invoke('show-item-in-folder', filePath);
                if (!success) {
                    window.Utils.showToast('无法打开文件夹: 文件路径无效', 'ERROR');
                }
            } catch (err) {
                console.error('打开文件夹失败:', err);
                window.Utils.showToast('打开文件夹失败: ' + err.message, 'ERROR');
            }
        };

        const openBatchProjectModal = () => {
            if (selectedPlasmids.value.size === 0) return;
            // 重新加载项目以确保最新
            if (projectManager && projectManager.loadProjects) {
                projectManager.loadProjects();
            }
            batchProjectTarget.value = [];
            showBatchProjectModal.value = true;
        };

        const submitBatchProject = async () => {
            if (batchProjectTarget.value.length === 0) {
                alert('请至少选择一个项目');
                return;
            }

            const targetPlasmids = plasmids.value.filter(p => selectedPlasmids.value.has(p.id));
            const projects = projectManager.projects.value.filter(p => batchProjectTarget.value.includes(p.id));

            let count = 0;
            // 遍历选中的项目
            for (const proj of projects) {
                // 调用 projectManager 的添加方法
                await projectManager.addPlasmidsToProject(proj, targetPlasmids);
                count++;
            }

            showBatchProjectModal.value = false;
            window.Utils.showToast(`已将 ${targetPlasmids.length} 条质粒分配到 ${count} 个项目`);
            await saveDatabaseFile(); // 保存质粒数据的变更（项目字段）
        };

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
            { id: '保存位置', label: '保存位置', selected: true },
            { id: '持有人', label: '持有人', selected: true },
            { id: '项目', label: '项目', selected: true },
            { id: '序列', label: '序列 (ATCG)', selected: true },
            { id: '序列文件', label: '序列文件路径', selected: true },
            { id: '路径', label: '路径', selected: true },
            { id: '描述', label: '描述', selected: true }
        ]);

        // 编辑相关
        const editingItem = ref(null);
        const editForm = ref({});

        const createNewPlasmid = () => {
            batchMode.value = false;
            batchNames.value = '';
            const newItem = {
                id: `plasmid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                文件名: '',
                路径: '',
                载体类型: '',
                靶基因: '',
                物种: '',
                功能: '',
                大肠杆菌抗性: '',
                哺乳动物抗性: '',
                插入类型: '',
                蛋白标签: '',
                荧光蛋白: '',
                启动子: '',
                突变: '',
                四环素诱导: '',
                序列: '',
                描述: '',
                保存位置: '',
                持有人: settings.value.defaultOwner || '',
                项目: []
            };
            editForm.value = JSON.parse(JSON.stringify(newItem));
            editingItem.value = newItem;
        };

        const batchCreatePlasmids = async () => {
            if (!batchNames.value.trim()) {
                window.Utils.showToast('请输入质粒名称', 'WARN');
                return;
            }

            const names = batchNames.value.split('\n').map(n => n.trim()).filter(n => n);
            if (names.length === 0) return;

            window.Utils.log(`[新增] 正在解析批量输入的 ${names.length} 条质粒名称`);
            
            const newItems = [];
            for (const name of names) {
                const newItem = {
                    id: `plasmid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    文件名: name,
                    路径: '',
                    载体类型: '',
                    靶基因: '',
                    物种: '',
                    功能: '',
                    大肠杆菌抗性: '',
                    哺乳动物抗性: '',
                    插入类型: '',
                    蛋白标签: '',
                    荧光蛋白: '',
                    启动子: '',
                    突变: '',
                    四环素诱导: '',
                    序列: '',
                    描述: '',
                    保存位置: '',
                    持有人: editForm.value.持有人 || settings.value.defaultOwner || '',
                    项目: [...(editForm.value.项目 || [])],
                    添加时间: Date.now(),
                    更新时间: Date.now()
                };

                // 智能识别
                if (window.Recognition && window.Recognition.recognize) {
                    const info = window.Recognition.recognize(name);
                    Object.assign(newItem, info);
                }
                
                newItems.push(newItem);
                await new Promise(r => setTimeout(r, 1));
            }

            // 显示预览确认界面，而不是直接保存
            batchPreviewList.value = newItems;
            showBatchPreview.value = true;
            window.Utils.showToast(`已解析 ${newItems.length} 条数据，请确认后导入`);
        };

        const batchPreviewList = ref([]);
        const showBatchPreview = ref(false);

        const confirmBatchImport = async () => {
            if (batchPreviewList.value.length === 0) return;
            
            window.Utils.log(`[新增] 确认批量导入 ${batchPreviewList.value.length} 条质粒`);
            
            // 查重逻辑
            let duplicateCount = 0;
            const validItems = [];
            
            for (const item of batchPreviewList.value) {
                // 简单查重：检查文件名是否已存在
                const exists = plasmids.value.some(p => p.文件名 === item.文件名);
                if (exists) {
                    duplicateCount++;
                    // 可以选择跳过，或者重命名。这里暂时保留，但在日志中记录
                    // 为了用户体验，我们在导入前最好让用户在表格里看到重复警告
                    // 这里我们还是导入，因为用户可能真的需要同名质粒（虽然不推荐）
                    // 但根据用户需求 "是不是没有查重"，我们应该给出提示或处理
                    // 策略：如果重复，自动在名字后面加 (1)
                    let newName = item.文件名;
                    let counter = 1;
                    while (plasmids.value.some(p => p.文件名 === newName)) {
                        newName = `${item.文件名} (${counter})`;
                        counter++;
                    }
                    if (newName !== item.文件名) {
                         item.文件名 = newName;
                         // 更新识别信息中可能依赖名字的字段? 不，识别已经完成
                    }
                }
                validItems.push(item);
            }

            plasmids.value.unshift(...validItems);
            refreshRecognitionContext();
            
            if (duplicateCount > 0) {
                 window.Utils.showToast(`导入成功 ${validItems.length} 条 (其中 ${duplicateCount} 条重名已自动重命名)`);
            } else {
                 window.Utils.showToast(`成功批量创建 ${validItems.length} 条质粒`);
            }
            
            await saveDatabaseFile();
            editingItem.value = null;
            batchMode.value = false;
            batchNames.value = '';
            showBatchPreview.value = false;
            batchPreviewList.value = [];
        };

        const cancelBatchImport = () => {
            showBatchPreview.value = false;
            batchPreviewList.value = [];
        };

        // 监听文件名变化，进行智能识别
        watch(() => editForm.value.文件名, (newVal) => {
            if (!editingItem.value || batchMode.value) return;
            const isNew = !plasmids.value.find(p => p.id === editingItem.value.id);
            if (isNew && newVal && newVal.length > 3) {
                if (window.Recognition && window.Recognition.recognize) {
                    const info = window.Recognition.recognize(newVal);
                    for (const [key, val] of Object.entries(info)) {
                        if (!editForm.value[key]) {
                            editForm.value[key] = val;
                        }
                    }
                }
            }
        });

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
        const currentSequenceOpenPath = computed(() => {
            try {
                if (!currentSequenceItem.value) return '';
                return currentSequenceItem.value.序列文件 || currentSequenceItem.value.路径 || '';
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

        const selectedBatchCount = computed(() => {
            return batchImportItems.value ? batchImportItems.value.filter(i => i.selected).length : 0;
        });
        
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
                        window.isElectron = true; // Global flag for DbManager
                    }
                }
            }
        } catch (e) {
            console.warn('Electron environment detection failed:', e);
        }
        const ipcRenderer = ipc;

        // 初始化 ProjectManager
        if (window.ProjectManager) {
            projectManager = window.ProjectManager.setup(plasmids, ipcRenderer);
        }

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
            { title: '数据导入', content: '您可以通过“批量导入”快速扫描文件夹中的质粒文件，系统会自动识别其特征；也可以使用“新建质粒”手动录入。', target: '#btn-batch-import' },
            { title: '搜索与过滤', content: '利用强大的搜索框和标签过滤功能，您可以从成千上万条记录中瞬间找到目标。', target: '#section-search' },
            { title: '查看与编辑', content: '点击表格中的任意一行即可查看详细信息并进行编辑。点击文件名旁边的图标可以打开外部数据库或本地文件。', target: '#main-table-body' },
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

        const currentView = ref('library'); // 'library', 'projects', 'holders'
        
        const handleQuickFilter = (type, value) => {
            if (!value) return;
            
            if (type === 'holder') {
                currentView.value = 'holders';
                selectedHolder.value = value;
            } else if (type === 'project') {
                currentView.value = 'projects';
                if (projectManager && projectManager.selectedProjectId) {
                     projectManager.selectedProjectId.value = value;
                }
            } else if (type === 'location') {
                currentView.value = 'library';
                // Reset other filters
                Object.keys(activeFilters.value).forEach(k => activeFilters.value[k] = []);
                activeFilters.value['保存位置'] = [value];
            }
        };

        const selectedHolder = ref(null);
  
        const uniqueHolders = computed(() => {
            const fromPlasmids = [...new Set(plasmids.value.map(p => p.持有人).filter(h => h))];
            const fromMembers = projectManager.availableMembers.value || [];
            const fromCustom = settings.value.customHolders || [];
            return [...new Set([...fromPlasmids, ...fromMembers, ...fromCustom])].sort();
        });
        const uniqueLocations = computed(() => {
            return [...new Set(plasmids.value.map(p => p.保存位置).filter(Boolean))].sort();
        });

        const getProjectById = (projectId) => {
            if (!projectId || !projectManager.projects || !projectManager.projects.value) return null;
            return projectManager.projects.value.find(p => p.id === projectId) || null;
        };

        const getProjectNameById = (projectId) => {
            const project = getProjectById(projectId);
            return project ? project.name : '';
        };

        const getProjectDescriptionById = (projectId) => {
            const project = getProjectById(projectId);
            return project ? project.description : '';
        };

        const getProjectMembersById = (projectId) => {
            const project = getProjectById(projectId);
            if (!project || !Array.isArray(project.members)) return [];
            return project.members;
        };

        const getProjectPlasmidsById = (projectId) => {
            const project = getProjectById(projectId);
            if (!project || !projectManager.getProjectPlasmids) return [];
            return projectManager.getProjectPlasmids(project);
        };

        const createHolder = () => {
            openBatchInputModal('新建持有人', '请输入新持有人姓名:', async (name) => {
                if (name && name.trim()) {
                    const newName = name.trim();
                    if (!settings.value.customHolders) settings.value.customHolders = [];
                    if (!settings.value.customHolders.includes(newName)) {
                        settings.value.customHolders.push(newName);
                        await saveDatabaseFile(); // 保存设置
                        window.Utils.showToast(`已添加持有人: ${newName}`);
                    } else {
                        window.Utils.showToast('持有人已存在', 'WARN');
                    }
                }
            });
        };

        // 批量创建相关
        const batchMode = ref(false);
        const batchNames = ref('');
        const createTab = ref('single');
        const batchPasteContent = ref('');
        
        const handleBatchPasteNames = () => {
            batchNames.value = batchPasteContent.value;
        };

        watch(batchPasteContent, (val) => {
             batchNames.value = val;
        });

        onMounted(async () => {
            let created = false;
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
            
            // 0. 缩放支持 (Electron)
            if (isElectron.value) {
                try {
                    const { webFrame } = window.require('electron');
                    
                    // 滚轮缩放 (Ctrl + Wheel)
                    window.addEventListener('wheel', (e) => {
                        if (e.ctrlKey) {
                            e.preventDefault();
                            let currentZoom = webFrame.getZoomLevel();
                            if (e.deltaY < 0) { // 向上滚动，放大
                                currentZoom += 0.1;
                            } else { // 向下滚动，缩小
                                currentZoom -= 0.1;
                            }
                            setZoom(currentZoom);
                        }
                    }, { passive: false });

                    // 键盘缩放 (Ctrl + +/-/0)
                    window.addEventListener('keydown', (e) => {
                        if (e.ctrlKey) {
                            if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
                                e.preventDefault();
                                setZoom(webFrame.getZoomLevel() + 0.1);
                            } else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
                                e.preventDefault();
                                setZoom(webFrame.getZoomLevel() - 0.1);
                            } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
                                e.preventDefault();
                                setZoom(0);
                            }
                        }
                    });
                    
                    window.Utils.log('[系统] 已启用页面缩放支持 (Ctrl+滚轮/键盘)');
                } catch (err) {
                    console.error('Zoom setup failed:', err);
                }
            }
            
            // 1. 核心初始化 (IPC 检查)
            try {
                if (isElectron.value && ipcRenderer) {
                    window.Utils.log('[系统] 正在通过 IPC 检查必要的本地文件结构...');
                    created = await ipcRenderer.invoke('check-init-files');
                    if (created) {
                        window.Utils.log('[系统] 检测到首次运行，已自动创建初始数据库');
                        // 如果是全新初始化的环境，强制重置引导状态，确保显示新手引导
                        localStorage.removeItem('has_seen_guide');
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
                        
                        // Apply saved zoom level if exists
                        if (isElectron.value && typeof settings.value.zoomLevel === 'number') {
                            try {
                                const { webFrame } = window.require('electron');
                                webFrame.setZoomLevel(settings.value.zoomLevel);
                            } catch (e) {
                                console.error('Failed to apply saved zoom level:', e);
                            }
                        }
                        
                        window.Utils.log('[系统] 用户个性化设置已应用');
                    }
                } catch (e) {
                    window.Utils.log('[系统] 加载设置文件失败: ' + e.message, 'ERROR');
                }

                try {
                    window.Utils.log('[系统] 正在解析质粒识别规则库...');
                    recognitionRules.value = await window.Recognition.loadRecognitionRules();
                    refreshRecognitionContext();
                    window.Utils.log('[系统] 识别引擎已就绪');
                } catch (e) {
                    window.Utils.log('[系统] 加载识别规则失败: ' + e.message, 'ERROR');
                }
            };
            loadResources(); 

            // 3. 数据库加载
            try {
                window.Utils.log('[系统] 正在请求加载质粒数据库...');
                let dbData = await window.DataService.loadDatabase();
                
                // 确保每条数据都有唯一ID
                if (dbData && Array.isArray(dbData)) {
                    let idUpdated = false;
                    dbData.forEach(p => {
                        if (!p.id) {
                            p.id = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                            idUpdated = true;
                        }
                    });
                    if (idUpdated) {
                        window.Utils.log('[系统] 已为旧数据自动生成唯一ID');
                    }
                }

                if (dbData && dbData.length > 0) {
                    plasmids.value = dbData;
                    refreshRecognitionContext();
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
                // 如果是首次创建且数据库为空，保持 isDatabaseReady = false 以显示引导页
                // 否则（有数据 或 非首次运行），进入主界面
                if (!created || (plasmids.value && plasmids.value.length > 0)) {
                    isDatabaseReady.value = true;
                    window.Utils.log('[系统] 业务逻辑初始化完毕，UI 已切换至就绪状态');
                } else {
                    window.Utils.log('[系统] 首次运行且数据库为空，显示引导页');
                }
            }
        });

        // 监听设置变化
        watch(settings, (newSettings) => {
            window.DataService.saveSettings(newSettings);
            pageSize.value = newSettings.displayConfig.itemsPerPage;
            refreshRecognitionContext();
        }, { deep: true });

        let recognitionRefreshTimer = null;
        watch(plasmids, () => {
            if (recognitionRefreshTimer) clearTimeout(recognitionRefreshTimer);
            recognitionRefreshTimer = setTimeout(() => {
                refreshRecognitionContext();
                window.Utils.log('[识别] 已根据当前数据刷新识别上下文');
            }, 500);
        }, { deep: true });

        // 监听数据库就绪状态，决定是否显示新手引导
        watch(isDatabaseReady, (ready) => {
            if (ready && !localStorage.getItem('has_seen_guide')) {
                setTimeout(() => {
                    window.Utils.log('[系统] 准备展示功能引导');
                    startGuide();
                }, 500);
            }
        });

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
            if (isElectron.value && ipcRenderer) {
                window.Utils.log('[系统] 正在同步数据到本地文件...');
                const success = await window.DataService.electronSave(plasmids.value);
                if (success) {
                    window.Utils.log('[系统] 本地文件同步成功');
                } else {
                    window.Utils.log('[系统] 本地文件同步失败', 'ERROR');
                }
            } else {
                window.DataService.saveToCache(plasmids.value);
                window.Utils.showToast('数据已保存到缓存');
            }
        };

        const createNewDatabase = async () => {
            if (!window.DbManager) return;
            const result = await window.DbManager.createNewDatabase();
            if (result) {
                if (confirm('新数据库创建成功，是否立即切换到新数据库？')) {
                    plasmids.value = result.data;
                    window.DataService.setDatabasePath(result.filePath);
                    window.Utils.showToast('已切换到新数据库');
                }
            }
        };

        const switchDatabase = async () => {
            if (!window.DbManager) return;
            const result = await window.DbManager.switchDatabase();
            if (result) {
                plasmids.value = result.data;
                window.DataService.setDatabasePath(result.filePath);
                window.Utils.showToast('数据库切换成功');
            }
        };

        // Duplicate openFolder removed

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

        const loadSampleDatabase = async () => {
            const samplePlasmids = [
              {
                id: window.Utils.generateUUID(),
                文件名: "pUC19-Sample",
                name: "pUC19",
                length: 2686,
                载体类型: ["Plasmid"],
                物种: ["E. coli"],
                features: [
                  { name: "AmpR", start: 1, end: 100, type: "CDS" },
                  { name: "Ori", start: 200, end: 300, type: "origin" }
                ],
                保存位置: "Example Location",
                持有人: "User",
                项目: [],
                添加时间: Date.now(),
                更新时间: Date.now()
              },
              {
                id: window.Utils.generateUUID(),
                文件名: "pEGFP-C1-Sample",
                name: "pEGFP-C1",
                length: 4731,
                载体类型: ["Mammalian Expression"],
                物种: ["Human"],
                features: [
                  { name: "CMV Promoter", start: 1, end: 500, type: "promoter" },
                  { name: "EGFP", start: 600, end: 1300, type: "CDS" }
                ],
                保存位置: "Freezer 1",
                持有人: "Lab Manager",
                项目: [],
                添加时间: Date.now(),
                更新时间: Date.now()
              }
            ];
            plasmids.value = samplePlasmids;
            await saveDatabaseFile();
            isDatabaseReady.value = true;
            window.Utils.showToast('已加载示例数据库');
        };

        const startFromScratch = async () => {
            plasmids.value = [];
            await saveDatabaseFile();
            isDatabaseReady.value = true;
            window.Utils.showToast('已创建空白数据库');
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
            if (!confirm('确定要重新扫描并生成所有质粒的序列文件吗？\n这将覆盖现有的 sequences 文件夹内容。\n\n规则：\n1. 优先从文件路径读取 (.dna/.gb/.fasta)\n2. 其次从系统记录的序列生成\n3. .dna/.gb 文件将自动转换为标准 GenBank 格式')) return;

            window.Utils.log('[维护] 开始重新生成序列文件...');
            let successCount = 0;
            let failCount = 0;
            const total = plasmids.value.length;
            
            window.Utils.showToast(`正在后台处理 ${total} 个文件...`, 'INFO');

            for (let i = 0; i < total; i++) {
                const item = plasmids.value[i];
                let sequence = null;
                let source = ''; // 'file' or 'memory'
                let originalFilePath = null;

                // 优先级 1: 从文件路径读取
                if (item.路径) {
                    try {
                        const fileSeq = await window.DataService.extractSequence(item.路径);
                        if (fileSeq) {
                            sequence = fileSeq;
                            source = 'file';
                            originalFilePath = item.路径;
                        }
                    } catch (e) {
                        console.warn(`Failed to extract from file for ${item.文件名}`, e);
                    }
                }

                // 优先级 2: 从系统内存/数据库读取 (如果文件读取失败或无路径)
                if (!sequence && item.序列) {
                    sequence = item.序列;
                    source = 'memory';
                }

                if (sequence) {
                    // 更新内存中的序列
                    item.序列 = sequence;
                    
                    let savedPath = null;
                    
                    // 如果是从文件读取，且是 .dna (SnapGene) 或 .gb 文件，尝试转换为标准 XML-GB 格式
                    if (source === 'file' && originalFilePath) {
                        const ext = originalFilePath.split('.').pop().toLowerCase();
                        if (['dna', 'gb', 'gbk', 'xml'].includes(ext)) {
                            try {
                                // 强制转换并保存为 .gb (包含 XML 特性)
                                savedPath = await window.DataService.convertAndSaveToGb(originalFilePath, item.文件名);
                            } catch (e) {
                                console.error('Convert to GB failed:', e);
                            }
                        }
                    }
                    
                    // 如果没有转换保存 (例如是从 FASTA 读取，或转换失败，或来自内存)，则保存为默认格式
                    if (!savedPath) {
                        savedPath = await window.DataService.saveSequenceToFile(item.文件名, sequence);
                    }

                    if (savedPath) {
                        item.序列文件 = savedPath;
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }

                if (i % 10 === 0) {
                    window.Utils.log(`[维护] 进度: ${i + 1}/${total}`);
                }
            }

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
                    refreshRecognitionContext();
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
                四环素诱导: window.Utils.ensureString(item.四环素诱导),
                保存位置: item.保存位置 || '',
                持有人: item.持有人 || '',
                项目: item.项目 || []
            };
        };

        const saveEdit = async () => {
            if (batchMode.value) {
                await batchCreatePlasmids();
                return;
            }

            if (!editingItem.value) return;
            const originalId = editingItem.value.id;
            const originalName = editingItem.value.文件名;
            window.Utils.log(`[编辑] 正在保存修改: ${originalName} (ID: ${originalId})`);

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
                    四环素诱导: window.Utils.ensureArray(editForm.value.四环素诱导),
                    保存位置: editForm.value.保存位置 || '',
                    持有人: editForm.value.持有人 || '',
                    项目: editForm.value.项目 || [],
                    添加时间: editingItem.value.添加时间 || Date.now(),
                    更新时间: Date.now()
                };

                // 如果是从文件读取，且是 .dna (SnapGene) 文件，尝试转换为标准 XML-GB 格式
                if (isElectron.value && updatedItem.路径 && updatedItem.路径.toLowerCase().endsWith('.dna')) {
                     try {
                         const gbPath = await window.DataService.convertAndSaveToGb(updatedItem.路径, updatedItem.文件名);
                         if (gbPath) {
                             updatedItem.序列文件 = gbPath;
                             window.Utils.log(`[编辑] 已将 DNA 转换为 GB 格式保存: ${updatedItem.文件名}`);
                         }
                     } catch (e) {
                         console.error('Convert to GB failed during edit save:', e);
                     }
                }
                
                const learnFromEdits = () => {
                    const learner = window.Recognition?.learnFromUserCorrection;
                    if (!learner) return;
                    const fields = ['载体类型', '靶基因', '物种', '功能', '大肠杆菌抗性', '哺乳动物抗性', '插入类型', '蛋白标签', '荧光蛋白', '启动子', '突变', '四环素诱导'];
                    const normalize = (val) => window.Utils.ensureArray(val).map(v => String(v).trim()).filter(Boolean).join(',');
                    fields.forEach(field => {
                        const originalValue = normalize(editingItem.value?.[field]);
                        const correctedValue = normalize(updatedItem[field]);
                        if (!correctedValue || originalValue === correctedValue) return;
                        learner(updatedItem.文件名, field, originalValue, correctedValue);
                    });
                };

                learnFromEdits();

                // 查重：如果是修改模式（index > -1），检查改名后是否与他人冲突
                // 如果是新增模式（index === -1），检查名字是否已存在
                const index = plasmids.value.findIndex(p => p.id === originalId);
                const isDuplicate = plasmids.value.some(p => p.文件名 === updatedItem.文件名 && p.id !== originalId);
                
                if (isDuplicate) {
                    // 找到那个重名的记录
                    const conflictIndex = plasmids.value.findIndex(p => p.文件名 === updatedItem.文件名 && p.id !== originalId);
                    
                    if (confirm(`质粒名称 "${updatedItem.文件名}" 已存在。\n\n是否更新覆盖现有的同名记录？\n\n点击"确定"覆盖更新现有记录。\n点击"取消"返回修改名称。`)) {
                        // 用户确认覆盖更新
                        if (conflictIndex > -1) {
                            // 保留被覆盖记录的 ID，确保引用关系不变
                            updatedItem.id = plasmids.value[conflictIndex].id;
                            
                            // 如果是编辑模式，且原记录不是被覆盖的那条（即A改名为B，覆盖B），则需要删除A
                            if (index > -1) {
                                plasmids.value.splice(index, 1);
                                // 删除后重新查找冲突记录的索引（因为数组变了）
                                const newConflictIndex = plasmids.value.findIndex(p => p.id === updatedItem.id);
                                if (newConflictIndex > -1) {
                                    plasmids.value[newConflictIndex] = updatedItem;
                                }
                            } else {
                                // 新增模式，直接覆盖
                                plasmids.value[conflictIndex] = updatedItem;
                            }
                            window.Utils.log(`[编辑] 重名覆盖更新: ${updatedItem.文件名}`);
                        }
                    } else {
                        return;
                    }
                } else {
                    // 无冲突，正常保存
                    if (index > -1) {
                        // 更新现有记录
                        const newName = updatedItem.文件名;
                        window.Utils.log(`[编辑] 正在更新内存记录: ${newName}`);
                        plasmids.value[index] = updatedItem;
                    } else {
                        // 新增记录
                        window.Utils.log(`[编辑] 正在新增记录: ${updatedItem.文件名}`);
                        plasmids.value.unshift(updatedItem); // 新增的排在前面
                    }
                }
                refreshRecognitionContext();

                window.DataService.saveToCache(plasmids.value);
                
                // 桌面端自动同步到文件
                if (isElectron.value) {
                    // 如果有序列，同步到 sequences 目录
                    if (updatedItem.序列) {
                        window.Utils.log(`[编辑] 正在同步序列文件: ${updatedItem.文件名}`);
                        await window.DataService.saveSequenceToFile(updatedItem.文件名, updatedItem.序列);
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

            // 0. 项目/持有人视图预过滤
            let baseList = plasmids.value;
            if (currentView.value === 'projects' && projectManager.selectedProjectId.value) {
                baseList = baseList.filter(p => p.项目 && p.项目.includes(projectManager.selectedProjectId.value));
            } else if (currentView.value === 'holders' && selectedHolder.value) {
                baseList = baseList.filter(p => p.持有人 === selectedHolder.value);
            }

            const s = searchQuery.value.trim().toLowerCase();
            
            let results = baseList.map(p => {
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
                const filterEntries = Object.entries(activeFilters.value).filter(([_, v]) => v.length > 0);
                
                if (filterEntries.length === 0) return true;

                if (filterLogic.value === 'AND') {
                    // 交集：必须满足所有选中的类别
                    return filterEntries.every(([k, v]) => {
                        const pv = Array.isArray(p[k]) ? p[k] : (p[k] ? [p[k]] : []);
                        return v.some(val => pv.includes(val));
                    });
                } else {
                    // 并集：满足任何一个选中的类别即可
                    return filterEntries.some(([k, v]) => {
                        const pv = Array.isArray(p[k]) ? p[k] : (p[k] ? [p[k]] : []);
                        return v.some(val => pv.includes(val));
                    });
                }
            });

            // 如果在搜索，按得分排序
            if (s) {
                filtered.sort((a, b) => b.score - a.score);
            } else {
                // 否则按配置排序
                const key = sortConfig.value.key || '添加时间';
                const order = sortConfig.value.order || 'desc';
                
                filtered.sort((a, b) => {
                    let valA = a.plasmid[key];
                    let valB = b.plasmid[key];
                    
                    // Handle missing values (treat as 0 or empty string)
                    if (valA === undefined || valA === null) valA = 0;
                    if (valB === undefined || valB === null) valB = 0;

                    if (typeof valA === 'string' && typeof valB === 'string') {
                        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    }
                    
                    return order === 'asc' ? valA - valB : valB - valA;
                });
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

        const paginatedPlasmids = computed(() => {
            if (pageSize.value === -1) return filteredPlasmids.value;
            return filteredPlasmids.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value);
        });
        const totalPages = computed(() => {
            if (pageSize.value === -1) return 1;
            return Math.ceil(filteredPlasmids.value.length / pageSize.value) || 1;
        });
        
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

        // Initialize Batch Logic
        const batchLogic = window.createBatchLogic({
            plasmids,
            batchImportItems,
            showBatchModal,
            recognitionRules,
            settings,
            isElectron,
            projectManager
        });
        
        const { 
            handleBatchFiles,
            scanAndImportLocal,
            triggerBatchImport,
            saveBatchImport,
            saveBatchUpdate,
            toggleAllBatchItems,
            batchTab
        } = batchLogic;




        // Duplicate openFolder removed

        // 原生文件打开 (Electron 专用)
        const openFileNative = async (filePath) => {
            if (!isElectron.value || !filePath) return;
            try {
                let finalPath = filePath;
                if (window.require) {
                    const path = window.require('path');
                    if (!path.isAbsolute(finalPath)) {
                        finalPath = path.join(__dirname, finalPath);
                    }
                }
                const softwarePath = settings.value.externalSoftwarePath || '';
                const result = await ipcRenderer.invoke('open-file-native', {
                    filePath: finalPath,
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

        // 智能打开质粒文件 (支持无路径但有序列的记录自动生成文件)
        const openPlasmidExternal = async (item) => {
            if (!isElectron.value) {
                window.Utils.showToast('请在桌面客户端中使用此功能');
                return;
            }
            if (!item) return;

            // 1. 优先尝试直接打开关联文件
            if (item.路径) {
                 await openFileNative(item.路径);
                 return;
            }

            // 2. 尝试打开已生成的序列文件
            if (item.序列文件) {
                await openFileNative(item.序列文件);
                return;
            }

            // 3. 如果没有文件但有序列内容，自动生成并打开
            if (item.序列) {
                const seq = item.序列;
                const fileName = item.文件名 || 'sequence';
                let savedPath = null;
                const stepPrefix = '[智能打开]';

                window.Utils.showToast('正在生成临时文件...');

                // 尝试 XML/SnapGene 转换
                if (seq.trim().startsWith('<?xml') || seq.includes('<SnapGene')) {
                    const gbContent = window.DataService.snapGeneXmlToGenBank(seq, fileName);
                    if (gbContent) {
                        savedPath = await window.DataService.saveGbFile(fileName, gbContent);
                        if (savedPath) window.Utils.log(`${stepPrefix} XML 转换为 GB 成功: ${savedPath}`);
                    }
                }

                // 降级为 FASTA
                if (!savedPath) {
                    savedPath = await window.DataService.saveSequenceToFile(fileName, seq);
                    if (savedPath) window.Utils.log(`${stepPrefix} 生成 FASTA 成功: ${savedPath}`);
                }

                if (savedPath) {
                    // 更新记录引用
                    item.序列文件 = savedPath;
                    item.更新时间 = Date.now();
                    
                    // 尝试打开
                    await openFileNative(savedPath);
                    
                    // 保存数据库以记住新生成的文件关联
                    await saveDatabaseFile(); 
                } else {
                     window.Utils.showToast('无法生成序列文件', 'ERROR');
                }
                return;
            }

            window.Utils.showToast('该记录没有文件路径或序列信息', 'WARN');
        };

        const openSequenceExternal = async () => {
            if (!isElectron.value) return;
            const seq = currentSequence.value || '';
            const item = currentSequenceItem.value;
            
            if (item) {
                // 如果当前查看的有对应的 item，直接复用通用逻辑
                await openPlasmidExternal(item);
            } else {
                // 纯文本查看模式（理论上不常用，兜底）
                 window.Utils.showToast('无法定位原始记录，无法外部打开', 'WARN');
            }
        };

        const applyRecognitionToEditForm = (info) => {
            if (!info || typeof info !== 'object') return;
            for (const [key, value] of Object.entries(info)) {
                if (key === '文件名') continue;
                const values = Array.isArray(value)
                    ? value.map(v => String(v).trim()).filter(v => v && v !== '无')
                    : (value ? [value] : []);
                if (values.length === 0) continue;
                if (!editForm.value[key] || (Array.isArray(editForm.value[key]) && editForm.value[key].length === 0)) {
                    editForm.value[key] = Array.isArray(value) ? values : value;
                }
            }
        };

        const manualRecognizeName = () => {
            const name = editForm.value?.文件名 || '';
            if (!name || name === 'New Plasmid') {
                window.Utils.showToast('请输入质粒名称', 'WARN');
                return;
            }
            const recognizer = window.RecognitionService?.recognize
                ? window.RecognitionService
                : window.Recognition;
            if (!recognizer || !recognizer.recognize) {
                window.Utils.showToast('识别引擎未就绪', 'WARN');
                return;
            }
            const info = recognizer.recognize(name);
            applyRecognitionToEditForm(info);
            window.Utils.log(`[识别] 手动触发名称识别: ${name}`);
        };
        const copySequence = () => {
            if (!currentSequence.value) return;
            navigator.clipboard.writeText(currentSequence.value);
            window.Utils.showToast('序列已复制到剪贴板');
        };

        // 打开外部链接
        const openExternalLink = (url) => {
            if (!url) return;
            if (isElectron.value) {
                const { shell } = window.require('electron');
                shell.openExternal(url);
            } else {
                window.open(url, '_blank');
            }
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
                '拟南芥': { en: 'Arabidopsis', taxId: '3702' },
                '仓鼠': { en: 'Hamster', taxId: '10029' },
                '酵母': { en: 'Yeast', taxId: '4932' }
            };

            const genes = Array.isArray(gene) ? gene : gene.split(/[,，\s]+/);
            let rawSpecies = Array.isArray(species) ? species[0] : (species || '');
            
            // 过滤 "哺乳动物" (Mammal)
            if (rawSpecies && rawSpecies.includes('哺乳动物')) {
                rawSpecies = '';
            }

            let speciesInfo = null;
            let speciesNameForUrl = '';

            if (rawSpecies) {
                if (speciesMap[rawSpecies]) {
                    speciesInfo = speciesMap[rawSpecies];
                } else if (!/[\u4e00-\u9fa5]/.test(rawSpecies)) {
                    // 如果不包含中文，直接作为英文名使用
                    speciesNameForUrl = rawSpecies;
                }
            }

            const links = [];
            genes.forEach(g => {
                if (!g || g === '无') return;
                
                let uniprotUrl = '';
                let ncbiUrl = '';

                if (speciesInfo) {
                    // UniProt: gene AND taxonomy_id:xxxx
                    const upQuery = encodeURIComponent(`${g} AND taxonomy_id:${speciesInfo.taxId}`);
                    uniprotUrl = `https://www.uniprot.org/uniprotkb?query=${upQuery}&sort=score`;

                    // NCBI: gene AND txidXXXX[Taxonomy ID]
                    const ncbiQuery = encodeURIComponent(`${g} AND ${speciesInfo.taxId}[Taxonomy ID]`);
                    ncbiUrl = `https://www.ncbi.nlm.nih.gov/gene/?term=${ncbiQuery}`;
                } else if (speciesNameForUrl) {
                    // 英文名搜索
                    const upQuery = encodeURIComponent(`${g} AND ${speciesNameForUrl}`);
                    uniprotUrl = `https://www.uniprot.org/uniprotkb?query=${upQuery}&sort=score`;

                    const ncbiQuery = encodeURIComponent(`${g} AND ${speciesNameForUrl}[Organism]`);
                    ncbiUrl = `https://www.ncbi.nlm.nih.gov/gene/?term=${ncbiQuery}`;
                } else {
                    // 仅搜索基因名
                    const query = encodeURIComponent(g);
                    uniprotUrl = `https://www.uniprot.org/uniprotkb?query=${query}&sort=score`;
                    ncbiUrl = `https://www.ncbi.nlm.nih.gov/gene/?term=${query}`;
                }

                links.push({
                    name: g,
                    uniprot: uniprotUrl,
                    ncbi: ncbiUrl,
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

        // 批量创建质粒逻辑已在 line 326 定义，此处删除重复定义以修复 SyntaxError

        let nameRecognizeTimer = null;
        let lastRecognizedName = '';
        watch(() => editForm.value.文件名, (newName) => {
            if (!newName || newName === 'New Plasmid') return;
            if (nameRecognizeTimer) clearTimeout(nameRecognizeTimer);
            nameRecognizeTimer = setTimeout(() => {
                if (editForm.value.文件名 !== newName) return;
                if (newName.length < 4) return;
                const isMostlyEmpty = !editForm.value.载体类型 && !editForm.value.靶基因;
                if (!isMostlyEmpty) return;
                if (lastRecognizedName === newName) return;
                const recognizer = window.RecognitionService?.recognize
                    ? window.RecognitionService
                    : window.Recognition;
                if (recognizer && recognizer.recognize) {
                    const info = recognizer.recognize(newName);
                    applyRecognitionToEditForm(info);
                    lastRecognizedName = newName;
                    if (window.Utils) {
                        window.Utils.log(`[识别] 延迟自动识别触发: ${newName}`);
                    }
                }
            }, 800);
        });

        // Helpers for Template (to avoid complex expressions and HTML validation errors)
        const getVectorTypeChar = (p) => {
            return (p.载体类型 && p.载体类型[0]) ? p.载体类型[0].charAt(0).toUpperCase() : 'P';
        };
        
        const newBatchCount = computed(() => {
            return batchImportItems.value ? batchImportItems.value.filter(i => !i.isDuplicate).length : 0;
        });

        const updateBatchCount = computed(() => {
            return batchImportItems.value ? batchImportItems.value.filter(i => i.isDuplicate).length : 0;
        });

        const isBatchAllSelected = computed(() => {
            if (!batchImportItems.value) return false;
            const targetItems = batchImportItems.value.filter(i => (batchTab.value === 'new' ? !i.isDuplicate : i.isDuplicate));
            return targetItems.length > 0 && targetItems.every(i => i.selected);
        });

        // Zoom control
        const setZoom = (level) => {
            if (!isElectron.value) return;
            try {
                const { webFrame } = window.require('electron');
                webFrame.setZoomLevel(level);
                settings.value.zoomLevel = level;
                saveSettingsFile();
            } catch (err) {
                console.error('Failed to set zoom:', err);
            }
        };

        const getColumnWidth = (name) => {
            if (settings.value.displayConfig.columnWidths && settings.value.displayConfig.columnWidths[name]) {
                const w = settings.value.displayConfig.columnWidths[name];
                return { width: w + 'px', minWidth: w + 'px' };
            }
            return {};
        };

        // 列宽调整逻辑
        const initResize = (e) => {
            const th = e.target.parentElement;
            const startX = e.pageX;
            const startWidth = th.offsetWidth;
            // 获取列名：取第一个文本节点的去重内容
            const colName = Array.from(th.childNodes)
                .find(node => node.nodeType === Node.TEXT_NODE)
                ?.textContent.trim();
            
            // 添加临时样式以防止选中文本和光标闪烁
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            th.classList.add('resizing');

            const onMouseMove = (moveEvent) => {
                const currentX = moveEvent.pageX;
                const diff = currentX - startX;
                const newWidth = Math.max(50, startWidth + diff); // 最小宽度 50px
                
                th.style.width = `${newWidth}px`;
                th.style.minWidth = `${newWidth}px`; // 强制生效
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // 恢复样式
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                th.classList.remove('resizing');

                // 保存列宽
                const finalWidth = parseFloat(th.style.width);
                if (!isNaN(finalWidth) && colName) {
                    if (!settings.value.displayConfig.columnWidths) {
                        settings.value.displayConfig.columnWidths = {};
                    }
                    settings.value.displayConfig.columnWidths[colName] = finalWidth;
                    saveSettingsFile();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const clearProjectPlasmids = async (projectId) => {
            if (!confirm('确定要清空该项目下的所有质粒关联吗？\n注意：这不会删除质粒，只会移除其项目归属。')) return;
            let count = 0;
            plasmids.value.forEach(p => {
                if (p.项目 && p.项目.includes(projectId)) {
                    p.项目 = p.项目.filter(id => id !== projectId);
                    count++;
                }
            });
            if (count > 0) {
                window.Utils.showToast(`已移除 ${count} 个质粒的项目关联`);
                await saveDatabaseFile();
            } else {
                window.Utils.showToast('该项目下没有关联质粒');
            }
        };

        const deleteHolder = async (holderName) => {
            if (!confirm(`确定要删除持有人 "${holderName}" 吗？\n此操作将：\n1. 清空所有质粒的该持有人信息\n2. 从常用持有人列表中移除\n3. 从所有项目中移除该成员`)) return;
            
            // 1. 从所有质粒中移除
            let plasmidCount = 0;
            plasmids.value.forEach(p => {
                if (p.持有人 === holderName) {
                    p.持有人 = '';
                    plasmidCount++;
                }
            });
            
            // 2. 从自定义持有人列表中移除
            let settingsChanged = false;
            if (settings.value.customHolders && settings.value.customHolders.includes(holderName)) {
                settings.value.customHolders = settings.value.customHolders.filter(h => h !== holderName);
                settingsChanged = true;
            }

            // 3. 从所有项目中移除
            let projectChanged = false;
            if (projectManager && projectManager.removeMemberFromAllProjects) {
                projectChanged = await projectManager.removeMemberFromAllProjects(holderName);
            }

            // 保存更改
            if (plasmidCount > 0) {
                await saveDatabaseFile();
            }
            if (settingsChanged) {
                await saveSettingsFile();
            }
            
            window.Utils.showToast(`已删除持有人 "${holderName}" (清理质粒: ${plasmidCount})`);
        };

        // 暴露方法和数据
        return { 
            initResize, setZoom, getColumnWidth,
            getVectorTypeChar, newBatchCount, updateBatchCount, isBatchAllSelected, 
            plasmids, searchQuery, filterLogic, sortConfig, activeFilters, hasActiveFilters, clearAllFilters, currentPage, pageSize, 
            filterOptions, filteredPlasmids, paginatedPlasmids, totalPages, 
            toggleFilter, isFilterActive, 
            copyText: (text, msg) => window.Utils.copyText(text, msg, window.Utils.showToast), 
            openFileNative, openFolder, getBioLinks,
            handleFileSelect, handleDrop, isDragging, resetData,
            editingItem, editForm, editItem, saveEdit, deleteItem, createNewPlasmid, batchCreatePlasmids,
            createHolder, batchUpdateOwner, batchUpdateLocation,
            createTab, batchPasteContent, handleBatchPasteNames,
            downloadJSON: handleDownloadJSON, 
            downloadCSV: handleDownloadCSV,
            saveDatabaseFile, saveSettingsFile,
            linkLocalDatabase, loadSampleDatabase, startFromScratch, dbFileHandle,
            settings, showSettingsModal,
            suggestions,
            isDatabaseReady,
            systemLogs, showLogModal,
            batchImportItems, showBatchModal, triggerBatchImport, scanAndImportLocal, saveBatchImport, saveBatchUpdate, handleBatchFiles, toggleAllBatchItems, selectedBatchCount, batchTab,
            isElectron, selectExternalSoftware, regenerateAllSequences,
            
            // 用户引导
            showGuide,
            guideStep,
            guideSteps,
            nextGuide,
            skipGuide,
            startGuide,
            
            clearProjectPlasmids,
            deleteHolder,

            // 序列相关
            showSequenceModal,
            currentSequence,
            currentSequenceItem,
            currentSequenceFileName,
            currentSequencePath,
            currentSequenceLength,
            currentSequenceOpenPath,
            sequenceViewerOptions,
            viewSequence,
            copySequence,
            openSequenceExternal,
            openPlasmidExternal,
            manualRecognizeName,
            openExternalLink,

            // CSV 相关
            showExportModal,
            exportFields,
            handleCSVImport,
            toggleAllExportFields,
            
            // 批量操作相关
            selectedPlasmids,
            toggleSelection,
            selectAll,
            batchDelete,
            showBatchProjectModal,
            showProjectModal,
            batchProjectTarget,
            openBatchProjectModal,
            submitBatchProject,

            // 批量输入弹窗
            showBatchInputModalState,
            batchInputTitle,
            batchInputLabel,
            batchInputValue,
            batchInputOptions,
            confirmBatchInput,

            currentView,
            handleQuickFilter,
            selectedHolder,
            uniqueHolders,
            batchMode, batchNames,
            batchPreviewList, showBatchPreview, confirmBatchImport, cancelBatchImport,
            tableDensityClass,
            uniqueLocations,
            getProjectById,
            getProjectNameById,
            getProjectDescriptionById,
            getProjectMembersById,
            getProjectPlasmidsById,
            projectManager, // 确保模板可以通过 projectManager.xxx 访问
            ...projectManager,
            createNewDatabase,
            switchDatabase
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
