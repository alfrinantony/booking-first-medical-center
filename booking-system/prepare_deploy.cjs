const fs = require('fs');
const path = require('path');

async function prepare() {
    console.log("=== Preparing standalone package for Azure App Service ===");
    const root = __dirname;
    const standaloneDir = path.join(root, '.next', 'standalone');
    const staticSrc = path.join(root, '.next', 'static');
    const staticDest = path.join(standaloneDir, '.next', 'static');
    const publicSrc = path.join(root, 'public');
    const publicDest = path.join(standaloneDir, 'public');

    console.log("1. Copying static files to standalone/.next/static...");
    fs.cpSync(staticSrc, staticDest, { recursive: true });

    console.log("2. Copying public files to standalone/public...");
    if (fs.existsSync(publicSrc)) {
        fs.cpSync(publicSrc, publicDest, { recursive: true });
    }

    console.log("3. Copying prisma engine if needed...");
    const prismaSrc = path.join(root, 'prisma');
    const prismaDest = path.join(standaloneDir, 'prisma');
    if (fs.existsSync(prismaSrc)) {
        fs.cpSync(prismaSrc, prismaDest, { recursive: true });
    }

    console.log("4. Cleaning up temporary and non-Linux files...");
    const prismaClientDir = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
    if (fs.existsSync(prismaClientDir)) {
        const files = fs.readdirSync(prismaClientDir);
        for (const file of files) {
            if (file.includes('.tmp') || file.endsWith('-windows.dll.node') || file.endsWith('-rhel-openssl-1.0.x.so.node')) {
                fs.unlinkSync(path.join(prismaClientDir, file));
            }
        }
    }

    const tsDir = path.join(standaloneDir, 'node_modules', 'typescript');
    if (fs.existsSync(tsDir)) {
        fs.rmSync(tsDir, { recursive: true, force: true });
    }

    console.log("5. Writing .deployment file...");
    fs.writeFileSync(path.join(standaloneDir, '.deployment'), '[config]\nSCM_DO_BUILD_DURING_DEPLOYMENT = false\n');

    console.log("6. Verifying standalone contents:");
    console.log(fs.readdirSync(standaloneDir));

    console.log("=== Standalone directory ready for deployment ===");
}

prepare().catch(console.error);
