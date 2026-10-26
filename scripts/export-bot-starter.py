"""Package only reusable source; never include a client's .env, config or DB."""
from pathlib import Path
import argparse
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'bot-starter'
ALLOWED_ROOT = {'package.json', 'Dockerfile', 'README.md', '.env.example', '.gitignore', '.dockerignore'}
EXCLUDE = {'node_modules', 'data', '.git', '__pycache__', 'coverage', 'test-results'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exports', type=Path, default=ROOT.parent / 'exports')
    args = parser.parse_args()
    files = []
    for file in sorted(SOURCE.rglob('*')):
        if not file.is_file() or file.is_symlink():
            continue
        rel = file.relative_to(SOURCE)
        if any(part in EXCLUDE for part in rel.parts):
            continue
        if str(rel) in ALLOWED_ROOT or str(rel) == 'config/client.example.json' or (rel.parts[0] in {'src', 'scripts', 'test'} and file.suffix in {'.js', '.cjs', '.json', '.html', '.css'}):
            files.append((file, rel))
    names = {str(rel) for _, rel in files}
    required = {'package.json', 'README.md', '.env.example', 'config/client.example.json', 'Dockerfile'}
    if not required.issubset(names) or not any(name.startswith('src/') for name in names):
        raise ValueError('Bot starter is incomplete')
    destination = ROOT / 'manual/generated/dawkoz-bot-starter.zip'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file, rel in files:
            archive.write(file, str(Path('bot-starter') / rel))
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('Invalid ZIP')
        for name in archive.namelist():
            if name.endswith('/.env') or name.endswith('/client.json') or name.endswith(('.sqlite', '.db', '-wal', '-shm')):
                raise ValueError('Private client data must not enter the download')
    args.exports.mkdir(parents=True, exist_ok=True)
    shutil.copy2(destination, args.exports / destination.name)
    print(f'{len(files)} source files; {destination.stat().st_size} bytes')
    print(args.exports / destination.name)


if __name__ == '__main__':
    main()
