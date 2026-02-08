/**
 * 识别引擎与规则加载
 */
window.Recognition = {
    // --- 8. UniProt 增强 ---
    enhanceWithUniProt: async (plasmid) => {
        // 确保 Service 已加载
        if (!window.UniProtService || !plasmid) return plasmid;
        
        // 检查是否有靶基因且未手动填写 UniProtID
        const targetGene = Array.isArray(plasmid.靶基因) ? plasmid.靶基因[0] : plasmid.靶基因;
        if (targetGene && !plasmid.uniprotId) {
            try {
                if (window.Utils) window.Utils.log(`[UniProt] 正在为 ${targetGene} 查询蛋白信息...`);
                const result = await window.UniProtService.search(targetGene, { limit: 1 });
                
                if (result && result.results && result.results.length > 0) {
                    const bestMatch = result.results[0];
                    if (window.Utils) window.Utils.log(`[UniProt] 命中: ${bestMatch.name} (${bestMatch.uniprotId})`);
                    
                    // 返回增强后的对象 (不修改原对象)
                    const enhanced = { ...plasmid };
                    
                    enhanced.uniprotId = bestMatch.uniprotId;
                    enhanced.蛋白名称 = bestMatch.name;
                    enhanced.蛋白功能 = bestMatch.function;
                    enhanced.分子量 = bestMatch.mass;
                    enhanced.蛋白序列 = bestMatch.sequence;
                    
                    return enhanced;
                }
            } catch (e) {
                console.warn('[UniProt] Auto-enhancement failed:', e);
            }
        }
        return plasmid;
    },

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
        const fields = ['靶基因', '大肠杆菌抗性', '哺乳动物抗性', '物种', '插入类型', '载体类型'];
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
        'pLKO.1':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pLKO':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pCDH':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pcDNA3.1': { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pcDNA3':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Neomycin/G418'] },
        'pUAST':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pAc5.1':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pAc5':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pET-28a':  { 大肠杆菌抗性: ['Kanamycin'], 哺乳动物抗性: [] },
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
        'pmBaoJin': { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pTRE':     { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pVALIUM':  { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pVALIUM20':{ 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pLV':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'Lenti':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'lentiCRISPR': { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: ['Puromycin'] },
        'pHA':      { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pMD2.G':   { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'pSpCas9':  { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] },
        'PX458':    { 大肠杆菌抗性: ['Ampicillin'], 哺乳动物抗性: [] }
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
        'pmBaoJin': '哺乳动物',
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
        'pTRE': '哺乳动物',
        'pLenti': '哺乳动物',
        'Lenti': '哺乳动物',
        'psPAX2': '哺乳动物',
        'pMD2.G': '哺乳动物',
        'pMD2': '哺乳动物',
        'pSpCas9': '哺乳动物',
        'PX458': '哺乳动物'
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
        'pET-28a': 'T7',
        'pET': 'T7',
        'pGL3': 'SV40',
        'pVALIUM20': 'UAS',
        'pmBaoJin': 'CMV',
        'pLenti': 'CMV',
        'Lenti': 'CMV',
        'lentiCRISPR': 'EF1a, U6',
        'psPAX2': 'CMV',
        'pMD2': 'CMV',
        'pMD2.G': 'CMV',
        'pSpCas9': 'CMV, U6',
        'PX458': 'CMV, U6',
        'pTet-On': 'TRE',
        'pTeton': 'TRE',
        'miniP': 'miniP'
    },

    COMMON_GENES: {
        'TP53': '人', 'ACTB': '人',
        'Trp53': '小鼠', 'Actb': '小鼠',
        'Tia1': '小鼠', 'TIAL1': '人',
        'poxn': '果蝇', 'poxm': '果蝇',
        'Bacc': '果蝇', 'Rhau': '人',
        'Egr': '人', 'sd': '果蝇', 'Sd': '果蝇'
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
        const t = (path) => window.I18n ? window.I18n.t(path) : path;
        const parts = [];
        
        const getFirst = (field) => {
            const val = recognized[field];
            if (!val) return null;
            if (val instanceof Set) return Array.from(val)[0];
            if (Array.isArray(val)) return val[0];
            return val;
        };

        const getAll = (field) => {
            const val = recognized[field];
            if (!val) return [];
            if (val instanceof Set) return Array.from(val);
            if (Array.isArray(val)) return val;
            return [val];
        };

        const carrier = getFirst('载体类型');
        if (carrier) parts.push(carrier);

        const func = getFirst('功能');
        if (func) parts.push(func);

        const targets = getAll('靶基因');
        if (targets.length) parts.push('靶:' + targets.join(','));

        const tags = getAll('蛋白标签');
        if (tags.length) parts.push(t('gen_0178') + tags.join(','));

        const promoter = getFirst('启动子');
        if (promoter) parts.push(t('gen_0186') + promoter);

        const res = getFirst('哺乳动物抗性');
        if (res) parts.push('抗:' + res);

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
        
        // Carriers
        'pteton': 'pTet-On', 'teton': 'pTet-On', 'ptet-on': 'pTet-On',
        'pmbaojin': 'pmBaoJin',
        'plko.1': 'pLKO.1', 'plko': 'pLKO.1',
        'pac5.1': 'pAc5.1', 'pac5': 'pAc5.1',
        'pcdna3.1': 'pcDNA3.1', 'pcdna3': 'pcDNA3.1',
        'pet-28a': 'pET-28a', 'pet28a': 'pET-28a',
        'pspcas9': 'pSpCas9', 'px458': 'pSpCas9',
        'pspax2': 'psPAX2', 'pmd2.g': 'pMD2.G',
        
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
        'nls': 'NLS', '2xnls': '2xNLS', 'deltanls': 'deltaNLS',
        'v5': 'V5', 'gst': 'GST', 'gfp': 'EGFP', 'egfp': 'EGFP',
        'baojin': 'Baojin (GFP variant)', 'vc155': 'VC155', 'vn173': 'VN173',
        'cherry': 'mCherry', 'mcherry': 'mCherry', 'rfp': 'RFP'
    },

    normalizeSet: (set) => {
        if (!set || !(set instanceof Set)) return;
        const originalArray = Array.from(set);
        set.clear();
        originalArray.forEach(val => {
            if (!val) return;
            const lower = val.toLowerCase().trim();
            if (window.Recognition.NORMALIZE_MAP[lower]) {
                set.add(window.Recognition.NORMALIZE_MAP[lower]);
            } else {
                set.add(val);
            }
        });
        
        // 执行冗余清理 (针对标签等)
        window.Recognition.cleanRedundantTags(set);
    },

    /**
     * 清理 Set 中的冗余标签 (如有了 3xHA 就不要 HA)
     */
    cleanRedundantTags: (set) => {
        if (!set || !(set instanceof Set)) return;
        
        const tags = Array.from(set);
        
        // 荧光蛋白冗余
        if (set.has('EGFP') && set.has('GFP')) set.delete('GFP');
        
        // 蛋白标签冗余
        const redundantPairs = [
            ['3xFlag', 'Flag'],
            ['3xHA', 'HA'],
            ['6xHis', 'His'],
            ['6xMyc', 'Myc'],
            ['2xNLS', 'NLS'],
            ['3×FLAG', 'Flag'], // 处理特殊字符
            ['3×HA', 'HA'],
            ['EGFP', 'GFP'],
            ['mCherry', 'RFP'],
            ['Flag', 'Flag-tag'],
            ['HA', 'HA-tag'],
            ['His', 'His-tag'],
            ['Flag V5', 'Flag'],
            ['Flag V5', 'V5'],
            ['3xFlag', 'Flag-tag'],
            ['3xHA', 'HA-tag'],
            ['6xHis', 'His-tag']
        ];
        
        redundantPairs.forEach(([strong, weak]) => {
            if (set.has(strong) && set.has(weak)) {
                set.delete(weak);
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
                if (!val || val.length < 3) return; // Ignore very short features
                const valLower = val.toLowerCase();
                const escapedVal = window.Utils.escapeRegExp(valLower);
                // 尝试精确匹配，增加单词边界检查
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
        // [已移除] 用户反馈根据路径名推测载体类型极不准确，故移除此处的正则猜测逻辑
        /*
        // 如果没有识别出载体类型，尝试提取常见载体格式
        if (recognized.载体类型.size === 0) {
            const vectorPatterns = [
                /\bpSpCas9\b/gi,             // pSpCas9
                /\blentiCRISPR\b/gi,         // lentiCRISPR
                /\bPX\d+\b/gi,               // PX458
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
                /\bpUAST\w*\b/gi,            // pUAST
                /\bp[A-Z][a-zA-Z0-9_-]+\b/g, // Standard pVec (e.g., pUC19) - Fallback
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
        */

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
            '3xflag', 'flag', '3xha', 'ha', 'myc', '6xhis', 'his', '6xmyc', 'nls', 'vc155', 'vn173', 'baojin', 'pmbaojin', 'teton', 'pteton',
            'link', 'polya', 'ires', 't2a', 'p2a', 'neo', 'puro', 'amp', 'kan', 'zeo', 'hyg',
            'trc', 'human', 'mouse', 'rat', 'ko', 'oe', 'kd', 'ki', 'crispr', 'cas9', 'cas',
            'lenti', 'aav', 'retro', 'adenoviral', 'virus', 'viral',
            'pspax2', 'pmd2', 'pmd2g', 'cas9', 'pspcas9', 'px458', 'px459', 'pac5', 'pac5.1', 'pac51',
            'shrna', 'sgrna', 'grna', 'guide', 'mir', 'mirna', 'sirna', 'hairpin', 
            'scramble', 'scrambled', 'negative', 'ctrl', 
            'tagged', 'fused', 'fusion', 'internal', 'external', 'fragment', 'domain',
            'promoter', 'enhancer', 'terminator', 'utr', 'cds', 'orf',
            'mutation', 'mutant', 'deletion', 'insertion', 'substitution',
            'cmv', 'ef1a', 'sv40', 'h1', 'u6', 'ubc', 'pgk', 'cag',
            'on', 'tet', 'off', 'dox', 'v1', 'v2', 'v3', 'v4', 'v5', 'trc', 'dna', 'gb', 'fasta',
            'new', 'old', 'modified', 'seq', 'sequence', 'from', 'made', 'by',
            'kanr', 'ampr', 'puror', 'hygr', 'neor', 'bsdr', 'zeor', 'puro', 'amp', 'kan', 'neo', 'hyg', 'bsd', 'zeo',
            'psPAX2', 'pMD2.G', 'pSpCas9', 'Ac5'
        ]);

        parts.forEach(part => {
            const partLower = part.toLowerCase();
            const partTrimmed = part.trim();
            
            // 1. 过滤太短的
            if (partTrimmed.length <= 2) return;

            // 2. 过滤已识别特征
            let isKnown = false;
            if (knownValues.has(partLower)) isKnown = true;
            
            // 3. 过滤干扰词
            if (noiseWords.has(partLower)) isKnown = true;

            // 4. 过滤数字
            if (/^\d+$/.test(partTrimmed)) isKnown = true;
            
            // 5. 过滤类似 pLKO 的载体名部分
            if (/^p[a-z0-9]+$/i.test(partTrimmed)) isKnown = true;

            // 6. 过滤纯非字母字符
            if (/^[^a-z]+$/i.test(partTrimmed)) isKnown = true;

            if (!isKnown) {
                // 基因去重 (忽略大小写)
                const alreadyHas = Array.from(recognized.靶基因).some(g => g.toLowerCase() === partLower);
                if (!alreadyHas) {
                    recognized.靶基因.add(partTrimmed);
                }
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

        // Step 1.1: 特殊载体基因推断 (Vector Specific Genes)
        if (carrier) {
            if (carrier.includes('psPAX2')) {
                ['gag', 'pol', 'rev', 'tat'].forEach(g => recognized.靶基因.add(g));
            } else if (carrier.includes('pMD2.G')) {
                recognized.靶基因.add('VSV-G');
            } else if (carrier.includes('pSpCas9') || carrier.includes('PX458')) {
                recognized.靶基因.add('SpCas9');
            } else if (carrier.includes('lentiCRISPR')) {
                recognized.靶基因.add('SpCas9');
            }
        }
        
        // Step 1.2: 插入类型推断 (Insert Type Inference)
        if (recognized.插入类型.size === 0) {
             // Check if it's interference/CRISPR, then DO NOT infer ORF
             const isInterference = recognized.功能.has('干扰/shRNA') || 
                                   recognized.功能.has('CRISPR/Cas9') || 
                                   recognized.功能.has('病毒包装') ||
                                   nameLower.includes('shrna') ||
                                   nameLower.includes('sgrna');
             
             if (!isInterference) {
                 if (recognized.功能.has('过表达/功能载体')) {
                     recognized.插入类型.add('ORF/基因序列');
                 } else if (genes.length > 0 && ['pCDH', 'pcDNA3', 'pcDNA3.1', 'pUAST', 'pAc5'].some(c => carrier && carrier.includes(c))) {
                     // 再次检查载体名是否包含 shRNA/CRISPR 暗示 (如 pLKO, pLenti-shRNA)
                     const carrierLower = carrier ? carrier.toLowerCase() : '';
                     if (!carrierLower.includes('plko') && !carrierLower.includes('shrna') && !carrierLower.includes('crispr')) {
                         recognized.插入类型.add('ORF/基因序列');
                         if (!recognized.功能.has('干扰/shRNA') && !recognized.功能.has('CRISPR/Cas9')) {
                             recognized.功能.add('过表达/功能载体');
                         }
                         // Remove '空载体' if present
                         if (recognized.功能.has('空载体')) recognized.功能.delete('空载体');
                     }
                 }
             }
        }

        // Step 1.1: 启动子推断 (从载体)
        if (recognized.启动子.size === 0 && carrier) {
            // 针对 Tet-On 系统的特殊处理
            if (nameLower.includes('tet-on') || nameLower.includes('teton') || nameLower.includes('tre-')) {
                recognized.启动子.add('TRE');
            } else {
                for (const [vec, prom] of Object.entries(window.Recognition.VECTOR_PROMOTER_RULES || {})) {
                    if (carrier.includes(vec)) {
                        recognized.启动子.add(prom);
                    }
                }
            }
        }

        // 载体类型归一化
        const normalizedVectors = new Set();
        recognized.载体类型.forEach(v => {
            let nv = v;
            // 优先检查是否包含版本号，但在归一化时统一到基础载体名（除非数据库明确区分）
            if (/^pLKO/i.test(v)) nv = 'pLKO';
            else if (/^pAc5/i.test(v)) nv = 'pAc5';
            else if (/^pcDNA3/i.test(v)) nv = 'pcDNA3';
            else if (/^pUAST/i.test(v)) nv = 'pUAST';
            else if (/^pSpCas9/i.test(v)) nv = 'pSpCas9';
            else if (/^PX\d+/i.test(v)) nv = 'pSpCas9';
            else if (/^GV/i.test(v)) nv = 'GV141';
            normalizedVectors.add(nv);
        });

        // 针对特定的双载体或辅助载体系统
        if (normalizedVectors.has('GV141') && normalizedVectors.has('pUAST')) {
            normalizedVectors.delete('pUAST');
        }
        
        // 过滤掉误报为载体类型的短词或已知非载体词
        const finalVectors = new Set();
        normalizedVectors.forEach(v => {
            const vLower = v.toLowerCase();
            if (vLower === 'pa' || vLower === 'pc' || vLower === 'pt') return; // Too short/ambiguous
            finalVectors.add(v);
        });
        recognized.载体类型 = finalVectors;
        
        const updatedCarrier = Array.from(recognized.载体类型)[0];

        // Step 2: 抗性推断
        if (updatedCarrier) {
            for (const [cName, res] of Object.entries(window.Recognition.RESISTANCE_INFERENCE)) {
                if (updatedCarrier.includes(cName)) {
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
        if (genes.length > 0) {
            // Check if carrier already defined species
            const carrierSpecies = updatedCarrier ? window.Recognition.VECTOR_SPECIES_RULES[updatedCarrier] : null;
            
            if (!carrierSpecies) {
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
            } else {
                recognized.物种.add(carrierSpecies);
            }
        }

        // Step 4: Final Cleanup of Target Genes (Remove Noise & Carriers)
        const finalGenes = new Set();
        recognized.靶基因.forEach(g => {
            const gl = g.toLowerCase();
            const isNoise = [
                'pspax2', 'pmd2', 'pmd2g', 'pspcas9', 'px458', 'px459', 'lenti', 'aav', 'vector', 'plasmid',
                'puro', 'amp', 'kan', 'neo', 'hyg', 'bsd', 'zeo', 'ampr', 'kanr', 'puror', 'neor',
                'cmv', 'ef1a', 'u6', 'h1', 'sv40', 'pgk', 'cag', 'tre', 'uas', 'ac5', 'copia',
                '3xflag', '3xha', '6xhis', '6xmyc', 'nls', 'vc155', 'vn173', 'baojin', 'teton',
                'scramble', 'ctrl', 'negative', 'blank', 'mock', 'empty', 'backbone',
                'luc', 'luciferase', 'gfp', 'egfp', 'mcherry', 'rfp', 'yfp', 'bfp', 'dsred',
                'pcDNA3.1', 'pcDNA3', 'pCDH', 'pLKO.1', 'pLKO', 'pET-28a', 'pET', 'pUAST', 'pAc5.1', 'pAc5'
            ].some(noise => gl.includes(noise.toLowerCase()));
            
            if (!isNoise && g.length > 1) {
                finalGenes.add(g);
            }
        });
        recognized.靶基因 = finalGenes;

        // Step 3.5: 标准化与清理 (Normalization & Cleanup)
        Object.keys(recognized).forEach(key => {
            if (recognized[key] instanceof Set) {
                window.Recognition.normalizeSet(recognized[key]);
            }
        });

        // 清理冗余: Fluorescent Protein shouldn't be in Tags usually
        if (recognized.荧光蛋白.size > 0) {
            recognized.荧光蛋白.forEach(fp => {
                if (recognized.蛋白标签.has(fp)) {
                    recognized.蛋白标签.delete(fp);
                }
            });
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
            文件名: (typeof recognized.文件名 === 'string' && recognized.文件名.length > 1) ? recognized.文件名 : fullName,
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
            /\bEGFP\b/gi, /\bGFP\b/gi, /\bmCherry\b/gi, /\bFlag\b/gi, /\bHA\b/gi, 
            /\bMyc\b/gi, /\bHis\b/gi, /\bV5\b/gi, /\bGST\b/gi, /\bBFP\b/gi, /\bYFP\b/gi,
            /\b3xFlag\b/gi, /\b3xHA\b/gi, /\b6xHis\b/gi, /\b6xMyc\b/gi, /\bHalo\b/gi, /\bSNAP\b/gi
        ];
        tagRules.forEach(regex => {
            const matches = metadata.matchAll(regex);
            for (const match of matches) {
                const val = match[0];
                if (/GFP|Cherry|Red|Cyan|YFP|BFP/i.test(val)) {
                    recognized.荧光蛋白.add(val);
                } else {
                    recognized.蛋白标签.add(val);
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

                    const label = extractValue('label') || extractValue('note') || extractValue('product') || extractValue('gene');
                    if (label) {
                        // 如果是常见的抗性、启动子等，归类
                        const lowerLabel = label.toLowerCase();
                        
                        // 抗性
                        if (lowerLabel.includes('amp')) recognized.大肠杆菌抗性.add('Ampicillin');
                        if (lowerLabel.includes('kan')) recognized.大肠杆菌抗性.add('Kanamycin');
                        if (lowerLabel.includes('puro')) recognized.哺乳动物抗性.add('Puromycin');
                        if (lowerLabel.includes('neo') || lowerLabel.includes('g418')) recognized.哺乳动物抗性.add('Neomycin/G418');
                        if (lowerLabel.includes('hygro')) recognized.哺乳动物抗性.add('Hygromycin');
                        if (lowerLabel.includes('bsd') || lowerLabel.includes('blasticidin')) recognized.哺乳动物抗性.add('Blasticidin');
                        
                        // 启动子
                        if (lowerLabel === 'cmv' || lowerLabel.includes('cmv promoter')) recognized.启动子.add('CMV');
                        if (lowerLabel === 'ef1a' || lowerLabel.includes('ef-1a')) recognized.启动子.add('EF1a');
                        if (lowerLabel === 'u6' || lowerLabel.includes('u6 promoter')) recognized.启动子.add('U6');
                        
                        // 标签与荧光
                        if (lowerLabel.includes('flag')) recognized.蛋白标签.add('Flag');
                        if (lowerLabel.includes('ha')) recognized.蛋白标签.add('HA');
                        if (lowerLabel.includes('gfp') || lowerLabel.includes('egfp')) recognized.荧光蛋白.add('EGFP');
                        if (lowerLabel.includes('mcherry')) recognized.荧光蛋白.add('mCherry');

                        // 靶基因识别：如果 label 看起来像是一个基因名（非通用特征）
                        const commonFeatures = ['origin', 'primer', 'promoter', 'cds', 'polya', 'terminator', 'resistance', 'tag', 'marker'];
                        const isCommon = commonFeatures.some(f => lowerLabel.includes(f));
                        if (!isCommon && label.length > 1 && label.length < 20 && /^[a-z0-9\-_]+$/i.test(label)) {
                            // 排除常见的长度和字符模式
                            if (!['pcdh', 'plko', 'pcdna3', 'pet', 'pgex'].some(v => lowerLabel.includes(v))) {
                                recognized.靶基因.add(label);
                            }
                        }
                    }

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
/**
 * 基于训练数据的智能识别模块
 */
window.RecognitionTrainingData = {
    carriers: ["BRDV2", "BRDV2A", "CRISPR-PLV", "CRISPRv2", "CRISPRv2-blast", "SpCas9-HF1-2A-GFP", "eSpCas9(1.1)", "lentiCRISPR v2", "lentiCRISPR v3", "lentiCas9-Blast", "lentiCas9-GFP", "lentiGuide-GFP", "lentiGuide-Neo", "lentiGuide-Puro", "mCherry-C1", "mCherry-N1", "mCherry-N2", "p3xFLAG-CMV-7", "p3xFLAG-CMV-8", "p3xFLAG-CMV-9", "p426ADH", "p426GAL", "p426GPD", "p426TEF", "pAAVS1-Nst-CRISPR", "pAAVS1-TALEN-L", "pAAVS1-TALEN-R", "pACYC184", "pBAD/Myc-His A", "pBAD/Myc-His C", "pBAD18", "pBAD24", "pBAD33", "pBR327", "pBabe-blast", "pBabe-neo", "pBabe-puro", "pBacPAK8", "pBacPAK9", "pBluescript II KS(+)", "pBluescript II SK(+)", "pCAG-Cre", "pCAG-Cre-ERT2", "pCAG-Flp", "pCDH-CMV-GFP", "pCDH-CMV-RFP", "pCDH-EF1a-puro", "pCDH-MSCV", "pCDH-U6", "pCI", "pCI-neo", "pCMV-C-Flag", "pCMV-C-HA", "pCMV-C-Myc", "pCMV-C-V5", "pCMV-Cre", "pCMV-Cre-IRES", "pCMV-Flp", "pCMV-N-Flag", "pCMV-N-HA", "pCMV-N-Myc", "pCMV-N-V5", "pCMV-Tag2B", "pCMV-Tag3A", "pCMV-Tag5A", "pCMV-VSVG", "pCOLA", "pCOLADuet-1", "pCX-EGFP", "pCX-blast", "pCX-puro", "pCerulean-N1", "pDsRed-Express2", "pDsRed-Monomer-N1", "pECFP-N1", "pEGFP-1", "pEGFP-2", "pEGFP-C1", "pEGFP-C2", "pEGFP-C3", "pEGFP-N1", "pEGFP-N2", "pEGFP-N3", "pESC-HIS", "pESC-LEU", "pESC-TRP", "pESC-URA", "pET-21a", "pET-21a(+)", "pET-22b", "pET-22b(+)", "pET-23a", "pET-23a(+)", "pET-24a", "pET-24a(+)", "pET-25b", "pET-25b(+)", "pET-26b", "pET-26b(+)", "pET-27b", "pET-28a", "pET-28a(+)", "pET-29a", "pET-29a(+)", "pET-30a", "pET-30a(+)", "pET-31b", "pET-31b(+)", "pET-32a", "pET-32a(+)", "pET-33b", "pET-33b(+)", "pET-35b", "pET-35b(+)", "pET-36c", "pET-36c(+)", "pEYFP-N1", "pFRT-amp", "pFRT-neo", "pFUGW", "pFUW-M2", "pFUW-TetOn", "pFastBac1", "pFastBacDual", "pFastBacHT-A", "pFastBacHT-B", "pGEM-3Z", "pGEM-4Z", "pGEM-T", "pGEM-T Easy", "pGEX-4T-1", "pGEX-4T-2", "pGEX-4T-3", "pGEX-5X-1", "pGEX-6P-1", "pGEX-6P-2", "pGL3-Basic", "pGL3-Control", "pGL3-Enhancer", "pGL3-Promoter", "pGL4.10[luc2]", "pGL4.11[luc2]", "pGL4.12[luc2]", "pGL4.13[luc2]", "pGL4.17[luc2]", "pGL4.23[luc2]", "pHAGE-CMV-GFP", "pHSF1A", "pHSF1B", "pIB/V5-DEST", "pIB/V5-His", "pIRES", "pIRES2-EGFP", "pIRES2-mCherry", "pIZ/V5-His", "pLKO.1-GFP", "pLKO.1-Neo", "pLKO.1-blast", "pLKO.1-puro", "pLL3.7", "pLV-hU6-shRNA", "pLV-tdTomato", "pLVCT", "pLVSD", "pLVTHM", "pLVTHM-shRNA", "pLVX-AcGFP", "pLVX-EF1a-GFP", "pLVX-EF1a-mCherry", "pLVX-EF1a-puro", "pLVX-IRES-ZsGreen", "pLVX-IRES-mCherry", "pLVX-IRES-puro", "pLVX-Neo", "pLVX-Puro", "pLentiLox3.7", "pLoxP-Neo", "pLoxP-blast", "pLoxP-puro", "pLuc", "pLuciferase", "pMAL-c2X", "pMAL-c5X", "pMAL-p2X", "pMAL-p5X", "pMD2.8", "pMD2.G", "pMD2.VSVG", "pMDL2", "pMDLg/pRRE", "pMIB/V5-DEST", "pMIB/V5-His", "pMSCV-blast", "pMSCV-neo", "pMSCV-puro", "pQE60", "pQE70", "pQE80L", "pQE81L", "pQE82L", "pQED", "pQEI", "pRL-CMV", "pRL-SV40", "pRL-TK", "pRS313", "pRS314", "pRS315", "pRS316", "pRS423", "pRS424", "pRS425", "pRS426", "pRSV-Rev", "pRetro-SUPER", "pSC101", "pSIREN-RetroQ", "pSIREN-RetroQ-Puro", "pSIREN-shRNA", "pSMPUW-CMV", "pSMPUW-EF1a", "pSMPUW-GFP", "pSpCas9(BB)-2A-GFP", "pSpCas9(BB)-2A-Puro", "pSpCas9n(BB)-2A-GFP", "pSpCas9n(BB)-2A-Puro", "pSuper.GFP", "pSuper.neo", "pSuper.puro", "pTOPO-Blunt", "pTOPO-T", "pTOPO-TA", "pTriEx-1", "pTriEx-1.1", "pTriEx-2.1", "pTriEx-3.1", "pUC18", "pUC19", "pUC57", "pUC57-Kan", "pWPI", "pX330", "pX330A-1", "pX330S-2", "pX330S-3", "pX333", "pX335", "pX335A-1", "pYC12", "pYC2.1", "pYC6", "pYD1", "pYES2", "pYES2.1", "pYES3", "pYES6", "pcDNA3", "pcDNA3.1", "pcDNA3.1(+)", "pcDNA3.1(-)", "psPAX2", "px330", "px330A-1", "px330A-2", "px333", "px335", "px335A-1", "spCas9", "spCas9-GFP", "spCas9-mCherry", "tdTomato-C1", "tdTomato-N1"],
    genes: ["ABL1", "ACVR1", "ACVR2A", "ACVR2B", "ADE2", "ADH1", "AKT1", "APC", "ATM", "ATR", "AXIN1", "AXIN2", "BAD", "BCL2", "BCL2L1", "BCL2L2", "BMPR2", "BRAF", "BRCA1", "BRCA2", "Bcl2", "Brca1", "Brca2", "CCND1", "CCND2", "CCND3", "CCNE1", "CCNE2", "CDK1", "CDK2", "CDK4", "CDK6", "CDKN1A", "CDKN1B", "CDKN2A", "CDKN2B", "CHEK1", "CHEK2", "CTLA4", "Cdk4", "Cdkn1a", "Ctnnb1", "DNMT1", "DNMT3A", "DNMT3B", "E2F1", "E2F2", "E2F3", "EGFR", "EPAS1", "ERBB2", "ERBB3", "FGFR1", "FGFR2", "FOS", "GAL1", "GAL4", "GAL7", "GAL80", "GSK3B", "Gsk3b", "HDAC1", "HDAC10", "HDAC2", "HDAC3", "HDAC4", "HDAC5", "HDAC6", "HDAC7", "HDAC8", "HDAC9", "HES1", "HEY1", "HIF1A", "HIS3", "IFNG", "IL10", "IL2", "IL6", "JAK1", "JAK2", "JAK3", "JUN", "Jun", "KLF4", "KRAS", "Klf4", "Kras", "LAG3", "LEU2", "LIN28A", "LYS2", "MAX", "MCL1", "MDM2", "MDM4", "MLH1", "MSH2", "MSH6", "MTOR", "MYC", "Mapk3", "Mapk8", "Mcl1", "Mtor", "Myc", "NANOG", "NOTCH1", "NOTCH2", "NOTCH3", "Nanog", "Notch1", "Oct4", "PALB2", "PDCD1", "PDGFRA", "PDGFRB", "PDL1", "PDL2", "PGK1", "PIK3CA", "PMS2", "POU5F1", "PTEN", "Pten", "RAD51", "RAD52", "RAD54L", "RAGA", "RAGB", "RB1", "RHEB", "RICTOR", "RPTOR", "Rb1", "Rptor", "SIRT1", "SIRT2", "SIRT3", "SIRT4", "SIRT5", "SIRT6", "SIRT7", "SMAD2", "SMAD3", "SMAD4", "SMAD5", "SMAD7", "SOX2", "SRC", "STAT1", "STAT3", "STAT5A", "STAT5B", "STAT6", "Sox2", "TEF1", "TET1", "TET2", "TET3", "TGFB1", "TGFB2", "TGFBR1", "TGFBR2", "TIGIT", "TIM3", "TP53", "TRP1", "Trp53", "URA3", "VEGFA", "VEGFB", "VEGFC", "WEE1", "WNT1", "WNT3A", "WNT5A", "Wnt3a"],
    
    carrierResistance: {
        'BRDV2': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'BRDV2A': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Neo"],},
        'CRISPR-PLV': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Puro"],},
        'CRISPRv2': {'大肠杆菌抗性': ["Carb", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'CRISPRv2-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Rif"],'哺乳动物抗性': ["Neo", "Puro"],},
        'SpCas9-HF1-2A-GFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif"],'哺乳动物抗性': ["Blast"],},
        'eSpCas9(1.1)': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'lentiCRISPR v2': {'大肠杆菌抗性': ["Amp", "Rif", "Tet"],},
        'lentiCRISPR v3': {'大肠杆菌抗性': ["Carb", "Spec"],},
        'lentiCas9-Blast': {'大肠杆菌抗性': ["Rif", "Spec", "Strep"],'哺乳动物抗性': ["Hyg"],},
        'lentiCas9-GFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'lentiGuide-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'lentiGuide-Neo': {'大肠杆菌抗性': ["Amp", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'lentiGuide-Puro': {'大肠杆菌抗性': ["Amp", "Spec", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'mCherry-C1': {'大肠杆菌抗性': ["Carb", "Cm", "Kan"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro"],},
        'mCherry-N1': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'mCherry-N2': {'大肠杆菌抗性': ["Kan"],},
        'p3xFLAG-CMV-7': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Neo"],},
        'p3xFLAG-CMV-8': {'大肠杆菌抗性': ["Amp"],},
        'p3xFLAG-CMV-9': {'大肠杆菌抗性': ["Carb", "Kan", "Tet"],'哺乳动物抗性': ["Puro"],},
        'p426ADH': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'p426GAL': {'大肠杆菌抗性': ["Carb", "Kan", "Tet"],},
        'p426GPD': {'大肠杆菌抗性': ["Kan", "Spec", "Strep"],},
        'p426TEF': {'大肠杆菌抗性': ["Rif", "Strep"],},
        'pAAVS1-Nst-CRISPR': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pAAVS1-TALEN-L': {'大肠杆菌抗性': ["Tet"],},
        'pAAVS1-TALEN-R': {'大肠杆菌抗性': ["Tet"],},
        'pACYC184': {'大肠杆菌抗性': ["Amp", "Carb", "Spec"],},
        'pBAD/Myc-His A': {'大肠杆菌抗性': ["Amp", "Carb"],'哺乳动物抗性': ["Blast"],},
        'pBAD/Myc-His C': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pBAD18': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'pBAD24': {'大肠杆菌抗性': ["Amp", "Rif", "Spec", "Strep", "Tet"],},
        'pBAD33': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pBR327': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Strep", "Tet"],},
        'pBabe-blast': {'大肠杆菌抗性': ["Amp", "Spec"],},
        'pBabe-neo': {'大肠杆菌抗性': ["Cm"],},
        'pBabe-puro': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif"],'哺乳动物抗性': ["Hyg", "Neo"],},
        'pBacPAK8': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Strep"],},
        'pBacPAK9': {'大肠杆菌抗性': ["Carb", "Cm", "Spec"],},
        'pBluescript II KS(+)': {'大肠杆菌抗性': ["Carb", "Kan", "Strep", "Tet"],},
        'pBluescript II SK(+)': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pCAG-Cre': {'大肠杆菌抗性': ["Amp", "Cm", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pCAG-Cre-ERT2': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Blast"],},
        'pCAG-Flp': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Puro"],},
        'pCDH-CMV-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'pCDH-CMV-RFP': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pCDH-EF1a-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pCDH-MSCV': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Zeo"],},
        'pCDH-U6': {'大肠杆菌抗性': ["Amp", "Cm", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCI': {'大肠杆菌抗性': ["Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pCI-neo': {'大肠杆菌抗性': ["Cm", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pCMV-C-Flag': {'大肠杆菌抗性': ["Tet"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-HA': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-Myc': {'大肠杆菌抗性': ["Strep"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-V5': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'pCMV-Cre': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg"],},
        'pCMV-Cre-IRES': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Neo"],},
        'pCMV-Flp': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pCMV-N-Flag': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Puro"],},
        'pCMV-N-HA': {'大肠杆菌抗性': ["Kan"],},
        'pCMV-N-Myc': {'大肠杆菌抗性': ["Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pCMV-N-V5': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Blast"],},
        'pCMV-Tag2B': {'大肠杆菌抗性': ["Strep"],'哺乳动物抗性': ["Blast"],},
        'pCMV-Tag3A': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pCMV-Tag5A': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pCMV-VSVG': {'大肠杆菌抗性': ["Amp", "Cm", "Kan", "Tet"],'哺乳动物抗性': ["Hyg", "Neo", "Puro"],},
        'pCOLA': {'大肠杆菌抗性': ["Kan"],},
        'pCOLADuet-1': {'大肠杆菌抗性': ["Carb", "Kan", "Spec", "Tet"],},
        'pCX-EGFP': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCX-blast': {'大肠杆菌抗性': ["Amp", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCX-puro': {'大肠杆菌抗性': ["Amp", "Carb"],},
        'pCerulean-N1': {'大肠杆菌抗性': ["Amp", "Rif", "Spec"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pDsRed-Express2': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],},
        'pDsRed-Monomer-N1': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Blast"],},
        'pECFP-N1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Puro"],},
        'pEGFP-1': {'大肠杆菌抗性': ["Amp"],},
        'pEGFP-2': {'大肠杆菌抗性': ["Amp", "Cm"],},
        'pEGFP-C1': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pEGFP-C2': {'大肠杆菌抗性': ["Strep"],},
        'pEGFP-C3': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],},
        'pEGFP-N1': {'大肠杆菌抗性': ["Amp", "Carb", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pEGFP-N2': {'大肠杆菌抗性': ["Cm", "Rif", "Tet"],},
        'pEGFP-N3': {'大肠杆菌抗性': ["Cm", "Spec"],},
        'pESC-HIS': {'大肠杆菌抗性': ["Amp", "Cm"],},
        'pESC-LEU': {'大肠杆菌抗性': ["Amp", "Cm", "Spec"],},
        'pESC-TRP': {'大肠杆菌抗性': ["Amp"],},
        'pESC-URA': {'大肠杆菌抗性': ["Carb", "Tet"],},
        'pET-21a': {'大肠杆菌抗性': ["Carb", "Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'pET-21a(+)': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Neo", "Puro"],},
        'pET-22b': {'大肠杆菌抗性': ["Rif", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'pET-22b(+)': {'大肠杆菌抗性': ["Carb", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pET-23a': {'大肠杆菌抗性': ["Cm", "Strep"],},
        'pET-23a(+)': {'大肠杆菌抗性': ["Rif", "Strep"],'哺乳动物抗性': ["Blast"],},
        'pET-24a': {'大肠杆菌抗性': ["Amp", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pET-24a(+)': {'大肠杆菌抗性': ["Kan", "Strep"],'哺乳动物抗性': ["Blast"],},
        'pET-25b': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Blast"],},
        'pET-25b(+)': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Hyg"],},
        'pET-26b': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Hyg"],},
        'pET-26b(+)': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Blast"],},
        'pET-27b': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Neo"],},
        'pET-28a': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pET-28a(+)': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Blast"],},
        'pET-29a': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pET-29a(+)': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pET-30a': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Zeo"],},
        'pET-30a(+)': {'大肠杆菌抗性': ["Kan"],},
        'pET-31b': {'大肠杆菌抗性': ["Spec", "Tet"],'哺乳动物抗性': ["Zeo"],},
        'pET-31b(+)': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Neo"],},
        'pET-32a': {'大肠杆菌抗性': ["Kan", "Rif"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pET-32a(+)': {'大肠杆菌抗性': ["Carb", "Rif", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pET-33b': {'大肠杆菌抗性': ["Kan"],},
        'pET-33b(+)': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pET-35b': {'大肠杆菌抗性': ["Carb", "Spec"],},
        'pET-35b(+)': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pET-36c': {'大肠杆菌抗性': ["Amp", "Rif"],'哺乳动物抗性': ["Zeo"],},
        'pET-36c(+)': {'大肠杆菌抗性': ["Cm", "Rif", "Strep"],'哺乳动物抗性': ["Neo", "Puro"],},
        'pEYFP-N1': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pFRT-amp': {'大肠杆菌抗性': ["Strep", "Tet"],},
        'pFRT-neo': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Puro"],},
        'pFUGW': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pFUW-M2': {'大肠杆菌抗性': ["Amp", "Spec", "Strep"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pFUW-TetOn': {'大肠杆菌抗性': ["Carb", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pFastBac1': {'大肠杆菌抗性': ["Cm", "Kan", "Tet"],},
        'pFastBacDual': {'大肠杆菌抗性': ["Spec", "Strep", "Tet"],},
        'pFastBacHT-A': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Tet"],},
        'pFastBacHT-B': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Tet"],},
        'pGEM-3Z': {'大肠杆菌抗性': ["Spec"],},
        'pGEM-4Z': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'pGEM-T': {'大肠杆菌抗性': ["Carb", "Cm", "Strep"],},
        'pGEM-T Easy': {'大肠杆菌抗性': ["Rif", "Tet"],},
        'pGEX-4T-1': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pGEX-4T-2': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Neo"],},
        'pGEX-4T-3': {'大肠杆菌抗性': ["Kan"],},
        'pGEX-5X-1': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pGEX-6P-1': {'大肠杆菌抗性': ["Carb", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'pGEX-6P-2': {'大肠杆菌抗性': ["Tet"],'哺乳动物抗性': ["Neo"],},
        'pGL3-Basic': {'大肠杆菌抗性': ["Carb", "Rif", "Strep"],},
        'pGL3-Control': {'大肠杆菌抗性': ["Strep"],},
        'pGL3-Enhancer': {'大肠杆菌抗性': ["Tet"],},
        'pGL3-Promoter': {'大肠杆菌抗性': ["Carb", "Rif", "Tet"],},
        'pGL4.10[luc2]': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pGL4.11[luc2]': {'大肠杆菌抗性': ["Amp", "Spec"],},
        'pGL4.12[luc2]': {'大肠杆菌抗性': ["Kan", "Strep"],},
        'pGL4.13[luc2]': {'大肠杆菌抗性': ["Kan", "Rif"],},
        'pGL4.17[luc2]': {'大肠杆菌抗性': ["Carb"],},
        'pGL4.23[luc2]': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],},
        'pHAGE-CMV-GFP': {'大肠杆菌抗性': ["Amp", "Kan", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Zeo"],},
        'pHSF1A': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pHSF1B': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pIB/V5-DEST': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],},
        'pIB/V5-His': {'大肠杆菌抗性': ["Carb", "Kan"],},
        'pIRES': {'大肠杆菌抗性': ["Amp"],},
        'pIRES2-EGFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Spec"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pIRES2-mCherry': {'大肠杆菌抗性': ["Amp", "Strep"],},
        'pIZ/V5-His': {'大肠杆菌抗性': ["Amp", "Cm", "Strep", "Tet"],},
        'pLKO.1-GFP': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLKO.1-Neo': {'大肠杆菌抗性': ["Carb", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLKO.1-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLKO.1-puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLL3.7': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLV-hU6-shRNA': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLV-tdTomato': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pLVCT': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],'哺乳动物抗性': ["Blast"],},
        'pLVSD': {'大肠杆菌抗性': ["Amp", "Cm"],'哺乳动物抗性': ["Blast"],},
        'pLVTHM': {'大肠杆菌抗性': ["Amp", "Carb", "Rif", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLVTHM-shRNA': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLVX-AcGFP': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro"],},
        'pLVX-EF1a-GFP': {'大肠杆菌抗性': ["Amp", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pLVX-EF1a-mCherry': {'大肠杆菌抗性': ["Cm", "Rif", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pLVX-EF1a-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pLVX-IRES-ZsGreen': {'大肠杆菌抗性': ["Carb", "Cm", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pLVX-IRES-mCherry': {'大肠杆菌抗性': ["Carb", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pLVX-IRES-puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLVX-Neo': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Blast"],},
        'pLVX-Puro': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Hyg"],},
        'pLentiLox3.7': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pLoxP-Neo': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Zeo"],},
        'pLoxP-blast': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLoxP-puro': {'大肠杆菌抗性': ["Spec", "Tet"],},
        'pLuc': {'大肠杆菌抗性': ["Carb"],},
        'pLuciferase': {'大肠杆菌抗性': ["Amp", "Carb", "Spec"],},
        'pMAL-c2X': {'大肠杆菌抗性': ["Amp", "Carb", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Zeo"],},
        'pMAL-c5X': {'大肠杆菌抗性': ["Amp", "Strep"],'哺乳动物抗性': ["Neo"],},
        'pMAL-p2X': {'大肠杆菌抗性': ["Amp", "Rif", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pMAL-p5X': {'大肠杆菌抗性': ["Kan"],},
        'pMD2.8': {'大肠杆菌抗性': ["Strep", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pMD2.G': {'大肠杆菌抗性': ["Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pMD2.VSVG': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pMDL2': {'大肠杆菌抗性': ["Carb", "Kan"],'哺乳动物抗性': ["Blast", "Hyg", "Zeo"],},
        'pMDLg/pRRE': {'大肠杆菌抗性': ["Carb", "Cm", "Rif"],'哺乳动物抗性': ["Neo", "Zeo"],},
        'pMIB/V5-DEST': {'大肠杆菌抗性': ["Carb"],},
        'pMIB/V5-His': {'大肠杆菌抗性': ["Amp", "Carb", "Spec", "Tet"],},
        'pMSCV-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pMSCV-neo': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Puro"],},
        'pMSCV-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Kan"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pQE60': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Puro"],},
        'pQE70': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pQE80L': {'大肠杆菌抗性': ["Amp", "Cm", "Spec"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pQE81L': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Hyg"],},
        'pQE82L': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pQED': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Hyg"],},
        'pQEI': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pRL-CMV': {'大肠杆菌抗性': ["Carb"],},
        'pRL-SV40': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Tet"],},
        'pRL-TK': {'大肠杆菌抗性': ["Kan", "Spec", "Strep", "Tet"],},
        'pRS313': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],},
        'pRS314': {'大肠杆菌抗性': ["Amp", "Rif", "Strep"],},
        'pRS315': {'大肠杆菌抗性': ["Rif", "Tet"],},
        'pRS316': {'大肠杆菌抗性': ["Cm", "Rif", "Spec"],},
        'pRS423': {'大肠杆菌抗性': ["Amp", "Strep"],},
        'pRS424': {'大肠杆菌抗性': ["Carb", "Rif", "Strep"],},
        'pRS425': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep"],},
        'pRS426': {'大肠杆菌抗性': ["Cm", "Kan", "Rif"],},
        'pRSV-Rev': {'大肠杆菌抗性': ["Carb", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pRetro-SUPER': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSC101': {'大肠杆菌抗性': ["Kan", "Tet"],},
        'pSIREN-RetroQ': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSIREN-RetroQ-Puro': {'大肠杆菌抗性': ["Cm", "Kan", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSIREN-shRNA': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pSMPUW-CMV': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pSMPUW-EF1a': {'大肠杆菌抗性': ["Amp", "Cm"],'哺乳动物抗性': ["Hyg"],},
        'pSMPUW-GFP': {'大肠杆菌抗性': ["Amp", "Cm", "Rif"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pSpCas9(BB)-2A-GFP': {'大肠杆菌抗性': ["Amp", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pSpCas9(BB)-2A-Puro': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pSpCas9n(BB)-2A-GFP': {'大肠杆菌抗性': ["Carb", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pSpCas9n(BB)-2A-Puro': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],'哺乳动物抗性': ["Neo"],},
        'pSuper.GFP': {'大肠杆菌抗性': ["Carb", "Rif"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'pSuper.neo': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Neo", "Zeo"],},
        'pSuper.puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pTOPO-Blunt': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Tet"],},
        'pTOPO-T': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],},
        'pTOPO-TA': {'大肠杆菌抗性': ["Cm", "Spec", "Strep"],},
        'pTriEx-1': {'大肠杆菌抗性': ["Amp", "Cm", "Rif"],},
        'pTriEx-1.1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pTriEx-2.1': {'大肠杆菌抗性': ["Amp", "Cm", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pTriEx-3.1': {'大肠杆菌抗性': ["Rif", "Tet"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pUC18': {'大肠杆菌抗性': ["Amp", "Rif", "Spec"],},
        'pUC19': {'大肠杆菌抗性': ["Tet"],},
        'pUC57': {'大肠杆菌抗性': ["Kan"],},
        'pUC57-Kan': {'大肠杆菌抗性': ["Cm", "Rif", "Strep"],},
        'pWPI': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Neo"],},
        'pX330': {'大肠杆菌抗性': ["Cm", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pX330A-1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pX330S-2': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Puro"],},
        'pX330S-3': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Spec"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pX333': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast"],},
        'pX335': {'大肠杆菌抗性': ["Rif", "Spec", "Strep"],'哺乳动物抗性': ["Neo"],},
        'pX335A-1': {'大肠杆菌抗性': ["Cm", "Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pYC12': {'大肠杆菌抗性': ["Cm", "Strep"],},
        'pYC2.1': {'大肠杆菌抗性': ["Kan", "Rif", "Spec"],},
        'pYC6': {'大肠杆菌抗性': ["Kan", "Rif", "Tet"],},
        'pYD1': {'大肠杆菌抗性': ["Carb", "Tet"],},
        'pYES2': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],},
        'pYES2.1': {'大肠杆菌抗性': ["Cm", "Spec", "Tet"],},
        'pYES3': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec"],},
        'pYES6': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Tet"],},
        'pcDNA3': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pcDNA3.1': {'大肠杆菌抗性': ["Carb", "Kan", "Spec"],},
        'pcDNA3.1(+)': {'大肠杆菌抗性': ["Amp", "Carb", "Spec", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pcDNA3.1(-)': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Zeo"],},
        'psPAX2': {'大肠杆菌抗性': ["Amp", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'px330': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'px330A-1': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],'哺乳动物抗性': ["Blast", "Puro"],},
        'px330A-2': {'大肠杆菌抗性': ["Carb", "Cm", "Rif", "Tet"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'px333': {'大肠杆菌抗性': ["Kan", "Spec", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'px335': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Strep"],},
        'px335A-1': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'spCas9': {'大肠杆菌抗性': ["Carb", "Tet"],'哺乳动物抗性': ["Zeo"],},
        'spCas9-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Cm"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'spCas9-mCherry': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'tdTomato-C1': {'大肠杆菌抗性': ["Spec", "Tet"],'哺乳动物抗性': ["Puro"],},
        'tdTomato-N1': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Blast"],},
    },
    
    recognize: function(filename) {
        const result = {
            载体类型: new Set(),
            靶基因: new Set(),
            功能: new Set(),
            大肠杆菌抗性: new Set(),
            哺乳动物抗性: new Set(),
            置信度: 0
        };
        
        const normalized = filename.toUpperCase();
        let matches = 0;
        
        // 1. 识别载体
        for (const carrier of this.carriers) {
            if (normalized.includes(carrier.toUpperCase())) {
                result.载体类型.add(carrier);
                matches++;
                
                const resists = this.carrierResistance[carrier];
                if (resists) {
                    if (resists.大肠杆菌抗性) resists.大肠杆菌抗性.forEach(r => result.大肠杆菌抗性.add(r));
                    if (resists.哺乳动物抗性) resists.哺乳动物抗性.forEach(r => result.哺乳动物抗性.add(r));
                }
                
                // 功能推断
                if (carrier.includes('Lenti') || carrier.includes('psPAX') || carrier.includes('pMD')) {
                    result.功能.add('病毒包装');
                } else if (carrier.includes('CRISPR') || carrier.includes('Cas9')) {
                    result.功能.add('CRISPR');
                } else if (carrier.includes('pLKO')) {
                    result.功能.add('shRNA');
                } else if (carrier.includes('pET') || carrier.includes('pGEX')) {
                    result.功能.add('原核表达');
                } else if (carrier.includes('pcDNA') || carrier.includes('pCMV')) {
                    result.功能.add('哺乳动物表达');
                }
            }
        }
        
        // 2. 识别基因
        for (const gene of this.genes) {
            if (normalized.includes(gene)) {
                result.靶基因.add(gene);
                matches++;
            }
        }
        
        result.置信度 = Math.min(matches / 5, 1.0);
        return result;
    }
};

console.log('[RecognitionTrainingData] Loaded');
