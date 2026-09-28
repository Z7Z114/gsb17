import os
import sys
import tempfile
import pathlib

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# 每次测试会话使用独立的临时数据库与音频目录，避免污染工作区。
_TMP = tempfile.mkdtemp(prefix="ice-core-tests-")
os.environ.setdefault("ICE_CORE_DB_PATH", os.path.join(_TMP, "test.db"))
os.environ["ICE_CORE_DB_PATH"] = os.environ["ICE_CORE_DB_PATH"]
os.environ["ICE_CORE_AUDIO_DIR"] = os.path.join(_TMP, "audio_uploads")
os.makedirs(os.environ["ICE_CORE_AUDIO_DIR"], exist_ok=True)
