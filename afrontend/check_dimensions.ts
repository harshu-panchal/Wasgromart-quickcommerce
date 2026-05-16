/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

function getImageDimensions(filePath: string) {
    try {
        const buffer = fs.readFileSync(filePath);
        let offset = 2;
        while (offset < buffer.length) {
            if (buffer[offset] === 0xFF && buffer[offset + 1] >= 0xC0 && buffer[offset + 1] <= 0xC3) {
                const h = buffer.readUInt16BE(offset + 5);
                const w = buffer.readUInt16BE(offset + 7);
                return { width: w, height: h };
            }
            offset += 2 + buffer.readUInt16BE(offset + 2);
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return null;
}

const bannersDir = path.join(process.cwd(), 'public', 'assets', 'banners');
const files = ['banner1.jpg', 'banner3.jpg', 'banner4.jpg'];

console.log('Checking banner dimensions...');
files.forEach(file => {
    const dim = getImageDimensions(path.join(bannersDir, file));
    if (dim) {
        console.log(`${file}: ${dim.width}x${dim.height} (Ratio: ${(dim.width / dim.height).toFixed(2)})`);
    } else {
        console.log(`${file}: Could not determine dimensions`);
    }
});
