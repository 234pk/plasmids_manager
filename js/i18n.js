
(function() {
    // 默认翻译（手动维护的核心词汇）
    const zhManual = {
        common: {
            save: '保存',
            cancel: '取消',
            confirm: '确定',
            delete: '删除',
            edit: '编辑',
            add: '添加',
            search: '搜索',
            loading: '加载中...',
            noData: '暂无数据',
            success: '操作成功',
            error: '操作失败',
            warning: '警告',
            tip: '提示',
            all: '全部',
            none: '无',
            close: '关闭',
            back: '返回',
            next: '下一步',
            prev: '上一步',
            skip: '跳过',
            start: '立即开启',
            finish: '完成',
            records: '条记录',
            filtered: '当前筛选出',
            openExternal: '软件打开',
            viewSequence: '查看序列'
        },
        nav: {
            library: '质粒库',
            projects: '项目管理',
            holders: '持有人管理',
            settings: '设置',
            logs: '系统日志'
        },
        actions: {
            newPlasmid: '新建质粒',
            batchImport: '批量导入',
            scanDirectory: '扫描目录',
            export: '导出',
            import: '导入',
            save: '保存数据库',
            settings: '设置',
            more: '更多操作'
        },
        guide: {
            welcomeTitle: '👋 欢迎使用',
            welcomeContent: '这是一个专为科研人员设计的质粒管理系统。它不仅能帮您记录质粒，还能自动从文件中提取序列和特征。让我们花 1 分钟了解如何高效使用。',
            importTitle: '📂 快速导入',
            importContent: '点击“批量导入”可以直接扫描整个文件夹！系统会智能识别文件名中的抗性、启动子等信息，并自动关联 .dna/.gb 文件。',
            searchTitle: '🔍 极速搜索',
            searchContent: '您可以按文件名、靶基因、抗性或项目进行多维度搜索。支持拼音首字母搜索，找质粒从未如此简单。',
            projectTitle: '📁 项目管理',
            projectContent: '将质粒归类到不同的项目中。点击这里可以切换到项目视角，查看每个项目的质粒清单和成员。',
            holderTitle: '👥 持有人视图',
            holderContent: '想知道某个成员手里有多少质粒？切换到持有人视图，按人员进行归类和管理。',
            logTitle: '📜 操作记录',
            logContent: '所有的修改都会被记录下来。点击这里可以查看系统日志，追踪每一条数据的变动。',
            settingsTitle: '⚙️ 深度定制',
            settingsContent: '在设置中，您可以配置默认持有人、修改识别规则、开启/关闭自动序列保存功能。',
            finishTitle: '✅ 准备就绪',
            finishContent: '引导结束！现在您可以开始建立您的实验室质粒库了。如有疑问，可以随时在设置中重新开启引导。'
        },
        fields: {
            fileName: '文件名',
            vectorType: '载体类型',
            targetGene: '靶基因',
            species: '物种',
            function: '功能',
            eColiResistance: '大肠杆菌抗性',
            mammalianResistance: '哺乳动物抗性',
            insertType: '插入类型',
            proteinTag: '蛋白标签',
            fluorescentProtein: '荧光蛋白',
            promoter: '启动子',
            mutation: '突变',
            tetInducible: '四环素诱导',
            location: '保存位置',
            owner: '持有人',
            project: '项目',
            addTime: '添加时间',
            updateTime: '更新时间',
            description: '描述',
            sequence: '序列'
        },
        help: {
            title: '使用帮助',
            tabs: {
                intro: '功能简介',
                import: '导入与识别',
                search: '搜索技巧',
                faq: '常见问题'
            },
            content: {
                intro: '这是一个面向实验室日常工作的质粒管理工具，目标是把散落的质粒文件变成可检索、可统计、可追溯的数据库。\n\n你可以用它做什么：\n1) 建库：导入/新建数据库，集中管理质粒条目\n2) 自动识别：从文件名与路径中提取抗性、启动子、标签、物种等字段（支持手动校准）\n3) 结构化管理：按“项目 / 持有人 / 保存位置”组织与统计\n4) 快速检索：全局搜索 + 高级筛选 + 排序\n5) 外部联动：一键打开所在文件夹、外部软件、UniProt/NCBI\n\n推荐工作流：批量导入 → 校准识别结果 → 分配项目/持有人 → 日常用搜索与筛选快速定位。',
                import: '导入方式：\n- 批量导入：适合初始化建库。可多选文件或扫描目录（桌面版支持绝对路径）。\n- 手动新建：适合临时记录或补录。\n\n识别机制：\n- 系统会对文件名拆词，匹配抗性/启动子/标签/物种/诱导等关键词；可能给出多个候选值，你可以在校准界面勾选保留。\n\n导入建议：\n- 文件名尽量包含关键信息（载体/插入/抗性/物种），同一实验室统一命名后识别准确率会明显提升。\n\n常见失败原因：\n- 文件移动/重命名导致路径失效\n- 权限限制（尤其 macOS 受保护目录）\n- 网络不可用导致 UniProt 查询失败',
                search: '搜索入口：\n- 顶部全局搜索：直接输入关键词（文件名/靶基因/抗性/项目/持有人/位置等）\n- 高级筛选（质粒库视图）：按字段多选过滤，并支持“交集 AND / 并集 OR”\n\n实用技巧：\n- 先筛选后搜索：先按项目/持有人/位置缩小范围，再查关键词更快\n- 善用排序：按更新时间快速找到最近修改的数据\n- 文件定位：桌面版支持打开所在文件夹；外部软件打开需先在设置中配置软件路径',
                faq: 'Q: 新手引导点下一步就消失？\nA: 已修复：之前逻辑层误用 computed 导致报错中断渲染。\n\nQ: UniProt 为什么查询失败/无结果？\nA: 可能是基因名不规范、物种不匹配或网络不可用。已增强：会展示接口错误，并增加更宽松的兜底查询。\n\nQ: macOS 上打不开文件/选不中文件夹？\nA: 请到 系统设置 → 隐私与安全 → 文件与文件夹，允许应用访问；并尽量把数据库放在可读写目录（如 Documents/用户目录）。\n\nQ: 数据库文件存在哪里？\nA: 桌面版默认使用 Electron userData 目录下的 data 文件夹；也可通过“新建数据库/切换数据库”保存到任意位置。'
            }
        },
        recentDb: {
            title: '最近使用的数据库',
            path: '路径',
            action: '操作',
            clear: '清空记录',
            empty: '暂无历史记录',
            load: '加载'
        }
    };

    const enManual = {
        common: {
            save: 'Save',
            cancel: 'Cancel',
            confirm: 'Confirm',
            delete: 'Delete',
            edit: 'Edit',
            add: 'Add',
            search: 'Search',
            loading: 'Loading...',
            noData: 'No Data',
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            tip: 'Tip',
            all: 'All',
            none: 'None',
            close: 'Close',
            back: 'Back',
            next: 'Next',
            prev: 'Prev',
            skip: 'Skip',
            start: 'Start Now',
            finish: 'Finish',
            records: 'records',
            filtered: 'Filtered',
            openExternal: 'Open in Software',
            viewSequence: 'View Sequence'
        },
        nav: {
            library: 'Library',
            projects: 'Projects',
            holders: 'Holders',
            settings: 'Settings',
            logs: 'Logs'
        },
        actions: {
            newPlasmid: 'New Plasmid',
            batchImport: 'Batch Import',
            scanDirectory: 'Scan Directory',
            export: 'Export',
            import: 'Import',
            save: 'Save DB',
            settings: 'Settings',
            more: 'More'
        },
        guide: {
            welcomeTitle: '👋 Welcome',
            welcomeContent: 'A plasmid management system designed for researchers. It records plasmids and extracts sequences/features automatically.',
            importTitle: '📂 Fast Import',
            importContent: 'Click "Batch Import" to scan folders! The system identifies resistance, promoters, and links .dna/.gb files.',
            searchTitle: '🔍 Quick Search',
            searchContent: 'Search by name, gene, resistance, or project. Supports Pinyin initials for easy lookup.',
            projectTitle: '📁 Projects',
            projectContent: 'Categorize plasmids into projects. Switch to project view to see lists and members.',
            holderTitle: '👥 Holders',
            holderContent: 'Manage plasmids by owner in the holder view.',
            logTitle: '📜 Activity Logs',
            logContent: 'All changes are recorded. Check logs to track data history.',
            settingsTitle: '⚙️ Customization',
            settingsContent: 'Configure default owners, rules, and sequence auto-save in settings.',
            finishTitle: '✅ Ready',
            finishContent: 'Setup complete! Start building your lab plasmid library now.'
        },
        fields: {
            fileName: 'File Name',
            vectorType: 'Vector Type',
            targetGene: 'Target Gene',
            species: 'Species',
            function: 'Function',
            eColiResistance: 'E.coli Resistance',
            mammalianResistance: 'Mammalian Resistance',
            insertType: 'Insert Type',
            proteinTag: 'Protein Tag',
            fluorescentProtein: 'Fluorescent Protein',
            promoter: 'Promoter',
            mutation: 'Mutation',
            tetInducible: 'Tet Inducible',
            location: 'Location',
            owner: 'Owner',
            project: 'Project',
            addTime: 'Added',
            updateTime: 'Updated',
            description: 'Description',
            sequence: 'Sequence'
        },
        help: {
            title: 'Help Center',
            tabs: {
                intro: 'Introduction',
                import: 'Import & Recognize',
                search: 'Search Tips',
                faq: 'FAQ'
            },
            content: {
                intro: 'This app helps labs turn scattered plasmid files into a searchable and maintainable database.\n\nKey capabilities:\n1) Build a database from existing files\n2) Auto-extract features (resistance/promoter/tags/species) with manual correction\n3) Organize by Projects / Holders / Locations\n4) Fast search + advanced filters + sorting\n5) Integrations: open folder, open in external software, UniProt/NCBI links\n\nRecommended workflow: Batch import → validate recognition results → assign projects/holders → search & filter daily.',
                import: 'Import options:\n- Batch Import: best for initial database setup. Select multiple files or scan a directory (desktop mode supports absolute paths).\n- Manual Create: add a single plasmid entry quickly.\n\nCommon issues:\n- File moved/renamed after import\n- Permission restrictions (especially on macOS protected folders)\n- Network unavailable (UniProt search)',
                search: 'Tips:\n- Use global search for quick lookup (name/gene/resistance/project/owner/location).\n- Use filters in Library view to narrow down, then search inside the smaller set.\n- Sort by Updated time to find recent edits quickly.\n\nDesktop integrations:\n- Open folder / open in external software (configure software path in Settings).',
                faq: 'Q: Why did onboarding disappear on Next?\nA: Fixed: computed access bug in guide logic caused a render error.\n\nQ: Why UniProt search fails?\nA: Gene names may not match exactly, taxonomy may differ, or network is unavailable. The search now shows API errors and uses broader fallback queries.\n\nQ: macOS cannot open/select files?\nA: Check System Settings → Privacy & Security → Files and Folders permissions, and avoid read-only locations.\n\nQ: Where is data stored?\nA: Desktop builds store app data under Electron userData directory by default. You can also create/switch databases anywhere.'
            }
        },
        recentDb: {
            title: 'Recent Databases',
            path: 'Path',
            action: 'Action',
            clear: 'Clear History',
            empty: 'No history found',
            load: 'Load'
        }
    };

    // 合并生成的翻译
    const zh = Object.assign({}, zhManual, (window.I18nData && window.I18nData.zh) || {});
    const en = Object.assign({}, enManual, (window.I18nData && window.I18nData.en) || {});

    window.I18n = {
        translations: { zh, en },
        locale: localStorage.getItem('app_locale') || 'zh',
        t(path) {
            const keys = path.split('.');
            let result = this.translations[this.locale];
            
            // 首先尝试作为路径访问 (如 common.save)
            let found = true;
            for (const key of keys) {
                if (result && result[key] !== undefined) {
                    result = result[key];
                } else {
                    found = false;
                    break;
                }
            }
            
            if (found) return result;
            
            // 如果没找到，尝试作为顶级 key 直接访问 (如 gen_0001)
            result = this.translations[this.locale][path];
            if (result !== undefined) return result;

            return path;
        },
        setLocale(lang) {
            if (this.translations[lang]) {
                this.locale = lang;
                localStorage.setItem('app_locale', lang);
                // 强制刷新页面以应用所有翻译，或者让 Vue 响应
                // 在 Vue 中我们已经有了响应式处理，所以这里只需要返回 true
                return true;
            }
            return false;
        }
    };
})();
