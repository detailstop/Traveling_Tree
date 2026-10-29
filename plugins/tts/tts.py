"""
语音朗读模块（后台线程，不阻塞界面）。

朗读路径（按顺序，前一失败则回退）：
  1. edge-tts 在线神经语音：ru-RU-SvetlanaNeural（女声）/ ru-RU-DmitryNeural（男声），
     效果最自然；生成 mp3 后用系统 MediaPlayer 播放（纯标准库 + edge_tts）。
  2. 经典 SAPI 俄语语音：优先 RHVoice（若已安装），否则 Microsoft Irina。

edge-tts 需联网；离线或失败时自动落到 SAPI 路径，保证始终能发声。
"""

import hashlib
import os
import subprocess
import sys
import threading

import config

_VOICE = "ru-RU-SvetlanaNeural"  # 也可改 ru-RU-DmitryNeural
VOICE_CACHE_DIR = config.DATA_DIR / "voice_cache"  # 语音缓存目录


def _esc(text: str) -> str:
    """折叠空白并转义单引号，安全嵌入 PowerShell 单引号字符串。"""
    return " ".join(text.split()).replace("'", "''")


_SAPI = (
    "Add-Type -AssemblyName System.Speech;"
    "$t='__TEXT__';"
    "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
    "$pick=$null;"
    "foreach($v in $s.GetInstalledVoices()){if($v.Enabled -and $v.VoiceInfo.Culture.Name -like 'ru-*' -and $v.VoiceInfo.Name -match 'RHVoice'){$pick=$v.VoiceInfo.Name;break}};"
    "if(-not $pick){foreach($v in $s.GetInstalledVoices()){if($v.Enabled -and $v.VoiceInfo.Culture.Name -like 'ru-*'){$pick=$v.VoiceInfo.Name;break}}};"
    "if($pick){$s.SelectVoice($pick)};"
    "$s.Speak($t)"
)


def speak(text: str, on_done=None) -> None:
    """异步朗读文本；文本为空则忽略，不阻塞调用方。
    on_done（可选）在朗读结束（成功或回退后）于后台线程回调，
    调用方需自行用 GUI 的 after 切回主线程更新界面。
    """
    if not text:
        return
    threading.Thread(target=_speak_sync, args=(text, on_done), daemon=True).start()


def _run(script: str) -> int:
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            timeout=120,
            check=False,
        )
        return r.returncode
    except Exception:
        return 2


def _play_file(path: str) -> None:
    """用系统 MediaPlayer 播放音频文件（mp3/wav）。"""
    p = path.replace("'", "''")
    script = (
        "Add-Type -AssemblyName PresentationCore;"
        "$p=New-Object Windows.Media.MediaPlayer;$p.Open([Uri]'%s');$p.Play();"
        "for($i=0;$i -lt 300 -and -not $p.NaturalDuration.HasTimeSpan;$i++){Start-Sleep -Milliseconds 50};"
        "$ms=$p.NaturalDuration.TimeSpan.TotalMilliseconds;Start-Sleep -Milliseconds ($ms+200);$p.Close()"
    ) % p
    _run(script)


def cache_path(text: str) -> str:
    """根据语音+文本生成缓存文件路径（md5 命名，复用同一句子的音频）。"""
    key = hashlib.md5((_VOICE + "|" + text).encode("utf-8")).hexdigest()
    return str(VOICE_CACHE_DIR / (key + ".mp3"))


def clear_cache():
    """清除语音缓存目录中的所有音频文件，返回 (删除数量, 释放的 MB 数)。"""
    n = 0
    size = 0.0
    try:
        if VOICE_CACHE_DIR.is_dir():
            for f in VOICE_CACHE_DIR.glob("*.mp3"):
                try:
                    size += f.stat().st_size / 1048576.0
                    f.unlink()
                    n += 1
                except OSError:
                    pass
    except Exception:
        pass
    return n, round(size, 1)


def ensure_audio(text: str) -> str | None:
    """确保缓存中存在该文本的语音文件，返回 mp3 路径（不播放）。

    命中缓存秒回；否则用 edge-tts 联网合成后入库。
    供 Web 端 /api/tts 使用：浏览器拿到路径对应的音频自行播放。
    """
    if not text:
        return None
    path = cache_path(text)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    try:
        VOICE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(
            [sys.executable, "-m", "edge_tts", "--voice", _VOICE,
             "--text", text, "--write-media", path],
            capture_output=True, timeout=90,
        )
        if r.returncode == 0 and os.path.getsize(path) > 0:
            return path
        return None
    except Exception:
        return None


def _edge_speak(text: str) -> bool:
    """edge-tts 合成（带缓存）并播放；成功返回 True，否则 False。"""
    path = cache_path(text)
    # 命中缓存：免联网、直接播放
    if os.path.exists(path) and os.path.getsize(path) > 0:
        _play_file(path)
        return True
    try:
        VOICE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(
            [sys.executable, "-m", "edge_tts", "--voice", _VOICE,
             "--text", text, "--write-media", path],
            capture_output=True, timeout=90,
        )
        if r.returncode == 0 and os.path.getsize(path) > 0:
            _play_file(path)
            return True
        return False
    except Exception:
        return False


def _speak_sync(text: str, on_done=None) -> None:
    try:
        if _edge_speak(text):          # 1) edge-tts 神经音
            return
        _run(_SAPI.replace("__TEXT__", _esc(text)))  # 2) SAPI 回退
    except Exception:
        pass
    finally:
        if on_done:
            try:
                on_done()
            except Exception:
                pass
