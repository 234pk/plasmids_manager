const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');

const INPUT_FILE = path.join(__dirname, 'assets', 'icon.png');
const OUTPUT_ICNS = path.join(__dirname, 'assets', 'icon.icns');
const OUTPUT_ICO = path.join(__dirname, 'assets', 'icon.ico');

console.log(`Processing icon: ${INPUT_FILE}`);

try {
    const input = fs.readFileSync(INPUT_FILE);

    // Generate ICNS (for Mac)
    console.log('Generating ICNS...');
    const icns = png2icons.createICNS(input, png2icons.BILINEAR, 0);
    if (icns) {
        fs.writeFileSync(OUTPUT_ICNS, icns);
        console.log(`Successfully created: ${OUTPUT_ICNS}`);
    } else {
        console.error('Failed to create ICNS');
    }

    // Generate ICO (for Windows)
    console.log('Generating ICO...');
    const ico = png2icons.createICO(input, png2icons.HERMITE, 0, false);
    if (ico) {
        fs.writeFileSync(OUTPUT_ICO, ico);
        console.log(`Successfully created: ${OUTPUT_ICO}`);
    } else {
        console.error('Failed to create ICO');
    }

} catch (err) {
    console.error('Error processing icons:', err);
    process.exit(1);
}
