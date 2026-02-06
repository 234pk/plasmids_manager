/**
 * 识别引擎与规则加载
 */
window.Recognition = {
    // --- 6. 模糊匹配与变体 ---
    VARIANTS: {
        'EGFP': ['EGFP', 'eGFP', 'egfp', 'GFP-EGFP'],
        '3×FLAG': ['3×FLAG', '3xFlag', '3XFLAG', '3-FLAG', 'FLAG3'],
        '3×HA': ['3×HA', '3xHA', '3XHA', '3-HA', 'HA3'],
        'Myc': ['Myc', 'MYC', 'c-Myc'],
        'His': ['His', 'HIS', '6×His', '6His']
    },
    nameModel: null,
    rulesCache: null,
    plasmidCache: null,

    // 6.2 相似度匹配（使用 Levenshtein 距离）
    similarity: (str1, str2) => {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const costs = [];
        for (let i = 0; i <= shorter.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= longer.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (shorter[i - 1] !== longer[j - 1]) {
                        newValue = Math.min(newValue, lastValue, costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[longer.length] = lastValue;
        }
        
        return (longer.length - costs[longer.length]) / longer.length;
    },

    // 6.3 模糊匹配函数
    fuzzyMatch: (input, options, threshold) => {
        if (!input) return null;
        if (options.has(input)) return input;
        
        const effectiveThreshold = typeof threshold === 'number'
            ? threshold
            : (window.Recognition.config?.minMatchScore ?? 0.7);
        const optsArray = Array.from(options);
        if (optsArray.includes(input)) return input;
        
        // 变体匹配
        for (const [standard, variants] of Object.entries(window.Recognition.VARIANTS)) {
            if (variants.includes(input)) return standard;
        }
        
        // 相似度匹配
        for (const option of optsArray) {
            if (window.Recognition.similarity(input.toLowerCase(), option.toLowerCase()) >= effectiveThreshold) {
                return option;
            }
        }
        
        return null;
    },
    normalizeToken: (token) => {
        if (!token) return '';
        return token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
    },
    tokenizeName: (name) => {
        if (!name) return [];
        const cleaned = name.replace(/\.[^/.]+$/, '');
        const base = cleaned.replace(/[\\/]/g, ' ').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
        const rawTokens = base.split(' ').map(t => t.trim()).filter(Boolean);
        const tokens = new Set();
        rawTokens.forEach(token => {
            const normalized = window.Recognition.normalizeToken(token);
            if (normalized && normalized.length >= 2) tokens.add(normalized.toLowerCase());
            if (token.includes('.')) {
                token.split('.').forEach(part => {
                    const p = window.Recognition.normalizeToken(part);
                    if (p && p.length >= 2) tokens.add(p.toLowerCase());
                });
                const noDot = window.Recognition.normalizeToken(token.replace(/\./g, ''));
                if (noDot && noDot.length >= 2) tokens.add(noDot.toLowerCase());
            }
        });
        return Array.from(tokens);
    },
    buildNameModel: (plasmids = []) => {
        const config = window.Recognition.config || {};
        const model = {
            tokenIndex: {},
            config: {
                minScore: typeof config.nameModelMinScore === 'number' ? config.nameModelMinScore : 3,
                minRatio: typeof config.nameModelMinRatio === 'number' ? config.nameModelMinRatio : 0.5
            }
        };
        const fields = ['载体类型', '物种', '功能', '插入类型', '蛋白标签', '荧光蛋白', '启动子', '大肠杆菌抗性', '哺乳动物抗性', '四环素诱导'];
        plasmids.forEach(p => {
            const filename = p?.文件名;
            if (!filename) return;
            const tokens = window.Recognition.tokenizeName(filename);
            if (!tokens.length) return;
            fields.forEach(field => {
                const values = p[field];
                const list = Array.isArray(values) ? values : (values ? [values] : []);
                list.forEach(v => {
                    if (!v || v === '无') return;
                    const value = String(v).trim();
                    if (!value) return;
                    tokens.forEach(token => {
                        if (!model.tokenIndex[token]) model.tokenIndex[token] = {};
                        if (!model.tokenIndex[token][field]) model.tokenIndex[token][field] = {};
                        model.tokenIndex[token][field][value] = (model.tokenIndex[token][field][value] || 0) + 1;
                    });
                });
            });
        });
        return model;
    },
    updateNameModel: (plasmids = []) => {
        try {
            if (!Array.isArray(plasmids) || plasmids.length === 0) return null;
            const model = window.Recognition.buildNameModel(plasmids);
            window.Recognition.nameModel = model;
            window.Recognition.plasmidCache = plasmids;
            if (window.Utils) {
                const tokenCount = Object.keys(model.tokenIndex || {}).length;
                window.Utils.log(`[识别] 名称模型已更新，token 数: ${tokenCount}`);
            }
            return model;
        } catch (e) {
            if (window.Utils) {
                window.Utils.log(`[识别] 名称模型更新失败: ${e.message}`, 'WARN');
            }
            return null;
        }
    },
    inferFromNameModel: (name, model) => {
        if (!name || !model || !model.tokenIndex) return {};
        const tokens = window.Recognition.tokenizeName(name);
        if (!tokens.length) return {};
        const scores = {};
        tokens.forEach(token => {
            const hit = model.tokenIndex[token];
            if (!hit) return;
            Object.entries(hit).forEach(([field, values]) => {
                if (!scores[field]) scores[field] = {};
                Object.entries(values).forEach(([val, count]) => {
                    scores[field][val] = (scores[field][val] || 0) + count;
                });
            });
        });
        const inferred = {};
        Object.entries(scores).forEach(([field, values]) => {
            const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
            const total = entries.reduce((sum, item) => sum + item[1], 0);
            if (!total) return;
            const [topValue, topScore] = entries[0];
            const ratio = topScore / total;
            const minScore = model.config?.minScore ?? 2;
            const minRatio = model.config?.minRatio ?? 0.35;
            if (topScore >= minScore && ratio >= minRatio) {
                inferred[field] = [topValue];
            }
        });
        return inferred;
    },
    setContext: ({ rules, plasmids, config } = {}) => {
        if (rules) window.Recognition.rulesCache = rules;
        if (config) window.Recognition.config = config;
        if (plasmids) window.Recognition.updateNameModel(plasmids);
    },
    recognize: (name) => {
        const rules = window.Recognition.rulesCache;
        const existing = window.Recognition.plasmidCache || [];
        const file = { name: name || '', path: '' };
        return window.Recognition.recognizePlasmid(file, rules, existing);
    },

    // --- 3. 推断规则 (Inference Rules) ---
    FUNCTION_INFERENCE: {
        'RNAi敲降': [
            ['pLKO', 'shRNA'], ['pLKO', 'sgRNA'], ['pUAST', 'shRNA'], 
            ['pAc5', 'shRNA'], ['pH1', 'shRNA'], ['VALIUM20', 'shRNA'],
            ['pVALIUM', 'shRNA'], ['pVALIUM20', 'shRNA']
        ],
        'CRISPR敲除/编辑': [
            ['pLKO', 'sgRNA'], ['pX330', 'sgRNA'], ['pX335', 'sgRNA'], 
            ['pX458', 'sgRNA'], ['lentiCRISPR', 'sgRNA'], ['pJET', 'sgRNA'],
            ['pU6', 'sgRNA']
        ],
        '过表达/功能载体': [
            ['pCDH', 'cDNA'], ['pcDNA3.1', 'cDNA'], ['pCMV', 'ORF'], 
            ['pHA-Myc', 'cDNA'], ['pET', 'cDNA'], ['pUAST', 'cDNA'], ['pUAST', 'ORF'],
            ['pAc5', 'cDNA'],
            ['pKDEL', 'ORF'], ['pKDEL', 'cDNA'],
            ['pGL3', []], ['pLV', []],
            ['pHA', []], ['pmBaoJin', []]
        ],
        '病毒包装载体': [
            ['pMD2', []], ['psPAX2', []], ['pVSVg', []], ['pCMV-dR8.2', []]
        ],
        'miRNA表达': [
            ['pCDH', 'miRNA'], ['pcDNA3.1', 'miRNA'], ['pLKO', 'miRNA']
        ],
        '空载体': [
            ['pLKO', []], ['pCDH', []], ['pcDNA3.1', []]
        ]
    },

    RESISTANCE_INFERENCE: {
        'pLKO':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pCDH':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pcDNA3':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pcDNA3.1': { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pUAST':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pAc5':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pET':      { 大肠杆菌抗性: ['Kanamycin'], 哺乳动物抗性: [] },
        'pJET':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pGL3':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        '慢病毒包装': { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pLVX':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pMD2':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'psPAX2':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pKDEL':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'GV141':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pH1':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'Ac5':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pCo':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pTet-On':  { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pTeton':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pTRE':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pVALIUM':  { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pVALIUM20':{ 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pLV':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pHA':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] }
    },

    GENE_SPECIES_RULES: {
        '人': /^[A-Z]{2,}[0-9]*$/,      // TP53
        '小鼠': /^[A-Z][a-z]{2,}[0-9]*$/, // Trp53
        '大鼠': /^[A-Z][a-z]{1,}[0-9]*$/  // Rattus
    },

    VECTOR_SPECIES_RULES: {
        'pUAST': '果蝇',
        'pAc5': '果蝇',
        'Ac5': '果蝇',
        'pCo': '果蝇', // Copia is Drosophila
        'pVALIUM': '果蝇',
        'pET': '大肠杆菌',
        'pLKO': '哺乳动物',
        'pcDNA': '哺乳动物',
        'pCDH': '哺乳动物',
        'pCMV': '哺乳动物',
        'pKDEL': '哺乳动物',
        'pJET': '哺乳动物',
        'GV141': '哺乳动物',
        'pH1': '哺乳动物',
        'pTet': '哺乳动物',
        'pTRE': '哺乳动物'
    },

    VECTOR_PROMOTER_RULES: {
        'pAc5': 'Ac5',
        'Ac5': 'Ac5',
        'pUAST': 'UAS',
        'pLKO': 'U6',
        'pCDH': 'CMV',
        'pcDNA3': 'CMV',
        'pCMV': 'CMV',
        'GV141': 'CMV',
        'pH1': 'H1',
        'pCo': 'Copia',
        'pTet': 'TRE',
        'pTRE': 'TRE',
        'pET': 'T7',
        'pGL3': 'SV40',
        'pVALIUM20': 'UAS'
    },

    COMMON_GENES: {
        'TP53': '人', 'GAPDH': '人', 'ACTB': '人', 'HNRNPA1': '人',
        'Trp53': '小鼠', 'Gapdh': '小鼠', 'Actb': '小鼠', 'Hnrnp': '小鼠',
        'Tia1': '哺乳动物', 'Bace1': '哺乳动物'
    },

    // --- 4. 学习功能 ---
    learnFromUserCorrection: (filename, field, original, corrected) => {
        if (!filename || !field || !corrected || original === corrected) return;
        
        try {
            const LEARNING_RULES_KEY = 'recognition_learning_rules';
            const store = JSON.parse(localStorage.getItem(LEARNING_RULES_KEY) || '{"rules": []}');
            
            // 简单的规则：记住这个修正
            const rule = {
                pattern: window.Utils.escapeRegExp(corrected), // 简化：当出现这个词时
                field: field,
                original: original,
                userCorrection: corrected,
                count: 1,
                lastUpdated: new Date().toISOString()
            };

            const existingIndex = store.rules.findIndex(r => r.field === field && r.userCorrection === corrected);
            if (existingIndex > -1) {
                store.rules[existingIndex].count++;
                store.rules[existingIndex].lastUpdated = new Date().toISOString();
            } else {
                store.rules.push(rule);
            }
            
            localStorage.setItem(LEARNING_RULES_KEY, JSON.stringify(store));
        } catch (e) {
            console.warn('Failed to save learning rule', e);
        }
    },

    applyLearningRules: (name, recognized) => {
        let targetName = name;
        let targetRecognized = recognized;
        if (typeof name === 'object' && name) {
            targetRecognized = name;
            targetName = name.文件名 || '';
        }
         try {
            const LEARNING_RULES_KEY = 'recognition_learning_rules';
            const store = JSON.parse(localStorage.getItem(LEARNING_RULES_KEY) || '{"rules": []}');
            
            store.rules.forEach(rule => {
                const regex = new RegExp(rule.pattern, 'i');
                if (regex.test(targetName)) {
                     if (targetRecognized[rule.field]) {
                         targetRecognized[rule.field].add(rule.userCorrection);
                     }
                }
            });
        } catch (e) {
            // ignore
        }
    },

    // --- 5. 描述生成 ---
    generateDescription: (recognized) => {
        const parts = [];
        if (recognized.载体类型?.[0]) parts.push(recognized.载体类型[0]);
        if (recognized.功能?.[0]) parts.push(recognized.功能[0]);
        if (recognized.靶基因?.length) parts.push('靶:' + recognized.靶基因.join(','));
        if (recognized.蛋白标签?.length) parts.push('标签:' + recognized.蛋白标签.join(','));
        if (recognized.启动子?.[0]) parts.push('启动子:' + recognized.启动子[0]);
        if (recognized.哺乳动物抗性?.[0]) parts.push('抗:' + recognized.哺乳动物抗性[0]);
        return parts.join(' | ');
    },

    loadRecognitionRules: async () => {
        try {
            const response = await fetch('data/recognition_rules.json');
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.warn('Could not load recognition_rules.json automatically');
        }
        return null;
    },

    // --- 7. 标准化映射 ---
    NORMALIZE_MAP: {
        // Resistance
        'puro': 'Puromycin', 'puror': 'Puromycin', 'puromycin': 'Puromycin',
        'neo': 'Neomycin/G418', 'neor': 'Neomycin/G418', 'neomycin': 'Neomycin/G418', 'g418': 'Neomycin/G418',
        'amp': 'Ampicillin', 'ampr': 'Ampicillin', 'ampicillin': 'Ampicillin', 'bla': 'Ampicillin',
        'kan': 'Kanamycin', 'kanr': 'Kanamycin', 'kanamycin': 'Kanamycin',
        'zeo': 'Zeocin', 'zeocin': 'Zeocin',
        'hyg': 'Hygromycin', 'hygromycin': 'Hygromycin',
        'bsd': 'Blasticidin', 'blasticidin': 'Blasticidin',
        
        // Insert Type
        'orf': 'ORF/基因序列', 'cdna': 'ORF/基因序列', 'orf/基因序列': 'ORF/基因序列',
        'shrna': 'shRNA', 'sgrna': 'sgRNA', 'mirna': 'miRNA', 'grna': 'sgRNA',
        '3\'utr': '3\'UTR',
        
        // Promoters
        'sv40': 'SV40', 'cmv': 'CMV', 'u6': 'U6', 'h1': 'H1', 'ef1a': 'EF1a', 'cag': 'CAG', 'tre': 'TRE', 't7': 'T7',
        'copia': 'Copia', 'uas': 'UAS', 'ac5': 'Ac5', 'minip': 'miniP', 'hpgk': 'hPGK', 'pgk': 'hPGK',
        'du6': 'dU6', 'sp6': 'SP6', 'ubc': 'UbC',

        // Tags (Normalize case)
        'ha': 'HA', '3xha': '3xHA', 'ha-tag': 'HA',
        'flag': 'Flag', '3xflag': '3xFlag', 'flag-tag': 'Flag',
        'myc': 'Myc', '6xmyc': '6xMyc', 'c-myc': 'Myc',
        'his': 'His', '6xhis': '6xHis', 'his-tag': 'His',
        'nls': 'NLS', '2xnls': '2xNLS',
        'v5': 'V5', 'gst': 'GST', 'gfp': 'EGFP', 'egfp': 'EGFP',
        'baojin': 'Baojin (GFP variant)', 'vc155': 'VC155', 'vn173': 'VN173',
        'cherry': 'mCherry', 'mcherry': 'mCherry', 'rfp': 'RFP'
    },

    normalizeSet: (set) => {
        if (!set || !(set instanceof Set)) return;
        const originalArray = Array.from(set);
        set.clear();
        originalArray.forEach(val => {
            const lower = val.toLowerCase();
            if (window.Recognition.NORMALIZE_MAP[lower]) {
                set.add(window.Recognition.NORMALIZE_MAP[lower]);
            } else {
                set.add(val);
            }
        });
    },

    /**
     * 智能识别文件名特征
     */
    recognizePlasmid: (file, rules, existingPlasmids = []) => {
        // 准备识别库
        const allFeatures = {
            '载体类型': new Set(rules?.carriers || []),
            '靶基因': new Set(),
            '物种': new Set(rules?.species || []),
            '大肠杆菌抗性': new Set(rules?.resistance?.coli || []),
            '哺乳动物抗性': new Set(rules?.resistance?.mammal || []),
            '功能': new Set(rules?.tags || []),
            '插入类型': new Set(rules?.insert_types || []),
            '蛋白标签': new Set(rules?.protein_tags || []),
            '荧光蛋白': new Set(rules?.fluorescence || []),
            '启动子': new Set(rules?.promoters || []),
            '四环素诱导': new Set()
        };
        
        // 从现有数据库补充特征
        existingPlasmids.forEach(p => {
            Object.keys(allFeatures).forEach(k => {
                if (p[k]) (Array.isArray(p[k]) ? p[k] : [p[k]]).forEach(v => {
                    if (v && v !== '无' && v.length >= 1) allFeatures[k].add(v);
                });
            });
        });

        const fullName = file.name;
        const nameWithoutExt = fullName.replace(/\.[^/.]+$/, "");
        const nameLower = fullName.toLowerCase();
        
        // 自动提取完整路径
        let fullPath = file.name;
        if (file.webkitRelativePath) {
            fullPath = file.webkitRelativePath;
        } else if (file.path) {
            fullPath = file.path;
        }
        
        // 初始化识别结果
        const recognized = {
            文件名: fullName,
            载体类型: new Set(),
            靶基因: new Set(),
            物种: new Set(),
            功能: new Set(),
            大肠杆菌抗性: new Set(),
            哺乳动物抗性: new Set(),
            插入类型: new Set(),
            蛋白标签: new Set(),
            荧光蛋白: new Set(),
            突变: new Set(),
            启动子: new Set(),
            四环素诱导: new Set(),
            路径: fullPath,
            描述: ""
        };

        const modelResult = window.Recognition.inferFromNameModel(nameWithoutExt, window.Recognition.nameModel);
        Object.entries(modelResult).forEach(([field, values]) => {
            if (!recognized[field]) return;
            (values || []).forEach(v => recognized[field].add(v));
        });

        // 0. 应用学习规则 (Step 4)
        window.Recognition.applyLearningRules(nameWithoutExt, recognized);

        // 1. 路径识别
        const pathParts = recognized.路径.split(/[\\/]/);
        pathParts.slice(0, -1).forEach(folder => {
            const folderLower = folder.toLowerCase();
            Object.entries(allFeatures).forEach(([key, values]) => {
                values.forEach(val => {
                    if (val && folderLower.includes(val.toLowerCase())) {
                        recognized[key].add(val);
                    }
                });
            });
        });

        // 2. 启发式识别 (增强版)
        Object.entries(allFeatures).forEach(([key, values]) => {
            values.forEach(val => {
                if (!val) return;
                const valLower = val.toLowerCase();
                const escapedVal = window.Utils.escapeRegExp(valLower);
                // 尝试精确匹配
                const regex = new RegExp(`(^|[-_ .])${escapedVal}([-_ .]|$)`, 'i');
                if (regex.test(nameLower)) {
                    recognized[key].add(val);
                }
            });
        });

        // 2.1 硬编码增强 (Expanded)
        const extraRules = {
            '启动子': [/\bpCMV\b/i, /\bphU6\b/i, /\bphH1\b/i, /\bpEF1a\b/i, /\bpCAG\b/i, /\bpPGK\b/i, /\bpSV40\b/i, /\bpTRE\b/i, /\bpTight\b/i, /\bpUbi\b/i, /\bT7\b/i, /\bSP6\b/i, /\bpBad\b/i, /\bpGal\b/i, /\bU6\b/i, /\bhPGK\b/i, /\bCMV\b/i, /\bEF1a\b/i, /\bCAG\b/i, /\bTRE\b/i, /\bUAS\b/i, /\bAc5\b/i, /\bdU6\b/i, /\bpdU6\b/i, /\bpUbC\b/i, /\bUbC\b/i],
            '荧光蛋白': [/EGFP/i, /mCherry/i, /tdTomato/i, /EYFP/i, /EBFP/i, /mRuby/i, /mCitrine/i, /GFP/i, /RFP/i, /YFP/i, /BFP/i, /DsRed/i, /Cerulean/i, /Venus/i, /AmCyan/i, /Baojin/i],
            '蛋白标签': [/3xFlag/i, /Flag/i, /Myc/i, /HA/i, /His/i, /GST/i, /V5/i, /SBP/i, /Strep/i, /Avi/i, /TAP/i, /Halo/i, /Snap/i, /V155/i, /VC155/i, /VN173/i],
            '插入类型': [/shRNA/i, /sgRNA/i, /cDNA/i, /ORF/i, /promoter/i, /enhancer/i, /3'UTR/i, /5'UTR/i, /miRNA/i, /gRNA/i, /miR\d+/i],
            '四环素诱导': [/Tet-On/i, /Tet-Off/i, /TRE/i, /Dox/i, /Tetracycline/i],
            '大肠杆菌抗性': [/Ampicillin|AmpR|Amp/i, /Kanamycin|KanR|Kan/i, /Chloramphenicol|CmR|Cam/i, /Spectinomycin|SpecR|Spec/i, /Zeocin|Zeo/i],
            '哺乳动物抗性': [/Puromycin|Puro/i, /Neomycin|Neo|G418/i, /Hygromycin|Hyg/i, /Blasticidin|Blast/i, /Zeocin|Zeo/i]
        };

        Object.entries(extraRules).forEach(([key, patterns]) => {
            patterns.forEach(regex => {
                const match = nameLower.match(regex);
                if (match) {
                    // 使用模糊匹配尝试标准化
                    const standard = window.Recognition.fuzzyMatch(match[0], allFeatures[key] || new Set()) || match[0];
                    recognized[key].add(standard);
                }
            });
        });

        // 2.2 载体骨架识别 (Expanded Patterns)
        // 如果没有识别出载体类型，尝试提取常见载体格式
        if (recognized.载体类型.size === 0) {
            const vectorPatterns = [
                /\bp[A-Z][a-zA-Z0-9_-]+\b/g, // Standard pVec (e.g., pUC19)
                /\blenti[A-Z0-9_-]+\b/gi,    // lenti
                /\bAAV[A-Z0-9_-]+\b/gi,      // AAV
                /\bAd[A-Z0-9_-]+\b/gi,       // Ad
                /\bGV\d+\b/g,                // GV141
                /\bAc5\b/g,                  // Ac5
                /\bpCo\b/g,                  // pCo
                /\bpTet\w*\b/gi,             // pTet, pTet-On
                /\bpGL3\b/gi,                // pGL3
                /\bpET\w*\b/gi,              // pET
                /\bpH1\b/gi,                 // pH1
                /\bpUAST\w*\b/gi             // pUAST
            ];

            vectorPatterns.forEach(pat => {
                const matches = nameWithoutExt.match(pat);
                if (matches) {
                    matches.forEach(vec => {
                        // 过滤掉已知的启动子或其他特征
                        const isPromoter = extraRules['启动子'].some(r => r.test(vec));
                        const isKnownFeature = Object.values(recognized).some(val => val instanceof Set && val.has(vec));
                        
                        // Check length > 2 (e.g. pCo is 3)
                        if (!isPromoter && !isKnownFeature && vec.length > 2) {
                             recognized.载体类型.add(vec);
                        }
                    });
                }
            });
        }

        // 2.3 精细化物种识别
        const speciesRules = [
            { name: '人', patterns: [/human/i, /Homo sapiens/i, /\bh\b(?=[A-Z])/] },
            { name: '小鼠', patterns: [/mouse/i, /Mus musculus/i, /m(?=[A-Z])/, /mus/i, /mm(?=[A-Z])/] },
            { name: '大鼠', patterns: [/rat/i, /Rattus/i, /r(?=[A-Z])/] },
            { name: '食蟹猴', patterns: [/cynomolgus/i, /monkey/i, /cyno/i] },
            { name: '猪', patterns: [/pig/i, /porcine/i, /p(?=[A-Z])/] },
            { name: '斑马鱼', patterns: [/zebrafish/i, /Danio rerio/i, /z(?=[A-Z])/] },
            { name: '果蝇', patterns: [/drosophila/i, /fly/i, /dm(?=[A-Z])/] },
            { name: '线虫', patterns: [/elegans/i, /worm/i, /ce(?=[A-Z])/] }
        ];

        speciesRules.forEach(rule => {
            if (rule.patterns.some(regex => regex.test(nameLower) || regex.test(recognized.路径.toLowerCase()))) {
                recognized.物种.add(rule.name);
            }
        });

        // 2.4 突变识别
        const mutationRegex = /\b[A-Z]\d+[A-Z\*]\b|\bdelta\w+\b/gi;
        const mutationMatches = nameLower.match(mutationRegex);
        if (mutationMatches) {
            mutationMatches.forEach(m => recognized.突变.add(m));
        }

        // 3. 结构化靶基因提取 (Structure-Based)
        // 替代原有的 NLP 和 简单分割逻辑
        if (recognized.靶基因.size === 0) {
            const parts = nameWithoutExt.split(/[-_.]/); // 使用常见分隔符
            
            // 收集所有已识别的特征值（小写）用于过滤
            const knownValues = new Set();
            [
                recognized.载体类型, recognized.物种, recognized.功能,
                recognized.大肠杆菌抗性, recognized.哺乳动物抗性,
                recognized.插入类型, recognized.蛋白标签, recognized.荧光蛋白,
                recognized.启动子, recognized.突变, recognized.四环素诱导
            ].forEach(set => set.forEach(v => knownValues.add(v.toLowerCase())));

            // 添加一些常见的非基因干扰词
            const noiseWords = new Set([
                'vector', 'plasmid', 'cloning', 'expression', 'backbone', 'wt', 'mut', 'wildtype', 
                'variant', 'synthetic', 'linker', 'control', 'empty', 'dest', 'destination', 
                'entry', 'donor', 'helper', 'packaging', 'library', 'pool', 'mix', 
                'n', 'c', 'n-term', 'c-term', 'tag', 'flag', 'ha', 'myc', 'his', 'v5', 'gfp', 'egfp',
                'link', 'polya', 'ires', 't2a', 'p2a', 'neo', 'puro', 'amp', 'kan', 'zeo', 'hyg',
                'trc', 'human', 'mouse', 'rat', 'ko', 'oe', 'kd', 'ki', 'crispr', 'cas9', 'cas',
                'lenti', 'aav', 'retro', 'adenoviral', 'virus', 'viral',
                // New additions for strictness
                'shrna', 'sgrna', 'grna', 'guide', 'mir', 'mirna', 'sirna', 'hairpin', 
                'scramble', 'scrambled', 'negative', 'ctrl', 
                'tagged', 'fused', 'fusion', 'internal', 'external', 'fragment', 'domain',
                'promoter', 'enhancer', 'terminator', 'utr', 'cds', 'orf',
                'mutation', 'mutant', 'deletion', 'insertion', 'substitution',
                'cmv', 'ef1a', 'sv40', 'h1', 'u6', 'ubc', 'pgk', 'cag' // Common promoters as backup
            ]);

            parts.forEach(part => {
                const partLower = part.toLowerCase();
                const partTrimmed = part.trim();
                
                // 1. 过滤太短的
                if (partTrimmed.length <= 2) return;

                // 2. 过滤已识别特征
                let isKnown = false;
                // 精确匹配已知特征
                if (knownValues.has(partLower)) isKnown = true;
                
                // 3. 过滤干扰词
                if (noiseWords.has(partLower)) isKnown = true;

                // 4. 过滤数字（纯数字通常不是基因名，除非是编号）
                if (/^\d+$/.test(partTrimmed)) isKnown = true;
                
                // 5. 过滤类似 pLKO 的载体名部分 (p + Number/Chars)
                if (/^p[a-z0-9]+$/i.test(partTrimmed)) isKnown = true;

                // 6. 过滤纯非字母字符
                if (/^[^a-z]+$/i.test(partTrimmed)) isKnown = true;

                if (!isKnown) {
                    // 5. 启发式判断：基因通常是大写或首字母大写
                    // Stricter: Must start with Letter
                    if (/^v\d+$/i.test(partTrimmed)) return; // Version numbers
                    
                    recognized.靶基因.add(partTrimmed);
                }
            });
        }


        // --- 自动推断 (Step 1-3) ---
        
        // 准备推断所需数据
        const carrier = Array.from(recognized.载体类型)[0];
        const insert = Array.from(recognized.插入类型)[0];
        const genes = Array.from(recognized.靶基因);

        // Step 1: 功能推断
        if (recognized.功能.size === 0) {
            for (const [func, conditions] of Object.entries(window.Recognition.FUNCTION_INFERENCE)) {
                for (const [cCarrier, cInsert] of conditions) {
                    // 宽松匹配
                    const carrierMatch = carrier && (carrier === cCarrier || carrier.includes(cCarrier));
                    const insertMatch = Array.isArray(cInsert) 
                        ? (cInsert.length === 0 && !insert) 
                        : (insert && (insert === cInsert || insert.includes(cInsert)));
                    
                    if (carrierMatch && insertMatch) {
                        recognized.功能.add(func);
                    }
                }
            }
        }
        
        // Step 1.2: 插入类型推断 (Insert Type Inference)
        if (recognized.插入类型.size === 0) {
             // Check if it's interference/CRISPR, then DO NOT infer ORF
             const isInterference = recognized.功能.has('干扰/shRNA') || recognized.功能.has('CRISPR/Cas9') || recognized.功能.has('病毒包装');
             
             if (!isInterference) {
                 if (recognized.功能.has('过表达/功能载体')) {
                     recognized.插入类型.add('ORF/基因序列');
                 } else if (genes.length > 0 && ['pCDH', 'pcDNA3', 'pcDNA3.1', 'pUAST', 'pAc5'].some(c => carrier && carrier.includes(c))) {
                     // 再次检查载体名是否包含 shRNA/CRISPR 暗示 (如 pLKO, pLenti-shRNA)
                     const carrierLower = carrier ? carrier.toLowerCase() : '';
                     if (!carrierLower.includes('plko') && !carrierLower.includes('shrna') && !carrierLower.includes('crispr')) {
                         recognized.插入类型.add('ORF/基因序列');
                         recognized.功能.add('过表达/功能载体');
                         // Remove '空载体' if present
                         if (recognized.功能.has('空载体')) recognized.功能.delete('空载体');
                     }
                 }
             }
        }

        // Step 1.1: 启动子推断 (从载体)
        if (recognized.启动子.size === 0 && carrier) {
            for (const [vec, prom] of Object.entries(window.Recognition.VECTOR_PROMOTER_RULES || {})) {
                 if (carrier.includes(vec)) {
                     recognized.启动子.add(prom);
                 }
            }
        }

        // Step 2: 抗性推断
        if (carrier) {
            for (const [cName, res] of Object.entries(window.Recognition.RESISTANCE_INFERENCE)) {
                if (carrier.includes(cName)) {
                    if (recognized.大肠杆菌抗性.size === 0 && res.大肠杆菌抗性) {
                        res.大肠杆菌抗性.forEach(r => recognized.大肠杆菌抗性.add(r));
                    }
                    if (recognized.哺乳动物抗性.size === 0 && res.哺乳动物抗性) {
                        res.哺乳动物抗性.forEach(r => recognized.哺乳动物抗性.add(r));
                    }
                }
            }
        }

        // Step 3: 物种推断 (从基因名)
        if (recognized.物种.size === 0 && genes.length > 0) {
            genes.forEach(gene => {
                if (window.Recognition.COMMON_GENES[gene]) {
                    recognized.物种.add(window.Recognition.COMMON_GENES[gene]);
                } else {
                    for (const [species, regex] of Object.entries(window.Recognition.GENE_SPECIES_RULES)) {
                        if (regex.test(gene)) {
                            recognized.物种.add(species);
                            break;
                        }
                    }
                }
            });
        }

        // Step 3.5: 标准化与清理 (Normalization & Cleanup)
        Object.keys(recognized).forEach(key => {
            if (recognized[key] instanceof Set) {
                window.Recognition.normalizeSet(recognized[key]);
            }
        });

        // 清理冗余: EGFP vs GFP
        if (recognized.荧光蛋白.has('EGFP') && recognized.荧光蛋白.has('GFP')) {
            recognized.荧光蛋白.delete('GFP');
        }
        // 清理冗余: Fluorescent Protein shouldn't be in Tags usually
        if (recognized.荧光蛋白.size > 0) {
            recognized.荧光蛋白.forEach(fp => {
                if (recognized.蛋白标签.has(fp)) {
                    recognized.蛋白标签.delete(fp);
                }
            });
        }
        
        // 清理冗余: Tags (Flag vs 3xFlag, etc.)
        if (recognized.蛋白标签.size > 0) {
            // Flag
            if (recognized.蛋白标签.has('3xFlag') && recognized.蛋白标签.has('Flag')) {
                recognized.蛋白标签.delete('Flag');
            }
            // HA
            if (recognized.蛋白标签.has('3xHA') && recognized.蛋白标签.has('HA')) {
                recognized.蛋白标签.delete('HA');
            }
            // Myc
            if (recognized.蛋白标签.has('6xMyc') && recognized.蛋白标签.has('Myc')) {
                recognized.蛋白标签.delete('Myc');
            }
            // His
            if (recognized.蛋白标签.has('6xHis') && recognized.蛋白标签.has('His')) {
                recognized.蛋白标签.delete('His');
            }
        }
        
        // 清理冗余: Tags (Flag vs 3xFlag, etc.)
        if (recognized.蛋白标签.size > 0) {
            // Flag
            if (recognized.蛋白标签.has('3xFlag') && recognized.蛋白标签.has('Flag')) {
                recognized.蛋白标签.delete('Flag');
            }
            // HA
            if (recognized.蛋白标签.has('3xHA') && recognized.蛋白标签.has('HA')) {
                recognized.蛋白标签.delete('HA');
            }
            // Myc
            if (recognized.蛋白标签.has('6xMyc') && recognized.蛋白标签.has('Myc')) {
                recognized.蛋白标签.delete('Myc');
            }
            // His
            if (recognized.蛋白标签.has('6xHis') && recognized.蛋白标签.has('His')) {
                recognized.蛋白标签.delete('His');
            }
        }

        // Step 5: 生成描述
        recognized.描述 = window.Recognition.generateDescription({
            载体类型: Array.from(recognized.载体类型),
            功能: Array.from(recognized.功能),
            靶基因: Array.from(recognized.靶基因),
            蛋白标签: Array.from(recognized.蛋白标签),
            启动子: Array.from(recognized.启动子),
            哺乳动物抗性: Array.from(recognized.哺乳动物抗性)
        });

        // Step 4: 应用学习规则 (根据历史修正优化结果)
        // 注意：applyLearningRules 会直接修改 recognized 对象中的 Set
        window.Recognition.applyLearningRules(recognized);

        return {
            文件名: recognized.文件名,
            载体类型: Array.from(recognized.载体类型),
            靶基因: Array.from(recognized.靶基因),
            物种: Array.from(recognized.物种),
            功能: Array.from(recognized.功能),
            大肠杆菌抗性: Array.from(recognized.大肠杆菌抗性),
            哺乳动物抗性: Array.from(recognized.哺乳动物抗性),
            插入类型: Array.from(recognized.插入类型),
            蛋白标签: Array.from(recognized.蛋白标签),
            荧光蛋白: Array.from(recognized.荧光蛋白),
            启动子: Array.from(recognized.启动子),
            突变: Array.from(recognized.突变),
            四环素诱导: Array.from(recognized.四环素诱导),
            路径: recognized.路径,
            描述: recognized.描述
        };
    },

    /**
     * 从文件内容识别 (File Content Recognition)
     * 支持 GenBank (.gb), FASTA (.fasta), 和部分纯文本
     */
    recognizeFromContent: async (content, name) => {
        if (!content) return null;
        
        let textContent = '';
        if (typeof content === 'string') {
            textContent = content;
        } else {
            try {
                const decoder = new TextDecoder('utf-8');
                textContent = decoder.decode(content);
            } catch (e) {
                return null;
            }
        }

        // 初始化识别结果
        const recognized = {
            大肠杆菌抗性: new Set(),
            哺乳动物抗性: new Set(),
            启动子: new Set(),
            荧光蛋白: new Set(),
            蛋白标签: new Set(),
            载体类型: new Set(),
            靶基因: new Set(),
            插入类型: new Set(),
            功能: new Set(), // Added field
            物种: new Set()  // Added field
        };

        // 1. 分离元数据与序列 (避免在 DNA 序列中匹配 "CAG", "CAT" 等短词)
        let metadata = textContent;
        const originIndex = textContent.indexOf('ORIGIN');
        if (originIndex > -1) {
            metadata = textContent.substring(0, originIndex);
        } else if (textContent.startsWith('>')) {
            // FASTA: 仅取第一行作为元数据
            const firstLineEnd = textContent.indexOf('\n');
            metadata = firstLineEnd > -1 ? textContent.substring(0, firstLineEnd) : textContent;
        }

        // 2. 基于元数据的正则扫描 (使用单词边界 \b 防止误匹配)
        // 载体类型 (从内容中提取)
        const vectorRules = [
            /\bpCDH\b/i, /\bpLKO\b/i, /\bpVALIUM20\b/i, /\bpVALIUM\b/i, /\bpUAST\b/i, 
            /\bpAc5\b/i, /\bpcDNA3\.1\b/i, /\bpcDNA3\b/i, /\bpcDNA\b/i, /\bpLEGFP\b/i,
            /\bpCMV\b/i, /\bpLVX\b/i, /\bpET\b/i, /\bpGEX\b/i, /\bpBAD\b/i
        ];
        vectorRules.forEach(regex => {
            const match = metadata.match(regex);
            if (match) {
                // Normalize detected vector name
                let vec = match[0];
                if (/pCDH/i.test(vec)) vec = 'pCDH';
                if (/pLKO/i.test(vec)) vec = 'pLKO';
                if (/pVALIUM/i.test(vec)) vec = 'pVALIUM20'; // Assume 20 if VALIUM found? Or keep specific.
                if (/pcDNA3\.1/i.test(vec)) vec = 'pcDNA3.1';
                if (/pcDNA3/i.test(vec) && !/3\.1/.test(vec)) vec = 'pcDNA3';
                recognized.载体类型.add(vec);
            }
        });

        // 抗性
        const resistanceRules = {
            'Ampicillin': /\b(Ampicillin|AmpR|bla)\b/i,
            'Kanamycin': /\b(Kanamycin|KanR|NeoR)\b/i,
            'Chloramphenicol': /\b(Chloramphenicol|CmR|cat)\b/i,
            'Spectinomycin': /\b(Spectinomycin|SpecR|aadA)\b/i,
            'Puromycin': /\b(Puromycin|PuroR|pac)\b/i,
            'Neomycin/G418': /\b(Neomycin|NeoR|G418)\b/i,
            'Hygromycin': /\b(Hygromycin|HygR|hph)\b/i,
            'Blasticidin': /\b(Blasticidin|Bsd)\b/i,
            'Zeocin': /\b(Zeocin|BleoR|Shble)\b/i
        };

        for (const [res, regex] of Object.entries(resistanceRules)) {
            if (regex.test(metadata)) {
                if (['Ampicillin', 'Kanamycin', 'Chloramphenicol', 'Spectinomycin'].includes(res)) {
                    recognized.大肠杆菌抗性.add(res);
                } else {
                    recognized.哺乳动物抗性.add(res);
                }
            }
        }

        // 启动子 (严格匹配)
        const promoterRules = [
            /\bCMV\b/i, /\bEF1a\b/i, /\bCAG\b/i, /\bU6\b/i, /\bH1\b/i, 
            /\bSV40\b/i, /\bPGK\b/i, /\bUbC\b/i, /\bpUbC\b/i, /\bT7\b/i, /\bSP6\b/i,
            /\bhPGK\b/i, /\bAc5\b/i, /\bUAS\b/i, /\bCopia\b/i, /\bdU6\b/i, /\bpdU6\b/i,
            /\bpCMV\b/i, /\bphU6\b/i, /\bphH1\b/i, /\bpEF1a\b/i, /\bpCAG\b/i, /\bpPGK\b/i, 
            /\bpSV40\b/i, /\bpTRE\b/i, /\bpTight\b/i, /\bpUbi\b/i, /\bpBad\b/i, /\bpGal\b/i,
            /\bTRE\b/i
        ];
        promoterRules.forEach(regex => {
            const match = metadata.match(regex);
            if (match) recognized.启动子.add(match[0]);
        });

        // 插入类型 (元数据扫描)
        const insertTypeRules = [
            /\bshRNA\b/i, /\bsgRNA\b/i, /\bmiRNA\b/i, /\bgRNA\b/i, 
            /\bORF\b/i, /\bcDNA\b/i, /\bmiR-\d+\b/i, /\bmiR\d+\b/i
        ];
        insertTypeRules.forEach(regex => {
             const match = metadata.match(regex);
             if (match) {
                 if (/miR/i.test(match[0])) recognized.插入类型.add('miRNA');
                 else if (/shRNA/i.test(match[0])) recognized.插入类型.add('shRNA');
                 else if (/sgRNA|gRNA/i.test(match[0])) recognized.插入类型.add('sgRNA');
                 else if (/ORF|cDNA/i.test(match[0])) recognized.插入类型.add('ORF/基因序列');
             }
        });

        // 标签
        const tagRules = [
            /\bEGFP\b/i, /\bGFP\b/i, /\bmCherry\b/i, /\bFlag\b/i, /\bHA\b/i, 
            /\bMyc\b/i, /\bHis\b/i, /\bV5\b/i, /\bGST\b/i, /\bBFP\b/i, /\bYFP\b/i,
            /\b3xFlag\b/i, /\b3xHA\b/i, /\b6xHis\b/i, /\b6xMyc\b/i, /\bHalo\b/i, /\bSNAP\b/i
        ];
        tagRules.forEach(regex => {
            const match = metadata.match(regex);
            if (match) {
                if (/GFP|Cherry|Red|Cyan|YFP|BFP/i.test(match[0])) {
                    recognized.荧光蛋白.add(match[0]);
                } else {
                    recognized.蛋白标签.add(match[0]);
                }
            }
        });

        // 3. GenBank 特征解析 (更精准)
        const isGenBank = /LOCUS|FEATURES/.test(textContent);
        if (isGenBank) {
            const lines = metadata.split(/\r?\n/);
            const featureStart = lines.findIndex(line => line.startsWith('FEATURES'));
            
            if (featureStart > -1) {
                let currentFeature = '';
                for (let i = featureStart + 1; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // 提取特征值 /label="val", /note="val", /product="val", /gene="val"
                    const extractValue = (key) => {
                        const regex = new RegExp(`\/${key}="([^"]+)"|\/${key}=([^\\s"]+)`, 'i');
                        const m = line.match(regex);
                        return m ? (m[1] || m[2]) : null;
                    };

                    const geneVal = extractValue('gene');
                    const productVal = extractValue('product');
                    const labelVal = extractValue('label');
                    const noteVal = extractValue('note');

                    // 收集所有可能的文本信息
                    const info = [geneVal, productVal, labelVal, noteVal].filter(Boolean);
                    
                    info.forEach(val => {
                        // 启动子检测
                        promoterRules.forEach(pRegex => {
                            if (pRegex.test(val)) recognized.启动子.add(val.match(pRegex)[0]);
                        });
                        if (/promoter/i.test(val)) {
                            // 尝试提取具体的启动子名称，而不是仅仅 "promoter"
                            const pName = val.replace(/promoter|sequence/gi, '').trim();
                            if (pName.length > 2 && pName.length < 20) recognized.启动子.add(pName);
                        }

                        // 标签检测
                        tagRules.forEach(tRegex => {
                            if (tRegex.test(val)) {
                                const m = val.match(tRegex)[0];
                                if (/GFP|Cherry|Red|Cyan|YFP|BFP/i.test(m)) {
                                    recognized.荧光蛋白.add(m);
                                } else {
                                    recognized.蛋白标签.add(m);
                                }
                            }
                        });

                        // 插入类型检测 (shRNA/miRNA/ORF)
                        if (/shRNA/i.test(val) || /short hairpin/i.test(val)) recognized.插入类型.add('shRNA');
                        if (/miRNA/i.test(val) || /microRNA/i.test(val) || /miR-/i.test(val)) recognized.插入类型.add('miRNA');
                        if (/sgRNA/i.test(val) || /gRNA/i.test(val)) recognized.插入类型.add('sgRNA');
                        
                        // 抗性检测 (Fallback for GenBank features)
                        for (const [res, regex] of Object.entries(resistanceRules)) {
                            if (regex.test(val)) {
                                if (['Ampicillin', 'Kanamycin', 'Chloramphenicol', 'Spectinomycin'].includes(res)) {
                                    recognized.大肠杆菌抗性.add(res);
                                } else {
                                    recognized.哺乳动物抗性.add(res);
                                }
                            }
                        }
                    });
                }
            }
        }

        // 4. 结合文件名推断 (Name Fallback / Merge)
        // 策略：优先信赖文件内容，但如果内容缺失关键信息，使用文件名识别结果补充
        if (name) {
            const nameRes = window.Recognition.recognize(name);
            
            // 4.1 合并载体类型
            if (nameRes.载体类型 && nameRes.载体类型.length > 0) {
                nameRes.载体类型.forEach(v => recognized.载体类型.add(v));
            }

            // 4.2 合并抗性 (如果内容未找到)
            if (recognized.大肠杆菌抗性.size === 0 && nameRes.大肠杆菌抗性) {
                nameRes.大肠杆菌抗性.forEach(v => recognized.大肠杆菌抗性.add(v));
            }
            if (recognized.哺乳动物抗性.size === 0 && nameRes.哺乳动物抗性) {
                nameRes.哺乳动物抗性.forEach(v => recognized.哺乳动物抗性.add(v));
            }

            // 4.3 合并启动子 (如果内容未找到)
            if (recognized.启动子.size === 0 && nameRes.启动子) {
                nameRes.启动子.forEach(v => recognized.启动子.add(v));
            }

            // 4.4 合并标签 (内容识别较弱，通常合并)
            if (nameRes.蛋白标签) nameRes.蛋白标签.forEach(v => recognized.蛋白标签.add(v));
            if (nameRes.荧光蛋白) nameRes.荧光蛋白.forEach(v => recognized.荧光蛋白.add(v));

            // 4.5 合并插入类型
            if (nameRes.插入类型 && nameRes.插入类型.length > 0) {
                // 如果内容已经识别出 shRNA/miRNA，则不覆盖
                // 如果内容为空，或者内容是 "ORF" 而名字是更具体的，可以合并
                nameRes.插入类型.forEach(v => recognized.插入类型.add(v));
            }

            // 4.6 合并功能和物种
            if (nameRes.功能) nameRes.功能.forEach(v => recognized.功能.add(v));
            if (nameRes.物种) nameRes.物种.forEach(v => recognized.物种.add(v));
        }

        // 4.7 基于载体类型的强制推断 (Content-based Inference)
        const detectedVectors = Array.from(recognized.载体类型);
        detectedVectors.forEach(vec => {
            // pCDH Inference
            if (vec === 'pCDH') {
                if (recognized.大肠杆菌抗性.size === 0) recognized.大肠杆菌抗性.add('Ampicillin');
                if (recognized.哺乳动物抗性.size === 0) recognized.哺乳动物抗性.add('Puromycin');
                // If it's pCDH and no specific insert type found, it's likely for cDNA/ORF
                if (recognized.插入类型.size === 0 && !recognized.功能.has('空载体')) {
                    recognized.插入类型.add('ORF/基因序列');
                }
            }
            // pVALIUM20 Inference
            if (vec === 'pVALIUM20' || vec === 'pVALIUM') {
                if (recognized.启动子.size === 0) recognized.启动子.add('UAS');
                if (recognized.插入类型.size === 0) recognized.插入类型.add('shRNA');
                if (recognized.大肠杆菌抗性.size === 0) recognized.大肠杆菌抗性.add('Ampicillin');
                if (recognized.功能.size === 0) recognized.功能.add('RNAi敲降');
            }
            // pLKO Inference
            if (vec === 'pLKO') {
                // Only infer shRNA if miRNA is NOT present (avoid conflict)
                if (recognized.插入类型.size === 0 && !recognized.插入类型.has('miRNA')) {
                    recognized.插入类型.add('shRNA');
                }
                if (recognized.大肠杆菌抗性.size === 0) recognized.大肠杆菌抗性.add('Ampicillin');
                if (recognized.哺乳动物抗性.size === 0) recognized.哺乳动物抗性.add('Puromycin');
                if (recognized.功能.size === 0) recognized.功能.add('RNAi敲降');
            }
            // pcDNA Inference
            if (vec === 'pcDNA3' || vec === 'pcDNA3.1' || vec === 'pcDNA') {
                 if (recognized.启动子.size === 0) recognized.启动子.add('CMV');
                 if (recognized.大肠杆菌抗性.size === 0) recognized.大肠杆菌抗性.add('Ampicillin');
                 if (recognized.哺乳动物抗性.size === 0) recognized.哺乳动物抗性.add('Neomycin/G418');
            }
        });
        
        // 5. 标准化
        Object.keys(recognized).forEach(key => {
            if (recognized[key] instanceof Set) {
                window.Recognition.normalizeSet(recognized[key]);
            }
        });

        // 清理 (移除冗余)
        // 如: 有 EGFP 则移除 GFP
        if (recognized.荧光蛋白.has('EGFP')) recognized.荧光蛋白.delete('GFP');
        if (recognized.蛋白标签.has('3xFlag')) recognized.蛋白标签.delete('Flag');
        if (recognized.蛋白标签.has('3xHA')) recognized.蛋白标签.delete('HA');
        if (recognized.蛋白标签.has('6xHis')) recognized.蛋白标签.delete('His');

        return {
            文件名: name,
            载体类型: Array.from(recognized.载体类型),
            靶基因: Array.from(recognized.靶基因),
            大肠杆菌抗性: Array.from(recognized.大肠杆菌抗性),
            哺乳动物抗性: Array.from(recognized.哺乳动物抗性),
            插入类型: Array.from(recognized.插入类型),
            蛋白标签: Array.from(recognized.蛋白标签),
            荧光蛋白: Array.from(recognized.荧光蛋白),
            启动子: Array.from(recognized.启动子),
            功能: Array.from(recognized.功能),
            物种: Array.from(recognized.物种),
            描述: "" 
        };
    }
};
