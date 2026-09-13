"""Prepare an isolated review instance. Never changes other applications."""
from pathlib import Path
import json, math, secrets, struct, wave
base = Path('/opt/fiora-review')
(base / 'music').mkdir(parents=True, exist_ok=True)
(base / 'secrets').mkdir(exist_ok=True)
env = base / '.env'
if not env.exists():
    env.write_text('FIORA_JWT_SECRET=' + secrets.token_hex(32) + '\n')
    env.chmod(0o600)
cookie = base / 'secrets/netease-cookie.txt'
if not cookie.exists():
    cookie.write_text('')
    cookie.chmod(0o600)
library = base / 'music/library.json'
if not library.exists():
    tracks = []
    for number, frequency in [(1, 261.63), (2, 329.63), (3, 392.0)]:
        filename = 'review-tone-' + str(number) + '.wav'
        duration, rate = 45, 16000
        with wave.open(str(base / 'music' / filename), 'wb') as out:
            out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
            data = bytearray()
            notes = [1, 1.25, 1.5, 2, 1.5, 1.25]
            for i in range(duration * rate):
                t = i / rate
                envelope = min(1, (t % 1) * 10) * max(0, 1 - (t % 1)) * 0.15
                value = math.sin(2 * math.pi * frequency * notes[int(t) % len(notes)] * t)
                data.extend(struct.pack('<h', int(32767 * envelope * value)))
            out.writeframes(data)
        tracks.append({'id': 'review-' + str(number), 'title': '试听旋律 ' + str(number) + '（测试音）',
            'artist': 'Fiora 合成演示', 'duration': duration, 'file': filename,
            'lyrics': '[00:00.00]欢迎来到一起听\n[00:08.00]每段聊天，都有自己的音乐\n[00:16.00]点歌优先，后续加入队列\n[00:24.00]音量只影响你自己\n[00:32.00]这是一段用于审核的合成测试音'})
    library.write_text(json.dumps(tracks, ensure_ascii=False, indent=2))
print('Review data prepared in /opt/fiora-review; existing data preserved.')

