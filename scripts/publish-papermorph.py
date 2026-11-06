"""发布 Papermorph 导出的 MP4。密码通过安全输入读取，不写入文件。"""
import argparse
import getpass
import http.cookiejar
import json
from pathlib import Path
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--server', required=True)
    parser.add_argument('--email', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--grade', type=int, default=3)
    args = parser.parse_args()
    if args.file.stat().st_size > 100 * 1024 * 1024:
        parser.error('MP4 exceeds 100 MB')
    base = args.server.rstrip('/')
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    csrf = json.load(client.open(base + '/api/auth/csrf'))['csrfToken']
    login = urllib.parse.urlencode({'email': args.email, 'password': getpass.getpass('Administrator password: '), 'csrfToken': csrf, 'json': 'true', 'callbackUrl': base}).encode()
    client.open(base + '/api/auth/callback/credentials', login)
    session = json.load(client.open(base + '/api/auth/session'))
    if session.get('user', {}).get('role') != 'admin':
        raise RuntimeError('Administrator login required')
    metadata = {'title': args.title, 'grade': args.grade, 'published': False}
    request = urllib.request.Request(base + '/api/videos', args.file.read_bytes(), headers={
        'Content-Type': 'video/mp4', 'X-Video-Metadata': urllib.parse.quote(json.dumps(metadata))})
    result = json.load(client.open(request, timeout=180))
    print(base + '/videos?id=' + result['id'])


if __name__ == '__main__':
    main()
