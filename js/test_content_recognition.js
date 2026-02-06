const fs = require('fs');
const path = require('path');

// Mock window object
global.window = {};
global.localStorage = {
    getItem: () => '{}',
    setItem: () => {}
};

// Mock Utils
window.Utils = {
    escapeRegExp: (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    log: console.log
};

// Load Recognition logic
const recognitionContent = fs.readFileSync(path.join(__dirname, 'recognition.js'), 'utf8');
eval(recognitionContent);

// Load Database
const dbPath = path.join(__dirname, '../data/new_database.json');
const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const sequencesDir = path.join(__dirname, '../data/sequences');

// Helper to find file
function findFile(filename) {
    const candidates = [
        filename,
        filename + '.fasta',
        filename + '.dna.fasta',
        filename + '.gb.fasta',
        filename + '.dna',
        filename + '.gb'
    ];
    
    for (const c of candidates) {
        const p = path.join(sequencesDir, c);
        if (fs.existsSync(p)) return p;
    }
    
    // Try fuzzy search in directory
    try {
        const files = fs.readdirSync(sequencesDir);
        for (const f of files) {
            if (f.startsWith(filename)) return path.join(sequencesDir, f);
        }
    } catch (e) {}

    return null;
}

// Filter items with files
const validItems = [];
database.forEach(item => {
    if (!item['文件名']) return;
    const filePath = findFile(item['文件名']);
    if (filePath) {
        validItems.push({ ...item, filePath });
    }
});

console.log(`Found ${validItems.length} items with sequence files.`);

// Randomly sample 50 items
const sampleSize = 50;
const shuffled = validItems.sort(() => 0.5 - Math.random());
const sample = shuffled.slice(0, sampleSize);

console.log(`Testing content recognition on ${sample.length} random entries.`);

const fieldsToCompare = [
    '载体类型', '靶基因', '物种', '功能', 
    '大肠杆菌抗性', '哺乳动物抗性', '插入类型', 
    '荧光蛋白', '启动子', '蛋白标签'
];

let totalEntries = 0;
let stats = {};

fieldsToCompare.forEach(f => {
    stats[f] = { total: 0, matches: 0, mismatches: [] };
});

async function runTest() {
    for (const entry of sample) {
        totalEntries++;
        const content = fs.readFileSync(entry.filePath, 'utf8');
        
        // Test recognizeFromContent
        // Note: recognizeFromContent is async in the file, but implementation is sync-ish except for text decoding?
        // Wait, recognizeFromContent in file is async.
        const recognized = await window.Recognition.recognizeFromContent(content, entry['文件名']);

        if (!recognized) {
            console.log(`Failed to recognize content for ${entry['文件名']}`);
            continue;
        }

        fieldsToCompare.forEach(field => {
            // recognizeFromContent might not return all fields (e.g. 功能, 物种 might be missing)
            // But let's check what it returns.
            if (!recognized[field]) return; // Skip fields not supported by content recognition yet

            const expected = new Set(Array.isArray(entry[field]) ? entry[field] : (entry[field] ? [entry[field]] : []));
            // Filter out '无' from expected
            const expectedClean = new Set();
            expected.forEach(v => { if(v && v !== '无') expectedClean.add(v); });

            const got = new Set(recognized[field]);
            
            // Compare sets
            let match = true;
            // Precision: All got must be in expected (allow empty got) - "宁缺毋滥"
            // Recall: We also want to find things if they exist.
            
            // For this test, let's print mismatches where Got has something not in Expected (Hallucination)
            // OR Expected has something but Got is empty (Miss), but Hallucination is worse.
            
            const hallucinations = [...got].filter(x => !expectedClean.has(x));
            const misses = [...expectedClean].filter(x => !got.has(x));

            if (hallucinations.length > 0) {
                stats[field].mismatches.push({
                    file: entry['文件名'],
                    type: 'False Positive',
                    expected: [...expectedClean],
                    got: [...got]
                });
            } else if (misses.length > 0) {
                 stats[field].mismatches.push({
                    file: entry['文件名'],
                    type: 'Miss',
                    expected: [...expectedClean],
                    got: [...got]
                });
            }

            if (hallucinations.length === 0 && misses.length === 0) {
                 stats[field].matches++;
            }
            stats[field].total++;
        });
    }

    // Print Report
    console.log('\n--- Content Recognition Evaluation Report ---');
    fieldsToCompare.forEach(field => {
        const s = stats[field];
        if (s.total === 0) return;
        const accuracy = ((s.matches / s.total) * 100).toFixed(1);
        console.log(`\nField: ${field}`);
        console.log(`  Perfect Matches: ${accuracy}% (${s.matches}/${s.total})`);
        
        const falsePositives = s.mismatches.filter(m => m.type === 'False Positive');
        console.log(`  False Positives (Hallucinations): ${falsePositives.length}`);
        
        if (s.mismatches.length > 0) {
            console.log(`  Sample mismatches:`);
            s.mismatches.slice(0, 10).forEach(m => {
                console.log(`    File: ${m.file}`);
                console.log(`      Type:     ${m.type}`);
                console.log(`      Expected: ${JSON.stringify(m.expected)}`);
                console.log(`      Got:      ${JSON.stringify(m.got)}`);
            });
        }
    });
}

runTest();
