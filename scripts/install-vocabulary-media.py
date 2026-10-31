"""从固定版本的 Word Atlas 检出目录校验并安装媒体，不覆盖已有资源目录。"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='上游检出目录的 public/atlas')
    parser.add_argument('--output', type=Path, required=True, help='新建的独立媒体目录')
    args = parser.parse_args()
    manifest_path = Path(__file__).resolve().parents[1] / 'resources/vocabulary/media-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    output = args.output.resolve()
    if output.exists():
        raise SystemExit('目标已存在；请使用新的版本目录，不能覆盖正在使用的资源')
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='vocabulary-install-', dir=output.parent))
    source = args.source.resolve()
    try:
        for name, expected in manifest['files'].items():
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('非法媒体路径')
            original = (source / relative).resolve()
            if not original.is_relative_to(source):
                raise ValueError('媒体路径超出源目录')
            data = original.read_bytes()
            if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
                raise ValueError('媒体校验失败：' + name)
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        shutil.copyfile(manifest_path, staging / 'manifest.json')
        (staging / 'ATTRIBUTION.md').write_text('Word Atlas contributors — CC BY 4.0\n\nhttps://creativecommons.org/licenses/by/4.0/\n\n' + manifest['repository'] + '/tree/' + manifest['revision'] + '\n', encoding='utf-8')
        staging.rename(output)
        print(json.dumps({'ok': True, 'revision': manifest['revision'], 'files': len(manifest['files']), 'output': str(output)}, ensure_ascii=False))
    finally:
        # 只清理由本次 mkdtemp 创建、已核实位于目标父目录的临时目录。
        if staging.exists() and staging.resolve().parent == output.parent:
            shutil.rmtree(staging)


if __name__ == '__main__':
    main()
