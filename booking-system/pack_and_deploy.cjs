const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const standaloneDir = path.resolve(__dirname, '.next', 'standalone');
const zipFile = path.resolve(__dirname, 'deploy_live.zip');

if (fs.existsSync(zipFile)) {
    console.log("Removing previous deploy_live.zip...");
    fs.unlinkSync(zipFile);
}

console.log("1. Running prepare_deploy.cjs...");
execSync('node prepare_deploy.cjs', { stdio: 'inherit', cwd: __dirname });

console.log("2. Running create_deploy_zip.py with POSIX attributes...");
execSync('python create_deploy_zip.py', { stdio: 'inherit', cwd: __dirname });

const stats = fs.statSync(zipFile);
console.log(`Successfully created deploy_live.zip (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
