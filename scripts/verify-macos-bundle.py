"""Check the actual packaged macOS app before publishing its DMG."""
import json
import plistlib
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
dmg = root / f'src-tauri/target/universal-apple-darwin/release/bundle/dmg/Chartelis_{version}_universal.dmg'
# A DMG-only Tauri build cleans the intermediate .app. Inspect the actual image.
mounted = plistlib.loads(subprocess.check_output(['hdiutil', 'attach', str(dmg), '-readonly', '-nobrowse', '-plist']))
mount = next(Path(item['mount-point']) for item in mounted['system-entities'] if 'mount-point' in item)
try:
    app = mount / 'Chartelis.app'
    with (app / 'Contents/Info.plist').open('rb') as file:
        info = plistlib.load(file)
    assert info['CFBundleShortVersionString'] == version, info
    assert info.get('CFBundleAllowMixedLocalizations') is True, 'AppKit localization is missing'
    executable = app / 'Contents/MacOS' / info['CFBundleExecutable']
    architectures = subprocess.check_output(['lipo', '-archs', str(executable)], text=True).split()
    assert set(architectures) == {'x86_64', 'arm64'}, architectures
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
finally:
    subprocess.run(['hdiutil', 'detach', str(mount)], check=True)
print(f'Verified Chartelis {version}: system framework localization, universal binary, ad-hoc signature integrity.')
