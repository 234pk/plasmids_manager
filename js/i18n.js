
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
            filtered: '当前筛选出'
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
            filtered: 'Filtered'
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
