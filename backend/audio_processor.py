from __future__ import annotations
import os
import tempfile
from typing import Tuple, Dict, Any
from dataclasses import dataclass

# 重型音频依赖在部分环境下不安装；未安装时保持模块可导入，真正调用时才报错。
try:
    import numpy as np
    import librosa
    import soundfile as sf
    AUDIO_LIBS_AVAILABLE = True
except ImportError:  # pragma: no cover - 仅用于无 librosa 的离线环境
    np = None
    librosa = None
    sf = None
    AUDIO_LIBS_AVAILABLE = False


def require_audio_libs():
    if not AUDIO_LIBS_AVAILABLE:
        raise RuntimeError("音频处理依赖（numpy/librosa/soundfile）未安装，无法进行声学补偿")


@dataclass
class AudioCompensationConfig:
    altitude_meters: float = 3500.0
    temperature_celsius: float = -40.0
    pressure_atm: float = 0.64
    target_sampling_rate: int = 16000


class HighAltitudeAudioCompensator:
    def __init__(self, config: AudioCompensationConfig = None):
        self.config = config or AudioCompensationConfig()
        self.speed_ofsound_correction = self._calculate_sound_speed_correction()
        self.high_freq_attenuation = self._calculate_high_freq_attenuation()
        
    def _calculate_sound_speed_correction(self) -> float:
        import math
        temp_kelvin = self.config.temperature_celsius + 273.15
        standard_speed = 343.0
        actual_speed = 20.05 * math.sqrt(temp_kelvin)
        return standard_speed / actual_speed
    
    def _calculate_high_freq_attenuation(self) -> Dict[str, float]:
        altitude_factor = 1 + (self.config.altitude_meters / 5000.0)
        temp_factor = 1 + abs(self.config.temperature_celsius) / 100.0
        return {
            'low_band': 0.98,
            'mid_band': 1.05 * altitude_factor,
            'high_band': 1.15 * altitude_factor * temp_factor
        }
    
    def _adaptive_noise_reduction(self, y: np.ndarray, sr: int) -> np.ndarray:
        noise_sample = y[:int(sr * 0.5)]
        noise_reduced = librosa.effects.decompose(y, n_components=50)[0]
        return noise_reduced
    
    def _frequency_equalization(self, y: np.ndarray, sr: int) -> np.ndarray:
        D = librosa.stft(y)
        mag, phase = librosa.magphase(D)
        
        freq_bins = librosa.fft_frequencies(sr=sr)
        
        low_mask = freq_bins < 500
        mid_mask = (freq_bins >= 500) & (freq_bins < 4000)
        high_mask = freq_bins >= 4000
        
        mag[low_mask] *= self.high_freq_attenuation['low_band']
        mag[mid_mask] *= self.high_freq_attenuation['mid_band']
        mag[high_mask] *= self.high_freq_attenuation['high_band']
        
        D_compensated = mag * phase
        y_compensated = librosa.istft(D_compensated)
        
        return y_compensated
    
    def _time_stretch_correction(self, y: np.ndarray, sr: int) -> np.ndarray:
        if abs(self.speed_ofsound_correction - 1.0) < 0.01:
            return y
        return librosa.effects.time_stretch(y, rate=self.speed_ofsound_correction)
    
    def _normalize_audio(self, y: np.ndarray) -> np.ndarray:
        y_normalized = librosa.util.normalize(y)
        return y_normalized
    
    def process_audio_file(self, input_path: str, output_dir: str = None) -> Tuple[str, Dict[str, Any]]:
        require_audio_libs()
        y, sr = librosa.load(input_path, sr=None)
        
        if sr != self.config.target_sampling_rate:
            y = librosa.resample(y, orig_sr=sr, target_sr=self.config.target_sampling_rate)
            sr = self.config.target_sampling_rate
        
        y_processed = self._adaptive_noise_reduction(y, sr)
        y_processed = self._frequency_equalization(y_processed, sr)
        y_processed = self._time_stretch_correction(y_processed, sr)
        y_processed = self._normalize_audio(y_processed)
        
        processing_stats = {
            'original_duration': librosa.get_duration(y=y, sr=sr),
            'processed_duration': librosa.get_duration(y=y_processed, sr=sr),
            'sampling_rate': sr,
            'altitude_correction_applied': self.speed_ofsound_correction,
            'high_freq_boost': self.high_freq_attenuation,
            'rms_original': float(np.sqrt(np.mean(y**2))),
            'rms_processed': float(np.sqrt(np.mean(y_processed**2)))
        }
        
        if output_dir is None:
            output_dir = tempfile.gettempdir()
        
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(output_dir, f"{base_name}_compensated.wav")
        
        sf.write(output_path, y_processed, sr)
        
        return output_path, processing_stats
    
    def extract_audio_features(self, audio_path: str) -> Dict[str, Any]:
        require_audio_libs()
        y, sr = librosa.load(audio_path, sr=self.config.target_sampling_rate)
        
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)
        rms = librosa.feature.rms(y=y)
        
        return {
            'mfcc_mean': mfccs.mean(axis=1).tolist(),
            'mfcc_std': mfccs.std(axis=1).tolist(),
            'spectral_centroid_mean': float(spectral_centroid.mean()),
            'spectral_bandwidth_mean': float(spectral_bandwidth.mean()),
            'zero_crossing_rate_mean': float(zero_crossing_rate.mean()),
            'rms_mean': float(rms.mean()),
            'duration': float(librosa.get_duration(y=y, sr=sr))
        }


def create_compensator(altitude: float = 3500.0, temperature: float = -40.0) -> HighAltitudeAudioCompensator:
    config = AudioCompensationConfig(
        altitude_meters=altitude,
        temperature_celsius=temperature
    )
    return HighAltitudeAudioCompensator(config)


def process_audio_file(input_path: str, output_path: str = None,
                       altitude: float = 3500, temperature: float = -40) -> Dict[str, Any]:
    compensator = create_compensator(altitude, temperature)
    
    processed_path, stats = compensator.process_audio_file(input_path)
    
    if output_path:
        import shutil
        shutil.copy2(processed_path, output_path)
        final_path = output_path
    else:
        final_path = processed_path
    
    features = compensator.extract_audio_features(final_path)
    
    return {
        'processed_audio_path': final_path,
        'compensation_stats': stats,
        'audio_features': features
    }
