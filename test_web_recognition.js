
const fs = require('fs');
const path = require('path');

// 模拟浏览器环境
const window = {
    Recognition: {},
    Utils: {
        log: (msg) => console.log(`[LOG] ${msg}`),
        escapeRegExp: (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    },
    UniProtService: {
        search: async () => null
    }
};

const t = (key) => key;

// 加载 recognition.js
const recognitionCode = fs.readFileSync(path.join(__dirname, 'js/recognition.js'), 'utf8');
const wrappedCode = `
    const t = (key) => key;
    ${recognitionCode}
`;
eval(wrappedCode);

// 加载数据
const webPlasmids = JSON.parse(fs.readFileSync(path.join(__dirname, 'web_plasmids.json'), 'utf8'));
const database = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/new_database.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/recognition_rules.json'), 'utf8'));

console.log(`[TEST] 开始针对 12 个经典 Web 质粒进行识别测试...\n`);

const fieldsToCompare = [
    '载体类型', '靶基因', '物种', '大肠杆菌抗性', '哺乳动物抗性', 
    '插入类型', '蛋白标签', '荧光蛋白', '启动子'
];

let totalScore = 0;
const results = [];

window.Recognition.setContext({
    rules: rules,
    plasmids: database,
    config: { minMatchScore: 0.7 }
});

webPlasmids.forEach(plasmid => {
    const filename = plasmid.文件名;
    const recognized = window.Recognition.recognize(filename);
    
    let plasmidScore = 0;
    const details = {
        filename: filename,
        matches: {},
        mismatches: {}
    };

    fieldsToCompare.forEach(field => {
        const expected = Array.isArray(plasmid[field]) ? plasmid[field] : (plasmid[field] && plasmid[field] !== '无' ? plasmid[field].split(',').map(s => s.trim()) : []);
        const actual = Array.from(recognized[field] || []);
        
        const normalize = (arr) => arr.map(v => String(v).toLowerCase().trim()).filter(v => v !== '无' && v !== '').sort();
        const normExpected = normalize(expected);
        const normActual = normalize(actual);

        // 特殊处理：如果期望是空，实际也是空，算对
        if (normExpected.length === 0 && normActual.length === 0) {
            plasmidScore += 1;
            details.matches[field] = [];
            return;
        }

        // 集合包含判断 (更宽松的匹配)
        const isMatch = normExpected.every(e => normActual.includes(e)) && normActual.every(a => normExpected.includes(a));
        
        if (isMatch) {
            plasmidScore += 1;
            details.matches[field] = actual;
        } else {
            details.mismatches[field] = {
                expected: expected,
                actual: actual
            };
        }
    });

    const finalScore = (plasmidScore / fieldsToCompare.length) * 100;
    totalScore += finalScore;
    
    results.push({
        score: finalScore,
        ...details
    });
});

const averageScore = totalScore / webPlasmids.length;

console.log(`--------------------------------------------------`);
console.log(`Web 经典质粒平均识别准确率: ${averageScore.toFixed(2)}%`);
console.log(`--------------------------------------------------\n`);

console.log(`详细错误分析:\n`);
results.filter(r => r.score < 100).forEach(r => {
    console.log(`质粒: ${r.filename} (得分: ${r.score.toFixed(1)}%)`);
    Object.entries(r.mismatches).forEach(([field, data]) => {
        console.log(`  [${field}] 期望: [${data.expected}] | 实际: [${data.actual}]`);
    });
    console.log('');
});

fs.writeFileSync('web_recognition_report.json', JSON.stringify({
    averageScore: averageScore,
    timestamp: new Date().toISOString(),
    results: results
}, null, 2));
