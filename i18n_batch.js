
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_FILE = 'index.html';
const JS_FILES = ['js/app.js', 'js/batch-logic.js', 'js/recognition.js'];
const OUTPUT_ZH = 'locales/zh.json';
const OUTPUT_EN = 'locales/en.json';

// Regex for Chinese characters
const CHINESE_REGEX = /[\u4e00-\u9fa5]+[^\u4e00-\u9fa5\n<>{}]*[\u4e00-\u9fa5]*/g;

/**
 * Extract Chinese strings from a file
 */
function extractChinese(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(CHINESE_REGEX) || [];
    return [...new Set(matches.map(m => m.trim()))];
}

/**
 * Generate keys for Chinese strings
 */
function generateKeys(strings) {
    const map = {};
    strings.forEach((str, index) => {
        // Simple key generation: prefix + index
        // In a real scenario, you might want more descriptive keys
        const key = `str_${index.toString().padStart(3, '0')}`;
        map[key] = str;
    });
    return map;
}

/**
 * Replace Chinese strings in a file with {{ t('key') }} or t('key')
 */
function replaceInFile(filePath, map, isHtml = true) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Sort keys by value length descending to avoid partial replacements
    const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    
    for (const [key, value] of entries) {
        if (!value || value.length < 2) continue; // Skip single characters or empty

        const escapedValue = escapeRegex(value);
        
        if (isHtml) {
            // 1. Handle text nodes: >中文< or \s中文\s or ^中文$
            // Using a more restrictive regex to avoid replacing things inside tags
            const textRegex = new RegExp(`(>|^|\\s)${escapedValue}(?=<|\\s|$)`, 'g');
            content = content.replace(textRegex, (match, p1) => `${p1}{{ t('${key}') }}`);
            
            // 2. Handle attributes (title, placeholder, aria-label)
            const attrRegex = new RegExp(`\\s(title|placeholder|aria-label)="${escapedValue}"`, 'g');
            content = content.replace(attrRegex, (match, attr) => ` :${attr}="t('${key}')"`);
        } else {
            // In JS, we replace "text" or 'text' with t('key')
            // But skip if it's already inside a t('') call
            const jsRegex = new RegExp(`(?<!t\\()(['"])${escapedValue}\\1`, 'g');
            content = content.replace(jsRegex, `t('${key}')`);
        }
    }
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main Execution
console.log('Starting i18n batch process...');

// 1. Create locales directory if not exists
if (!fs.existsSync('locales')) {
    fs.mkdirSync('locales');
}

// 2. Load existing map if exists
let map = {};
if (fs.existsSync(OUTPUT_ZH)) {
    try {
        map = JSON.parse(fs.readFileSync(OUTPUT_ZH, 'utf8'));
    } catch (e) {
        console.error('Error parsing zh.json, starting with empty map.');
    }
}

// Helper to find key by value
function findKeyByValue(obj, value) {
    for (const key in obj) {
        if (obj[key] === value) return key;
    }
    return null;
}

// 3. Extract and map
const filesToProcess = [
    { path: TARGET_FILE, isHtml: true },
    { path: 'js/app.js', isHtml: false },
    { path: 'js/batch-logic.js', isHtml: false },
    { path: 'js/recognition.js', isHtml: false }
];

filesToProcess.forEach(fileInfo => {
    if (!fs.existsSync(fileInfo.path)) return;
    
    console.log(`Processing ${fileInfo.path}...`);
    const strings = extractChinese(fileInfo.path);
    
    strings.forEach(str => {
        if (str.length < 2) return; // Skip very short strings
        if (!findKeyByValue(map, str)) {
            const key = `gen_${Object.keys(map).length.toString().padStart(4, '0')}`;
            map[key] = str;
        }
    });
});

// 4. Save updated zh.json and generate JS data
fs.writeFileSync(OUTPUT_ZH, JSON.stringify(map, null, 4), 'utf8');
console.log(`Saved ${OUTPUT_ZH}. Total strings: ${Object.keys(map).length}`);

// 5. Update en.json (don't overwrite existing translations)
let enMap = {};
if (fs.existsSync(OUTPUT_EN)) {
    try {
        enMap = JSON.parse(fs.readFileSync(OUTPUT_EN, 'utf8'));
    } catch (e) {}
}

Object.keys(map).forEach(key => {
    if (!enMap[key]) {
        enMap[key] = `[EN] ${map[key]}`;
    }
});
fs.writeFileSync(OUTPUT_EN, JSON.stringify(enMap, null, 4), 'utf8');
console.log(`Saved ${OUTPUT_EN}`);

// 5b. Generate js/translations_data.js for frontend use
const translationsData = `
window.I18nData = {
    zh: ${JSON.stringify(map, null, 4)},
    en: ${JSON.stringify(enMap, null, 4)}
};
`;
fs.writeFileSync('js/translations_data.js', translationsData, 'utf8');
console.log('Saved js/translations_data.js');

// 6. Perform replacements
filesToProcess.forEach(fileInfo => {
    if (fs.existsSync(fileInfo.path)) {
        replaceInFile(fileInfo.path, map, fileInfo.isHtml);
    }
});

console.log('Batch localization complete!');
