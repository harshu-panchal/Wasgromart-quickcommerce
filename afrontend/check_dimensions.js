/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
function getImageDimensions(filePath) {
    try {
        var buffer = fs.readFileSync(filePath);
        var offset = 2;
        while (offset < buffer.length) {
            if (buffer[offset] === 0xFF && buffer[offset + 1] >= 0xC0 && buffer[offset + 1] <= 0xC3) {
                var h = buffer.readUInt16BE(offset + 5);
                var w = buffer.readUInt16BE(offset + 7);
                return { width: w, height: h };
            }
            offset += 2 + buffer.readUInt16BE(offset + 2);
        }
    }
    catch (e) {
        console.error("Error reading ".concat(filePath, ":"), e);
    }
    return null;
}
var bannersDir = path.join(process.cwd(), 'public', 'assets', 'banners');
var files = ['banner1.jpg', 'banner3.jpg', 'banner4.jpg'];
console.log('Checking banner dimensions...');
files.forEach(function (file) {
    var dim = getImageDimensions(path.join(bannersDir, file));
    if (dim) {
        console.log("".concat(file, ": ").concat(dim.width, "x").concat(dim.height, " (Ratio: ").concat((dim.width / dim.height).toFixed(2), ")"));
    }
    else {
        console.log("".concat(file, ": Could not determine dimensions"));
    }
});
