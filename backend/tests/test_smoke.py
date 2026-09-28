"""冰封纪要冒烟测试：只覆盖顺利路径，用于确认项目可启动、主流程可跑通。"""
import io
import json

import pytest
from fastapi.testclient import TestClient

from main import app
import database


@pytest.fixture()
def client():
    return TestClient(app)


def _sample_log(log_id="LOG_SMOKE_0001"):
    return {
        "log_id": log_id,
        "timestamp": "2026-09-01T08:00:00",
        "location": "南极Dome A",
        "ice_core_data": {
            "depth_meters": 120.5,
            "ice_temperature": -42.0,
            "bubble_density": 0.85,
            "co2_concentration": 285.0,
            "methane_concentration": 720.0,
            "oxygen18_ratio": -35.2,
            "dust_concentration": 0.4,
            "estimated_age": 12000,
        },
        "transcript": [
            {
                "speaker": "SPEAKER_00",
                "speaker_role": "engineer",
                "start_time": 0.0,
                "end_time": 4.0,
                "text": "钻头已更换，当前进尺顺利。",
                "confidence": 0.9,
            },
            {
                "speaker": "SPEAKER_01",
                "speaker_role": "climatologist",
                "start_time": 4.0,
                "end_time": 9.0,
                "text": "这一段CO2浓度与甲烷浓度都偏高。",
                "confidence": 0.88,
            },
        ],
        "climate_events": [
            {
                "event_type": "温室效应",
                "description": "检测到温室效应相关讨论",
                "estimated_year": 12000,
                "depth_reference": 120.5,
                "confidence": 0.7,
            }
        ],
        "summary": None,
        "sample_allocation": None,
        "transmitted": False,
    }


def test_root_status(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


def test_upload_audio_happy_path(client):
    files = {"file": ("drilling_note.wav", io.BytesIO(b"RIFF....WAVE"), "audio/wav")}
    resp = client.post("/api/audio/upload", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["audio_id"]
    assert body["status"] == "success"


def test_add_and_read_depth_series(client):
    record = _sample_log()["ice_core_data"]
    resp = client.post("/api/depth-series", json=record)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    series = client.get("/api/depth-series").json()
    assert series["count"] >= 1
    assert any(item["depth_meters"] == record["depth_meters"] for item in series["data"])


def test_generate_summary_and_read_back(client):
    database.save_drilling_log(_sample_log("LOG_SMOKE_SUMMARY"))

    resp = client.post("/api/logs/LOG_SMOKE_SUMMARY/summarize")
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]
    assert body["sample_allocation"]

    detail = client.get("/api/logs/LOG_SMOKE_SUMMARY").json()
    assert detail["summary"]
    assert detail["sample_allocation"]


def test_list_logs(client):
    database.save_drilling_log(_sample_log("LOG_SMOKE_LIST"))
    resp = client.get("/api/logs", params={"limit": 50})
    assert resp.status_code == 200
    assert "logs" in resp.json()


def test_speaker_profiles_reset(client):
    assert client.post("/api/speaker/reset").status_code == 200
    assert client.get("/api/speaker/profiles").status_code == 200


def test_pending_and_history(client):
    assert client.get("/api/transmission/pending").status_code == 200
    assert client.get("/api/transmission/history").status_code == 200
