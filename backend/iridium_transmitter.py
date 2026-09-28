import os
import smtplib
import ssl
import json
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

# 定时调度器为可选依赖；未安装时不影响单次传输接口。
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    SCHEDULER_AVAILABLE = True
except ImportError:  # pragma: no cover - 仅用于无 apscheduler 的离线环境
    BackgroundScheduler = None
    SCHEDULER_AVAILABLE = False


@dataclass
class TransmissionConfig:
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_password: str
    receiver_email: str
    use_ssl: bool = True
    max_message_size: int = 2000
    retry_attempts: int = 3
    retry_delay: int = 30


class IridiumSatelliteTransmitter:
    def __init__(self, config: TransmissionConfig = None):
        self.config = config or self._load_config_from_env()
        self.scheduler = None
        self._transmission_history = []
    
    def _load_config_from_env(self) -> TransmissionConfig:
        return TransmissionConfig(
            smtp_server=os.getenv('IRIDIUM_SMTP_SERVER', 'smtp.iridium.net'),
            smtp_port=int(os.getenv('IRIDIUM_SMTP_PORT', '465')),
            sender_email=os.getenv('IRIDIUM_EMAIL', 'drilling_team@iridium.net'),
            sender_password=os.getenv('IRIDIUM_SMTP_PASSWORD', ''),
            receiver_email=os.getenv('BASE_STATION_EMAIL', 'research_base@arctic-institute.edu'),
            use_ssl=True,
            max_message_size=2000,
            retry_attempts=3,
            retry_delay=30
        )
    
    def _format_message_for_iridium(self, log_data: Dict[str, Any]) -> Dict[str, Any]:
        """为铱星链路优化消息格式，压缩数据大小"""
        
        compressed = {
            'id': log_data.get('log_id', ''),
            'ts': log_data.get('timestamp', datetime.now().isoformat()),
            'loc': log_data.get('location', ''),
            'depth': log_data.get('ice_core_data', {}).get('depth_meters', 0),
            'temp': log_data.get('ice_core_data', {}).get('ice_temperature', 0),
            'co2': log_data.get('ice_core_data', {}).get('co2_concentration', 0),
            'ch4': log_data.get('ice_core_data', {}).get('methane_concentration', 0),
            'age': log_data.get('ice_core_data', {}).get('estimated_age', None),
            'events': [
                {
                    't': e.get('event_type', ''),
                    'd': e.get('depth_reference', None),
                    'c': e.get('confidence', 0)
                }
                for e in log_data.get('climate_events', [])
            ],
            'summary': log_data.get('summary', '')[:1000],
            'key_findings': log_data.get('key_findings', [])[:5],
            'alloc': log_data.get('sample_allocation', {}),
            'rec': log_data.get('recommendations', [])[:3]
        }
        
        return compressed
    
    def _build_email_message(self, log_data: Dict[str, Any]) -> MIMEMultipart:
        message = MIMEMultipart()
        message['From'] = self.config.sender_email
        message['To'] = self.config.receiver_email
        message['Subject'] = f"[冰芯钻探] {log_data.get('log_id', 'UNKNOWN')} - 深度: {log_data.get('ice_core_data', {}).get('depth_meters', 0)}m"
        
        compressed_data = self._format_message_for_iridium(log_data)
        
        body = f"""冰封纪要 - 钻探日志传输
===============================
日志ID: {compressed_data['id']}
时间: {compressed_data['ts']}
位置: {compressed_data['loc']}
钻探深度: {compressed_data['depth']} 米
冰层温度: {compressed_data['temp']}°C
CO2浓度: {compressed_data['co2']} ppm
甲烷浓度: {compressed_data['ch4']} ppb
估计年代: {compressed_data['age'] if compressed_data['age'] else '待分析'} 年

检测到的气候事件:
{chr(10).join([f"- {e['t']} (深度: {e['d']}m, 置信度: {e['c']:.2f})" for e in compressed_data['events']]) if compressed_data['events'] else '无'}

摘要:
{compressed_data['summary']}

关键发现:
{chr(10).join([f"- {f}" for f in compressed_data['key_findings']])}

建议:
{chr(10).join([f"- {r}" for r in compressed_data['rec']])}

---
通过铱星卫星链路传输
冰封纪要系统 v1.0
"""
        
        message.attach(MIMEText(body, 'plain', 'utf-8'))
        
        json_attachment = MIMEBase('application', 'json')
        json_attachment.set_payload(json.dumps(compressed_data, ensure_ascii=False, indent=2))
        encoders.encode_base64(json_attachment)
        json_attachment.add_header(
            'Content-Disposition',
            f'attachment; filename=drilling_log_{compressed_data["id"]}.json'
        )
        message.attach(json_attachment)
        
        return message
    
    def _connect_to_smtp(self) -> Optional[smtplib.SMTP]:
        for attempt in range(self.config.retry_attempts):
            try:
                if self.config.use_ssl:
                    context = ssl.create_default_context()
                    server = smtplib.SMTP_SSL(
                        self.config.smtp_server,
                        self.config.smtp_port,
                        context=context,
                        timeout=60
                    )
                else:
                    server = smtplib.SMTP(
                        self.config.smtp_server,
                        self.config.smtp_port,
                        timeout=60
                    )
                    server.starttls()
                
                if self.config.sender_password:
                    server.login(self.config.sender_email, self.config.sender_password)
                
                return server
            except Exception as e:
                print(f"SMTP连接失败 (尝试 {attempt + 1}/{self.config.retry_attempts}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None
    
    def transmit_log(self, log_data: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            'log_id': log_data.get('log_id', ''),
            'success': False,
            'transmission_time': None,
            'error_message': None,
            'retry_count': 0
        }
        
        for attempt in range(self.config.retry_attempts):
            try:
                server = self._connect_to_smtp()
                if server is None:
                    raise Exception("无法连接到SMTP服务器")
                
                message = self._build_email_message(log_data)
                server.sendmail(
                    self.config.sender_email,
                    [self.config.receiver_email],
                    message.as_string()
                )
                server.quit()
                
                result['success'] = True
                result['transmission_time'] = datetime.now().isoformat()
                result['retry_count'] = attempt
                
                self._transmission_history.append(result)
                return result
                
            except Exception as e:
                error_msg = str(e)
                print(f"传输失败 (尝试 {attempt + 1}/{self.config.retry_attempts}): {error_msg}")
                result['error_message'] = error_msg
                result['retry_count'] = attempt + 1
                
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return result
    
    def transmit_batch(self, logs_batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for log_data in logs_batch:
            result = self.transmit_log(log_data)
            results.append(result)
            if result['success']:
                time.sleep(5)
        
        return results
    
    def start_scheduled_transmission(self, interval_minutes: int = 60, 
                                     get_pending_logs=None,
                                     update_status=None):
        if not SCHEDULER_AVAILABLE:
            print("警告: 未安装 apscheduler，定时传输任务未启动")
            return
        if self.scheduler is None:
            self.scheduler = BackgroundScheduler(timezone="UTC")
            
            def scheduled_job():
                print(f"[{datetime.now()}] 启动定时传输任务...")
                if get_pending_logs:
                    pending_logs = get_pending_logs()
                    if pending_logs:
                        print(f"发现 {len(pending_logs)} 条待传输日志")
                        results = self.transmit_batch(pending_logs)
                        if update_status:
                            for result in results:
                                update_status(
                                    result['log_id'],
                                    result['success'],
                                    result['transmission_time'],
                                    result['error_message']
                                )
                    else:
                        print("没有待传输的日志")
            
            self.scheduler.add_job(
                scheduled_job,
                'interval',
                minutes=interval_minutes,
                next_run_time=datetime.now()
            )
            self.scheduler.start()
            print(f"定时传输任务已启动，间隔 {interval_minutes} 分钟")
    
    def stop_scheduled_transmission(self):
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown()
            print("定时传输任务已停止")
    
    def get_transmission_history(self) -> List[Dict[str, Any]]:
        return self._transmission_history.copy()


def create_transmitter() -> IridiumSatelliteTransmitter:
    return IridiumSatelliteTransmitter()


def transmit_drilling_log(log_data: Dict[str, Any]) -> Dict[str, Any]:
    transmitter = create_transmitter()
    return transmitter.transmit_log(log_data)
