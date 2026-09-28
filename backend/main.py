import os
import uuid
import tempfile
from datetime import datetime
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil

from models import (
    IceCoreData,
    DrillingLog,
    AudioUploadResponse,
    SummaryResponse,
    TransmissionStatus
)
from database import (
    init_database,
    save_drilling_log,
    get_drilling_log,
    get_all_drilling_logs,
    save_ice_core_depth_record,
    get_ice_core_depth_series,
    update_transmission_status,
    get_pending_transmissions
)
from audio_processor import create_compensator
from whisper_transcriber import create_transcriber
from speaker_diarizer import create_diarizer
from ai_summarizer import create_summarizer
from iridium_transmitter import create_transmitter

load_dotenv()

app = FastAPI(
    title="冰封纪要 - 极地冰芯钻探系统",
    description="极地冰芯钻探队的综合数据采集与分析平台",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_database()

audio_compensator = create_compensator(
    altitude=float(os.getenv('ALTITUDE_METERS', '3500')),
    temperature=float(os.getenv('TEMPERATURE_CELSIUS', '-40'))
)

transcriber = create_transcriber(model_size="base")
diarizer = create_diarizer(auth_token=os.getenv('PYANNOTE_AUTH_TOKEN'))
summarizer = create_summarizer(api_key=os.getenv('OPENAI_API_KEY'))
transmitter = create_transmitter()

AUDIO_UPLOAD_DIR = os.getenv('ICE_CORE_AUDIO_DIR') or os.path.join(tempfile.gettempdir(), "ice_core_audio")
os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    transmitter.start_scheduled_transmission(
        interval_minutes=60,
        get_pending_logs=get_pending_transmissions,
        update_status=update_transmission_status
    )


@app.on_event("shutdown")
async def shutdown_event():
    transmitter.stop_scheduled_transmission()


@app.get("/")
async def root():
    return {
        "name": "冰封纪要 - 极地冰芯钻探系统",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/audio/upload", response_model=AudioUploadResponse)
async def upload_audio(file: UploadFile = File(...)):
    audio_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1] if file.filename else '.wav'
    original_path = os.path.join(AUDIO_UPLOAD_DIR, f"{audio_id}_original{file_ext}")
    
    try:
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return AudioUploadResponse(
            audio_id=audio_id,
            status="success",
            message=f"音频文件已上传，ID: {audio_id}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"音频上传失败: {str(e)}")


@app.post("/api/audio/process/{audio_id}")
async def process_audio(audio_id: str, background_tasks: BackgroundTasks,
                        current_depth: Optional[float] = None,
                        location: str = "Unknown"):
    original_path = None
    for f in os.listdir(AUDIO_UPLOAD_DIR):
        if f.startswith(f"{audio_id}_original"):
            original_path = os.path.join(AUDIO_UPLOAD_DIR, f)
            break
    
    if not original_path or not os.path.exists(original_path):
        raise HTTPException(status_code=404, detail="音频文件不存在")
    
    try:
        processed_path, compensation_stats = audio_compensator.process_audio_file(original_path)
        
        transcription_result = transcriber.transcribe_audio(processed_path)
        analysis_result = transcriber.process_transcript(transcription_result, current_depth)
        
        transcript_segments = analysis_result['segments']
        speaker_segments = diarizer.diarize_audio(processed_path, transcript_segments)
        
        labeled_transcript = []
        for seg in speaker_segments:
            labeled_transcript.append({
                'speaker': seg.speaker_id,
                'speaker_role': seg.speaker_role,
                'start_time': seg.start_time,
                'end_time': seg.end_time,
                'text': seg.text,
                'confidence': seg.confidence
            })
        
        ice_core_data = {
            'depth_meters': current_depth or 0,
            'ice_temperature': float(os.getenv('TEMPERATURE_CELSIUS', '-40')),
            'bubble_density': 0.85,
            'co2_concentration': analysis_result['gas_concentrations'].get('co2_ppm', 280.0),
            'methane_concentration': analysis_result['gas_concentrations'].get('ch4_ppb', 700.0),
            'oxygen18_ratio': -35.0,
            'dust_concentration': 0.5,
            'estimated_age': analysis_result['best_age_estimate']['estimated_years'] if analysis_result['best_age_estimate'] else None
        }
        
        log_id = f"LOG_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        log_entry = {
            'log_id': log_id,
            'timestamp': datetime.now().isoformat(),
            'location': location,
            'ice_core_data': ice_core_data,
            'transcript': labeled_transcript,
            'climate_events': analysis_result['climate_events'],
            'transmitted': False
        }
        
        save_drilling_log(log_entry)
        save_ice_core_depth_record({
            'log_id': log_id,
            **ice_core_data,
            'timestamp': datetime.now().isoformat()
        })
        
        return {
            'log_id': log_id,
            'audio_id': audio_id,
            'status': 'processed',
            'compensation_stats': compensation_stats,
            'transcript': labeled_transcript,
            'climate_events': analysis_result['climate_events'],
            'ice_core_data': ice_core_data,
            'age_estimates': analysis_result['age_mentions']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"音频处理失败: {str(e)}")


@app.post("/api/logs/{log_id}/summarize", response_model=SummaryResponse)
async def generate_summary(log_id: str):
    log_data = get_drilling_log(log_id)
    if not log_data:
        raise HTTPException(status_code=404, detail="日志不存在")
    
    try:
        summary_result = summarizer.generate_summary(
            log_data['ice_core_data'],
            log_data['transcript'],
            log_data['climate_events']
        )
        
        log_data['summary'] = summary_result.summary_text
        log_data['sample_allocation'] = summary_result.sample_allocation
        log_data['key_findings'] = summary_result.key_findings
        log_data['recommendations'] = summary_result.recommendations
        
        save_drilling_log(log_data)
        
        return SummaryResponse(
            log_id=log_id,
            summary=summary_result.summary_text,
            sample_allocation=summary_result.sample_allocation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"摘要生成失败: {str(e)}")


@app.get("/api/logs")
async def list_logs(limit: int = 100):
    logs = get_all_drilling_logs(limit)
    return {
        'count': len(logs),
        'logs': logs
    }


@app.get("/api/logs/{log_id}")
async def get_log(log_id: str):
    log_data = get_drilling_log(log_id)
    if not log_data:
        raise HTTPException(status_code=404, detail="日志不存在")
    return log_data


@app.post("/api/logs/{log_id}/transmit", response_model=TransmissionStatus)
async def transmit_log(log_id: str):
    log_data = get_drilling_log(log_id)
    if not log_data:
        raise HTTPException(status_code=404, detail="日志不存在")
    
    if not log_data.get('summary'):
        raise HTTPException(status_code=400, detail="请先生成摘要后再传输")
    
    try:
        result = transmitter.transmit_log(log_data)
        
        transmission_time = None
        if result['transmission_time']:
            transmission_time = datetime.fromisoformat(result['transmission_time'])
        
        update_transmission_status(
            log_id,
            result['success'],
            transmission_time,
            result['error_message']
        )
        
        return TransmissionStatus(
            log_id=log_id,
            transmitted=result['success'],
            transmission_time=transmission_time,
            error_message=result['error_message']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"传输失败: {str(e)}")


@app.get("/api/depth-series")
async def get_depth_series(log_id: Optional[str] = None, limit: int = 500):
    series = get_ice_core_depth_series(log_id, limit)
    return {
        'count': len(series),
        'data': series
    }


@app.post("/api/depth-series")
async def add_depth_record(record: IceCoreData, log_id: Optional[str] = None):
    try:
        record_dict = record.dict()
        record_dict['log_id'] = log_id or f"MANUAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        record_dict['timestamp'] = datetime.now().isoformat()
        
        save_ice_core_depth_record(record_dict)
        
        return {
            'status': 'success',
            'message': '深度记录已保存',
            'record': record_dict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@app.get("/api/transmission/pending")
async def get_pending():
    pending = get_pending_transmissions()
    return {
        'count': len(pending),
        'pending_logs': pending
    }


@app.get("/api/transmission/history")
async def get_history():
    history = transmitter.get_transmission_history()
    return {
        'count': len(history),
        'history': history
    }


@app.post("/api/speaker/reset")
async def reset_speaker_profiles():
    diarizer.reset_profiles()
    return {'status': 'success', 'message': '说话人档案已重置'}


@app.get("/api/speaker/profiles")
async def get_speaker_profiles():
    profiles = diarizer.get_speaker_summary()
    return {'profiles': profiles}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
