/**
 * 识别引擎与规则加载
 */
window.Recognition = {
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
        
        // 自动提取完整路径 (优先使用 webkitRelativePath，如果没有则使用 name)
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

        // 2. 启发式识别
        Object.entries(allFeatures).forEach(([key, values]) => {
            values.forEach(val => {
                if (!val) return;
                const valLower = val.toLowerCase();
                const escapedVal = window.Utils.escapeRegExp(valLower);
                const regex = new RegExp(`(^|[-_ .])${escapedVal}([-_ .]|$)`, 'i');
                if (regex.test(nameLower)) {
                    recognized[key].add(val);
                }
            });
        });

        // 2.1 针对科研词汇的硬编码增强（识别从未在数据库中出现的常见词汇）
        const extraRules = {
            '启动子': [/pCMV/i, /phU6/i, /phH1/i, /pEF1a/i, /pCAG/i, /pPGK/i, /pSV40/i, /pTRE/i, /pTight/i, /pUbi/i],
            '荧光蛋白': [/EGFP/i, /mCherry/i, /tdTomato/i, /EYFP/i, /EBFP/i, /mRuby/i, /mCitrine/i, /GFP/i, /RFP/i, /YFP/i, /BFP/i, /DsRed/i],
            '蛋白标签': [/3xFlag/i, /Flag/i, /Myc/i, /HA/i, /His/i, /GST/i, /V5/i, /SBP/i, /Strep/i, /Avi/i, /TAP/i],
            '插入类型': [/shRNA/i, /sgRNA/i, /cDNA/i, /ORF/i, /promoter/i, /enhancer/i, /3'UTR/i, /5'UTR/i, /miRNA/i],
            '四环素诱导': [/Tet-On/i, /Tet-Off/i, /TRE/i, /Dox/i, /Tetracycline/i]
        };

        Object.entries(extraRules).forEach(([key, patterns]) => {
            patterns.forEach(regex => {
                const match = nameLower.match(regex);
                if (match) {
                    recognized[key].add(match[0]);
                }
            });
        });

        // 2.2 精细化物种识别 (人, 小鼠, 大鼠等)
        const speciesRules = [
            { name: '人', patterns: [/human/i, /Homo sapiens/i, /\bh\b(?=[A-Z])/] },
            { name: '小鼠', patterns: [/mouse/i, /Mus musculus/i, /m(?=[A-Z])/, /mus/i] },
            { name: '大鼠', patterns: [/rat/i, /Rattus/i, /r(?=[A-Z])/] },
            { name: '食蟹猴', patterns: [/cynomolgus/i, /monkey/i, /cyno/i] },
            { name: '猪', patterns: [/pig/i, /porcine/i, /p(?=[A-Z])/] }
        ];

        speciesRules.forEach(rule => {
            if (rule.patterns.some(regex => regex.test(nameLower) || regex.test(recognized.路径.toLowerCase()))) {
                recognized.物种.add(rule.name);
            }
        });

        // 2.3 突变识别 (如 E123K, ΔF508 等)
        const mutationRegex = /\b[A-Z]\d+[A-Z\*]\b|\bdelta\w+\b/gi;
        const mutationMatches = nameLower.match(mutationRegex);
        if (mutationMatches) {
            mutationMatches.forEach(m => recognized.突变.add(m));
        }

        // 3. NLP 辅助提取
        try {
            if (window.nlp) {
                const doc = window.nlp(nameWithoutExt.replace(/[-_.]/g, ' '));
                const nouns = doc.nouns().out('array');
                nouns.forEach(noun => {
                    if (noun.length > 2 && !Array.from(recognized.载体类型).some(v => v.toLowerCase().includes(noun.toLowerCase()))) {
                        recognized.靶基因.add(noun);
                    }
                });
            }
        } catch (e) {
            console.warn('NLP processing failed', e);
        }

        // 4. 靶基因兜底识别
        if (recognized.靶基因.size === 0) {
            const parts = nameWithoutExt.split(/[-_ .]/);
            parts.forEach(part => {
                if (part.length > 2 && 
                    !Array.from(recognized.载体类型).some(v => v.includes(part)) &&
                    !Array.from(recognized.物种).some(v => v.includes(part)) &&
                    !Array.from(recognized.大肠杆菌抗性).some(v => v.includes(part))) {
                    recognized.靶基因.add(part);
                }
            });
        }

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
    }
};
