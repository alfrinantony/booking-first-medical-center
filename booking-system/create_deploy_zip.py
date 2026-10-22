import os
import zipfile
import sys

standalone_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '.next', 'standalone'))
zip_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'deploy_live.zip'))

print(f"Packaging {standalone_dir} -> {zip_path}")

if os.path.exists(zip_path):
    os.remove(zip_path)

file_count = 0
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for root, dirs, files in os.walk(standalone_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, standalone_dir)
            # CRITICAL: Always use POSIX forward slash for Linux compatibility
            arcname = rel_path.replace('\\', '/')
            zf.write(full_path, arcname)
            file_count += 1

size_mb = os.path.getsize(zip_path) / (1024 * 1024)
print(f"Successfully packaged {file_count} files into {zip_path} ({size_mb:.2f} MB)")
