const fs = require('fs');
const path = require('path');

// Mock window and Utils
const window = {
    Recognition: {},
    Utils: {
        log: () => {}, // Silence logs for cleaner output
        escapeRegExp: (string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
};

global.window = window; // Make window global so eval works if it references global window
global.Vue = { ref: () => ({ value: null }) }; // Mock Vue if needed

// Load recognition.js
try {
    const recognitionCode = fs.readFileSync(path.join(__dirname, 'recognition.js'), 'utf8');
    eval(recognitionCode);
} catch (e) {
    console.error("Error loading recognition.js:", e);
    process.exit(1);
}

// Load database
const dbPath = path.join(__dirname, '../data/new_database.json');
let database = [];
try {
    if (fs.existsSync(dbPath)) {
        database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } else {
        console.error("Database file not found:", dbPath);
        process.exit(1);
    }
} catch (e) {
    console.error("Error loading database:", e);
    process.exit(1);
}

// Fields to compare
const fieldsToCompare = [
    '载体类型', '靶基因', '物种', '功能', 
    '大肠杆菌抗性', '哺乳动物抗性', '插入类型', 
    '蛋白标签', '荧光蛋白', '启动子'
];

let totalEntries = 0;
let fieldStats = {};

fieldsToCompare.forEach(f => {
    fieldStats[f] = { correct: 0, total: 0, mismatches: [] };
});

console.log(`Loaded ${database.length} entries from database.`);

// Randomly sample 50 items
const sampleSize = 100;
const shuffled = database.sort(() => 0.5 - Math.random());
const sample = shuffled.slice(0, sampleSize);

console.log(`Testing on ${sample.length} random entries.`);

// For now, let's test PURE rules to see where the hardcoded logic fails/succeeds.

sample.forEach(entry => {
    const filename = entry['文件名'];
    if (!filename) return;

    totalEntries++;
    
    // We pass the database as 'existingPlasmids' because the app does that.
    // This allows the recognizer to see existing values for fuzzy matching.
    const recognized = window.Recognition.recognizePlasmid({ name: filename, path: '' }, null, database);

    fieldsToCompare.forEach(field => {
        // Ground truth
        let groundTruth = entry[field] || [];
        if (!Array.isArray(groundTruth)) groundTruth = [groundTruth];
        groundTruth = groundTruth.filter(v => v && v !== '无');

        // Prediction
        let prediction = recognized[field];
        if (prediction instanceof Set) prediction = Array.from(prediction);
        if (!Array.isArray(prediction)) prediction = [prediction];
        prediction = prediction.filter(v => v && v !== '无');

        // Normalize for comparison (lowercase, trim)
        const gtSet = new Set(groundTruth.map(v => v.toLowerCase().trim()));
        const predSet = new Set(prediction.map(v => v.toLowerCase().trim()));

        let isMatch = true;
        
        // Check for exact set equality (ignoring case)
        if (gtSet.size !== predSet.size) {
            isMatch = false;
        } else {
            for (let v of gtSet) {
                if (!predSet.has(v)) {
                    isMatch = false;
                    break;
                }
            }
        }

        // If GT is empty, we only count it as mismatch if Prediction is NOT empty (False Positive)
        if (groundTruth.length === 0) {
             if (prediction.length > 0) {
                 fieldStats[field].mismatches.push({
                    filename,
                    expected: [],
                    got: prediction,
                    type: "False Positive"
                });
             }
        } else {
            fieldStats[field].total++;
            if (isMatch) {
                fieldStats[field].correct++;
            } else {
                fieldStats[field].mismatches.push({
                    filename,
                    expected: groundTruth,
                    got: prediction,
                    type: "Mismatch"
                });
            }
        }
    });
});

console.log('--------------------------------------------------');
console.log(`Evaluated ${totalEntries} entries.`);
console.log('--------------------------------------------------');

Object.keys(fieldStats).forEach(field => {
    const stats = fieldStats[field];
    const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 'N/A';
    
    // Count False Positives
    const fps = stats.mismatches.filter(m => m.type === "False Positive").length;
    const realMismatches = stats.mismatches.length - fps;

    console.log(`Field: ${field}`);
    console.log(`  Accuracy (Recall/Precision mix): ${accuracy}% (${stats.correct}/${stats.total})`);
    console.log(`  False Positives (Hallucinations): ${fps}`);
    
    if (stats.mismatches.length > 0) {
        console.log(`  Sample mismatches:`);
        stats.mismatches.slice(0, 5).forEach(m => {
            console.log(`    File: ${m.filename}`);
            console.log(`      Type:     ${m.type}`);
            console.log(`      Expected: ${JSON.stringify(m.expected)}`);
            console.log(`      Got:      ${JSON.stringify(m.got)}`);
        });
    }
    console.log('--------------------------------------------------');
});
