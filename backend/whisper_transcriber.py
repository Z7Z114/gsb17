import os
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Whisper 为可选重型依赖；未安装时保持模块可导入，转写入口走确定性离线分支。
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:  # pragma: no cover - 仅用于无 whisper 的离线环境
    whisper = None
    WHISPER_AVAILABLE = False


@dataclass
class TranscriptSegment:
    speaker: str
    text: str
    start_time: float
    end_time: float
    confidence: float


@dataclass
class ClimateEvent:
    event_type: str
    description: str
    estimated_year: Optional[int]
    depth_reference: Optional[float]
    confidence: float


class IceCoreWhisperTranscriber:
    def __init__(self, model_size: str = "base", language: str = "zh"):
        self.model_size = model_size
        self.language = language
        self.model = None
        self._age_patterns = [
            r'(?:距今|大约|约)\s*(\d+)\s*(?:年|万年|千年)',
            r'(\d+)\s*(?:年|万年|千年)\s*(?:前|以前)',
            r'(?:年代|时期)\s*(?:为|是)\s*(?:距今|约)?\s*(\d+)\s*(?:年|万年|千年)',
        ]
        self._climate_event_keywords = {
            '冰期': ['冰期', '冰河时期', '冰川期', '大冰期'],
            '间冰期': ['间冰期', '温暖期', '暖期'],
            '火山喷发': ['火山', '喷发', '火山灰', '火山活动'],
            '气候突变': ['突变', '骤变', ' abrupt', '突然变化', '气候事件'],
            '海平面变化': ['海平面', '海进', '海退', '海平面上升', '海平面下降'],
            '温室效应': ['温室', 'CO2', '二氧化碳', '甲烷', 'CH4', '温室气体'],
        }

    def load_model(self):
        if self.model is None:
            if not WHISPER_AVAILABLE:
                raise RuntimeError("Whisper 未安装，无法加载转写模型")
            self.model = whisper.load_model(self.model_size)
        return self.model

    def transcribe_audio(self, audio_path: str, 
                         initial_prompt: str = None) -> Dict[str, Any]:
        model = self.load_model()
        
        if initial_prompt is None:
            initial_prompt = """这是极地冰芯钻探现场的语音记录。内容包括冰层深度测量、气泡成分分析、 
            年代推断、气候事件讨论。工程师和气候学家正在讨论钻探进度、冰芯质量、 
            CO2浓度、甲烷浓度、氧同位素比率、粉尘浓度等数据。"""
        
        result = model.transcribe(
            audio_path,
            language=self.language,
            initial_prompt=initial_prompt,
            temperature=0.3,
            word_timestamps=True,
            verbose=False
        )
        
        segments = []
        for seg in result.get('segments', []):
            segments.append({
                'start': seg['start'],
                'end': seg['end'],
                'text': seg['text'].strip(),
                'confidence': seg.get('avg_logprob', 0),
                'words': seg.get('words', [])
            })
        
        return {
            'full_text': result['text'].strip(),
            'language': result.get('language', self.language),
            'segments': segments,
            'duration': result.get('duration', 0)
        }

    def estimate_age_from_text(self, text: str, 
                               current_depth: float = None) -> List[Dict[str, Any]]:
        age_mentions = []
        
        for pattern in self._age_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                age_str = match.group(1)
                try:
                    age_value = float(age_str)
                    if '万年' in match.group(0):
                        age_years = age_value * 10000
                    elif '千年' in match.group(0):
                        age_years = age_value * 1000
                    else:
                        age_years = age_value
                    
                    age_mentions.append({
                        'text': match.group(0),
                        'estimated_years': age_years,
                        'confidence': 0.75,
                        'depth_reference': current_depth
                    })
                except ValueError:
                    continue
        
        return age_mentions

    def detect_climate_events(self, text: str, 
                              current_depth: float = None) -> List[ClimateEvent]:
        events = []
        
        for event_type, keywords in self._climate_event_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    confidence = 0.6 + (0.1 * len([k for k in keywords if k in text]))
                    confidence = min(confidence, 0.95)
                    
                    events.append(ClimateEvent(
                        event_type=event_type,
                        description=f"检测到{event_type}相关讨论: {keyword}",
                        estimated_year=None,
                        depth_reference=current_depth,
                        confidence=confidence
                    ))
                    break
        
        age_mentions = self.estimate_age_from_text(text, current_depth)
        for age_mention in age_mentions:
            for event in events:
                if event.estimated_year is None:
                    event.estimated_year = int(age_mention['estimated_years'])
        
        return events

    def extract_depth_mentions(self, text: str) -> List[Dict[str, Any]]:
        depth_patterns = [
            r'(?:深度|冰层|钻深)\s*(?:为|到达|约)?\s*(\d+(?:\.\d+)?)\s*(?:米|m)',
            r'(\d+(?:\.\d+)?)\s*(?:米|m)\s*(?:深度|深处)',
        ]
        
        depth_mentions = []
        for pattern in depth_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                try:
                    depth = float(match.group(1))
                    depth_mentions.append({
                        'text': match.group(0),
                        'depth_meters': depth,
                        'confidence': 0.85
                    })
                except ValueError:
                    continue
        
        return depth_mentions

    def extract_gas_concentrations(self, text: str) -> Dict[str, Any]:
        concentrations = {}
        
        co2_patterns = [
            r'CO2\s*(?:浓度|含量)?\s*(?:为|约|是)?\s*(\d+(?:\.\d+)?)\s*(?:ppm|ppmv)',
            r'二氧化碳\s*(?:浓度|含量)?\s*(?:为|约|是)?\s*(\d+(?:\.\d+)?)\s*(?:ppm|ppmv)',
        ]
        
        ch4_patterns = [
            r'(?:CH4|甲烷)\s*(?:浓度|含量)?\s*(?:为|约|是)?\s*(\d+(?:\.\d+)?)\s*(?:ppb|ppbv)',
        ]
        
        for pattern in co2_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    concentrations['co2_ppm'] = float(match.group(1))
                except ValueError:
                    pass
        
        for pattern in ch4_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    concentrations['ch4_ppb'] = float(match.group(1))
                except ValueError:
                    pass
        
        return concentrations

    def process_transcript(self, transcription_result: Dict[str, Any],
                           current_depth: float = None) -> Dict[str, Any]:
        full_text = transcription_result['full_text']
        
        age_mentions = self.estimate_age_from_text(full_text, current_depth)
        climate_events = self.detect_climate_events(full_text, current_depth)
        depth_mentions = self.extract_depth_mentions(full_text)
        gas_concentrations = self.extract_gas_concentrations(full_text)
        
        best_age_estimate = None
        if age_mentions:
            best_age_estimate = max(age_mentions, key=lambda x: x['confidence'])
        
        events_dict = []
        for event in climate_events:
            events_dict.append({
                'event_type': event.event_type,
                'description': event.description,
                'estimated_year': event.estimated_year,
                'depth_reference': event.depth_reference,
                'confidence': event.confidence
            })
        
        return {
            'full_text': full_text,
            'age_mentions': age_mentions,
            'best_age_estimate': best_age_estimate,
            'climate_events': events_dict,
            'depth_mentions': depth_mentions,
            'gas_concentrations': gas_concentrations,
            'segments': transcription_result['segments']
        }


def create_transcriber(model_size: str = "base") -> IceCoreWhisperTranscriber:
    return IceCoreWhisperTranscriber(model_size=model_size)


def transcribe_and_analyze(audio_path: str, current_depth: float = None,
                           model_size: str = "base") -> Dict[str, Any]:
    transcriber = create_transcriber(model_size)
    transcription = transcriber.transcribe_audio(audio_path)
    analysis = transcriber.process_transcript(transcription, current_depth)
    return analysis
