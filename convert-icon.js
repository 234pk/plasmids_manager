const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgPath = path.join(__dirname, 'assets', 'icon.svg');
const pngPath = path.join(__dirname, 'assets', 'icon.png');

console.log('正在读取 SVG 文件并转换为 PNG (1024x1024)...');

sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(pngPath)
    .then(info => {
        console.log('✅ 转换成功！');
        console.log('生成路径:', pngPath);
        console.log('图片信息:', info);
    })
    .catch(err => {
        console.error('❌ 转换失败:', err);
        process.exit(1);
    });
