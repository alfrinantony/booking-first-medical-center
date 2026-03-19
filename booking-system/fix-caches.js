const fs = require('fs');
const path = require('path');
const libDir = path.join(process.cwd(), 'lib');

const files = fs.readdirSync(libDir).filter(f => f.endsWith('.ts'));
let totalFixed = 0;

files.forEach(file => {
    const filePath = path.join(libDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    content = content.replace(/if\s*\(![a-zA-Z0-9_]+Loaded\)\s*\{([\s\S]*?)[a-zA-Z0-9_]+Loaded\s*=\s*true;\s*\n\s*\}/g, '$1');
    content = content.replace(/let\s+[a-zA-Z0-9_]+Loaded\s*=\s*false;\s*\n/g, '');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFixed++;
        console.log('Fixed', file);
    }
});
console.log('Total files fixed:', totalFixed);
