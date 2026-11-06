"""受约束的 Papermorph 分镜 -> Edge TTS -> 逐帧 MP4。独立容器串行渲染。"""
import ast
import asyncio
import fcntl
import functools
import hashlib
import http.server
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time

import edge_tts
from playwright.async_api import async_playwright

ROOT = Path(os.environ.get('VIDEO_DATA_DIR', '/data'))
JOBS = ROOT / 'video-jobs'
ENGINE = Path(__file__).parent / 'engine'
FPS = 12
ATTEMPTS = {}

def atomic_json(path, value):
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    os.replace(temp, path)

def progress(job, state, percent, **extra):
    atomic_json(job / 'state.json', {'status': state, 'progress': percent, 'heartbeat': time.time(), 'attempt': ATTEMPTS.get(job.name, ''), **extra})

def duration(file):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(file)]).strip())

def verify_arithmetic(text):
    # 纯数字算式的等号两边另行计算核对。代数等式交给分镜模型和原解析。
    source = text.translate(str.maketrans({'−':'-', '×':'*', '÷':'/', '＝':'='}))
    if '=' not in source or any(c not in '0123456789.+-*/()= ' for c in source):
        return
    def value(part):
        tree = ast.parse(part.strip(), mode='eval')
        if len(list(ast.walk(tree))) > 50:
            raise ValueError('INVALID_ARITHMETIC')
        def evaluate(node):
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                return node.value
            if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
                return evaluate(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
            if isinstance(node, ast.BinOp):
                a, b = evaluate(node.left), evaluate(node.right)
                operations = {ast.Add: lambda: a+b, ast.Sub: lambda: a-b, ast.Mult: lambda: a*b, ast.Div: lambda: a/b}
                if type(node.op) in operations:
                    result = operations[type(node.op)]()
                    if not math.isfinite(result) or abs(result) > 1e12:
                        raise ValueError('INVALID_ARITHMETIC')
                    return result
            raise ValueError('INVALID_ARITHMETIC')
        return evaluate(tree.body)
    values = [value(part) for part in source.split('=')]
    if any(not math.isclose(values[0], v, abs_tol=1e-7, rel_tol=1e-7) for v in values[1:]):
        raise ValueError('INVALID_ARITHMETIC')

async def voice(text, name):
    cache = ROOT / 'edge-video-audio'
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(json.dumps(['edge-tts-7.3.1', name, '-10%', text], ensure_ascii=False).encode()).hexdigest()
    file = cache / (key + '.mp3')
    with (cache / (key + '.lock')).open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if file.exists() and file.stat().st_size > 100:
            return file
        temp = file.with_suffix('.tmp')
        try:
            await edge_tts.Communicate(text, name, rate='-10%').save(str(temp))
            if duration(temp) <= 0:
                raise ValueError('EDGE_TTS_FAILED')
            os.replace(temp, file)
        except Exception:
            temp.unlink(missing_ok=True)
            raise ValueError('EDGE_TTS_FAILED') from None
    return file

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def make_page(job, plan, lengths):
    site = job / 'site'
    site.mkdir(exist_ok=True)
    shutil.copytree(ENGINE, site / 'lib', dirs_exist_ok=True)
    (site / 'lib/book.css').write_text(':root{--page:#f0f7ff;--board:#fffaf0;--panel:#eef2ff;--chalk:#172554;--dim:#475569;--task:#b45309;--edge:#cbd5e1;--on-fill:#172554;--vignette:transparent}', encoding='utf-8')
    scene = (Path(__file__).parent / 'scene.js').read_text(encoding='utf-8')
    data = json.dumps(plan, ensure_ascii=False).replace('<', '\u003c')
    timings = {f's{i}': {'dur': d, 'marks': {}, 'cues': [], 'silent': True} for i, d in enumerate(lengths)}
    html = f'<!doctype html><html lang="zh"><head><meta charset="utf-8"><link rel="stylesheet" href="lib/engine.css"><style>#frame{{width:960px!important;height:540px!important}}#stage{{width:960px!important;height:540px!important}}</style></head><body><script src="lib/engine.js"></script><script>const PLAN={data};window.TIMINGS={json.dumps(timings)};{scene}</script></body></html>'
    (site / 'index.html').write_text(html, encoding='utf-8')
    return site

async def render(job, plan):
    if len(plan.get('scenes', [])) not in range(3, 9) or plan.get('voice') not in ('zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'):
        raise ValueError('INVALID_PLAN')
    clips, lengths = [], []
    for i, scene in enumerate(plan['scenes']):
        verify_arithmetic(scene['equation'])
        clip = await asyncio.wait_for(voice(scene['spoken'], plan['voice']), timeout=100)
        clips.append(clip); lengths.append(duration(clip))
        progress(job, 'rendering', round((i+1)/len(plan['scenes'])*20))
    if sum(lengths) > 360:
        raise ValueError('VIDEO_TOO_LONG')
    site = make_page(job, plan, lengths)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    parts = []
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
            try:
                page = await browser.new_page(viewport={'width': 1000, 'height': 700}, device_scale_factor=1)
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                await page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else route.abort())
                await page.goto(f'http://127.0.0.1:{server.server_port}/?beat=0&t=0', wait_until='networkidle')
                if errors:
                    raise ValueError('SCENE_FAILED')
                await page.locator('#stage').wait_for()
                for i, (clip, seconds) in enumerate(zip(clips, lengths)):
                    part = job / f'part-{i}.mp4'; parts.append(part)
                    count = math.ceil((seconds + .6) * FPS)
                    process = subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','pipe:0','-i',str(clip),'-vf','scale=960:540','-c:v','libx264','-threads','1','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-ar','24000','-ac','1','-af','apad=pad_dur=0.6','-t',str(count/FPS),'-movflags','+faststart',str(part)], stdin=subprocess.PIPE)
                    try:
                        for frame in range(count):
                            await page.evaluate('([index,t])=>{seek(index,false);P.t=t;evalTo(t)}', [i, frame/FPS])
                            image = await page.locator('#stage').screenshot(type='png', animations='disabled')
                            process.stdin.write(image)
                            if frame == count // 2:
                                (job / f'preview-{i}.png').write_bytes(image)
                            if frame % 24 == 0:
                                progress(job, 'rendering', 20 + round((i + frame/count)/len(clips)*75))
                    finally:
                        process.stdin.close()
                        try:
                            code = process.wait(timeout=40)
                        except subprocess.TimeoutExpired:
                            process.kill(); process.wait(); raise ValueError('ENCODE_FAILED') from None
                    if code:
                        raise ValueError('ENCODE_FAILED')
                if errors:
                    raise ValueError('SCENE_FAILED')
            finally:
                await browser.close()
    finally:
        server.shutdown(); server.server_close()
    listing = job / 'concat.txt'
    listing.write_text(''.join(f"file '{part.name}'\n" for part in parts), encoding='utf-8')
    temp = job / 'output.tmp.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','1','-i',str(listing),'-c','copy','-movflags','+faststart',str(temp)], check=True, timeout=120)
    if temp.stat().st_size > 100*1024*1024 or duration(temp) < 3:
        raise ValueError('ENCODE_FAILED')
    output = job / 'output.mp4'; os.replace(temp, output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    progress(job, 'completed', 100, sha256=digest)
    for part in parts:
        part.unlink(missing_ok=True)

def run_once(job):
    with (job / 'render.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        state = job / 'state.json'; source = job / 'input.json'
        if state.exists():
            previous = json.loads(state.read_text(encoding='utf-8'))
            if previous.get('status') in ('completed','failed') and state.stat().st_mtime >= source.stat().st_mtime:
                return
        try:
            plan = json.loads(source.read_text(encoding='utf-8'))
            ATTEMPTS[job.name] = plan.get('attempt', '')
            progress(job, 'rendering', 0)
            asyncio.run(asyncio.wait_for(render(job, plan), timeout=1800))
        except Exception as error:
            allowed = ('EDGE_TTS_FAILED','INVALID_ARITHMETIC','INVALID_PLAN','VIDEO_TOO_LONG','SCENE_FAILED','ENCODE_FAILED')
            code = str(error) if str(error) in allowed else 'RENDER_FAILED'
            progress(job, 'failed', 0, error=code)
            print(job.name, code, flush=True)

if __name__ == '__main__':
    JOBS.mkdir(parents=True, exist_ok=True)
    while True:
        for source in sorted(JOBS.glob('*/input.json'), key=lambda p:p.stat().st_mtime):
            if len(source.parent.name) == 64:
                run_once(source.parent)
        time.sleep(2)
