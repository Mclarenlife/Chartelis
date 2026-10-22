"""Check the actual packaged macOS app before publishing its DMG."""
import json
import plistlib
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
app = root / 'src-tauri/target/universal-apple-darwin/release/bundle/macos/Chartelis.app'
with (app / 'Contents/Info.plist').open('rb') as file:
    info = plistlib.load(file)
version = json.loads((root / 'package.json').read_text())['version']
assert info['CFBundleShortVersionString'] == version, info
assert info.get('CFBundleAllowMixedLocalizations') is True, 'AppKit localization is missing'
executable = app / 'Contents/MacOS' / info['CFBundleExecutable']
architectures = subprocess.check_output(['lipo', '-archs', str(executable)], text=True).split()
assert set(architectures) == {'x86_64', 'arm64'}, architectures
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
print(f'Verified Chartelis {version}: system framework localization, universal binary, ad-hoc signature integrity.')
