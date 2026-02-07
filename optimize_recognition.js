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

// 简单的翻译模拟
const t = (key) => key;

// 加载 recognition.js
const recognitionCode = fs.readFileSync(path.join(__dirname, 'js/recognition.js'), 'utf8');
// 包装一下以适应 Node.js
const wrappedCode = `
    const t = (key) => key;
    ${recognitionCode}
`;
eval(wrappedCode);

// 加载数据
const database = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/new_database.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/recognition_rules.json'), 'utf8'));

// 随机选择 50 个质粒
const testSet = database
    .filter(p => p.文件名)
    .sort(() => 0.5 - Math.random())
    .slice(0, 50);

console.log(`[TEST] 开始测试 ${testSet.length} 个质粒的识别精度...\n`);

const fieldsToCompare = [
    '载体类型', '靶基因', '物种', '大肠杆菌抗性', '哺乳动物抗性', 
    '插入类型', '蛋白标签', '荧光蛋白', '启动子'
];

let totalScore = 0;
const results = [];

// 设置识别上下文
window.Recognition.setContext({
    rules: rules,
    plasmids: database, // 使用全库作为学习基础
    config: { minMatchScore: 0.7 }
});

testSet.forEach(plasmid => {
    const filename = plasmid.文件名;
    // 运行识别
    const recognized = window.Recognition.recognize(filename);
    
    let plasmidScore = 0;
    const details = {
        filename: filename,
        matches: {},
        mismatches: {}
    };

    fieldsToCompare.forEach(field => {
        const expected = Array.isArray(plasmid[field]) ? plasmid[field] : (plasmid[field] ? [plasmid[field]] : []);
        const actual = Array.from(recognized[field] || []);
        
        // 归一化处理用于比较 (转小写, 去空格, 排序)
        const normalize = (arr) => arr.map(v => String(v).toLowerCase().trim()).sort();
        const normExpected = normalize(expected);
        const normActual = normalize(actual);

        const isMatch = JSON.stringify(normExpected) === JSON.stringify(normActual);
        
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

const averageScore = totalScore / testSet.length;

// 输出报告
console.log('--------------------------------------------------');
console.log(`平均识别准确率: ${averageScore.toFixed(2)}%`);
console.log('--------------------------------------------------\n');

// 输出失败详情
console.log('典型错误案例:');
results.filter(r => r.score < 100).slice(0, 10).forEach(r => {
    console.log(`\n质粒: ${r.filename} (得分: ${r.score.toFixed(1)}%)`);
    Object.entries(r.mismatches).forEach(([field, data]) => {
        console.log(`  [${field}] 期望: [${data.expected.join(', ')}] | 实际: [${data.actual.join(', ')}]`);
    });
});

// 保存详细报告
fs.writeFileSync(
    path.join(__dirname, 'recognition_test_report.json'), 
    JSON.stringify({
        timestamp: new Date().toISOString(),
        averageScore: averageScore,
        results: results
    }, null, 2)
);

console.log(`\n[SUCCESS] 详细报告已保存至 recognition_test_report.json`);
