const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const apiDir = path.join(process.cwd(), 'app', 'api');
let totalFixed = 0;

walkDir(apiDir, (filePath) => {
    if (filePath.endsWith('route.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes("export const dynamic = 'force-dynamic';")) {
            content = "export const dynamic = 'force-dynamic';\n" + content;
            fs.writeFileSync(filePath, content, 'utf8');
            totalFixed++;
            console.log('Fixed', filePath);
        }
    }
});
console.log('Total routes fixed:', totalFixed);
