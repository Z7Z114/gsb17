import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Input,
  Form,
  message,
  Progress,
  Descriptions,
  Row,
  Col,
  List,
  Tag,
  Space,
  Typography,
} from 'antd';
import {
  UploadOutlined,
  AudioOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { uploadAudio, processAudio } from '../services/api';

const { Title, Text } = Typography;

export default function AudioUpload() {
  const [form] = Form.useForm();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [audioId, setAudioId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState(null);

  const uploadProps = {
    beforeUpload: (file) => {
      const isAudio = file.type.startsWith('audio/');
      if (!isAudio) {
        message.error('只能上传音频文件!');
        return false;
      }
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error('音频文件不能超过50MB!');
        return false;
      }
      setUploadedFile(file);
      return false;
    },
    fileList: uploadedFile ? [uploadedFile] : [],
    onRemove: () => {
      setUploadedFile(null);
      setAudioId(null);
      setProcessResult(null);
    },
  };

  const handleUploadAndProcess = async (values) => {
    if (!uploadedFile) {
      message.error('请先选择音频文件');
      return;
    }

    try {
      setProcessing(true);
      setProcessProgress(10);

      const uploadRes = await uploadAudio(uploadedFile);
      setAudioId(uploadRes.data.audio_id);
      setProcessProgress(30);

      const progressInterval = setInterval(() => {
        setProcessProgress(prev => Math.min(prev + 5, 80));
      }, 500);

      const processRes = await processAudio(
        uploadRes.data.audio_id,
        values.current_depth,
        values.location
      );

      clearInterval(progressInterval);
      setProcessProgress(100);
      setProcessResult(processRes.data);
      message.success('音频处理完成');
    } catch (error) {
      message.error('处理失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setUploadedFile(null);
    setAudioId(null);
    setProcessResult(null);
    setProcessProgress(0);
  };

  const getSpeakerRoleDisplay = (role) => {
    const roleMap = {
      engineer: { text: '工程师', className: 'speaker-engineer' },
      climatologist: { text: '气候学家', className: 'speaker-climatologist' },
      unknown: { text: '未知', className: 'speaker-unknown' },
    };
    return roleMap[role] || roleMap.unknown;
  };

  const getEventColor = (type) => {
    const colorMap = {
      '冰期': 'event-ice-age',
      '间冰期': 'event-interglacial',
      '火山喷发': 'event-volcano',
      '气候突变': 'event-climate-change',
      '海平面变化': 'event-sea-level',
      '温室效应': 'event-greenhouse',
    };
    return colorMap[type] || 'event-tag';
  };

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>音频处理</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card className="ice-card" title="上传音频" bordered={false}>
            <Form form={form} layout="vertical" onFinish={handleUploadAndProcess}>
              <Form.Item
                name="location"
                label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>钻探位置</span>}
                initialValue="南极Dome A"
              >
                <Input placeholder="请输入钻探位置" />
              </Form.Item>

              <Form.Item
                name="current_depth"
                label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>当前深度 (米)</span>}
                initialValue={100}
              >
                <Input type="number" placeholder="请输入当前钻探深度" />
              </Form.Item>

              <Form.Item
                label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>音频文件</span>}
              >
                <Upload.Dragger {...uploadProps} accept="audio/*" className="upload-area">
                  <p className="ant-upload-drag-icon" style={{ color: '#00d4ff' }}>
                    <AudioOutlined style={{ fontSize: 48 }} />
                  </p>
                  <p className="ant-upload-text" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    点击或拖拽音频文件到此处上传
                  </p>
                  <p className="ant-upload-hint" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    支持 WAV, MP3, M4A 等格式，最大 50MB
                  </p>
                </Upload.Dragger>
              </Form.Item>

              {processing && (
                <Form.Item>
                  <Progress
                    percent={processProgress}
                    strokeColor={{ '0%': '#00d4ff', '100%': '#722ed1' }}
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    正在处理音频，包括声学补偿、语音转写、说话人识别...
                  </Text>
                </Form.Item>
              )}

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={processing}
                    disabled={!uploadedFile}
                    icon={<FileTextOutlined />}
                    style={{ background: 'linear-gradient(135deg, #00d4ff, #722ed1)', border: 'none' }}
                  >
                    开始处理
                  </Button>
                  <Button onClick={resetForm} disabled={processing}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          {processResult ? (
            <div>
              <Card
                className="ice-card"
                title="处理结果"
                bordered={false}
                style={{ marginBottom: 16 }}
              >
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="日志ID" style={{ color: '#00d4ff' }}>
                    {processResult.log_id}
                  </Descriptions.Item>
                  <Descriptions.Item label="音频ID">
                    {processResult.audio_id}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前深度">
                    {processResult.ice_core_data?.depth_meters}m
                  </Descriptions.Item>
                  <Descriptions.Item label="CO₂浓度">
                    {processResult.ice_core_data?.co2_concentration} ppm
                  </Descriptions.Item>
                  <Descriptions.Item label="甲烷浓度">
                    {processResult.ice_core_data?.methane_concentration} ppb
                  </Descriptions.Item>
                  <Descriptions.Item label="估计年代">
                    {processResult.ice_core_data?.estimated_age
                      ? `${processResult.ice_core_data.estimated_age.toLocaleString()} 年`
                      : '未检测到'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {processResult.climate_events?.length > 0 && (
                <Card
                  className="ice-card"
                  title="检测到的气候事件"
                  bordered={false}
                  style={{ marginBottom: 16 }}
                >
                  <List
                    dataSource={processResult.climate_events}
                    renderItem={(event) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <Tag className={`event-tag ${getEventColor(event.event_type)}`}>
                          {event.event_type}
                        </Tag>
                        <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.8)' }}>
                          {event.description}
                        </span>
                        <Tag color="blue" style={{ marginLeft: 'auto' }}>
                          置信度: {(event.confidence * 100).toFixed(0)}%
                        </Tag>
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              {processResult.age_estimates?.length > 0 && (
                <Card
                  className="ice-card"
                  title="年代推断"
                  bordered={false}
                  style={{ marginBottom: 16 }}
                >
                  <List
                    dataSource={processResult.age_estimates}
                    renderItem={(age) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <span style={{ color: '#fa8c16', fontWeight: 600 }}>
                          {age.estimated_years.toLocaleString()} 年
                        </span>
                        <span style={{ marginLeft: 12, color: 'rgba(255,255,255,0.7)' }}>
                          原文: "{age.text}"
                        </span>
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              <Card
                className="ice-card"
                title="语音转写结果"
                bordered={false}
              >
                {processResult.transcript?.length > 0 ? (
                  <div>
                    {processResult.transcript.map((seg, idx) => {
                      const roleInfo = getSpeakerRoleDisplay(seg.speaker_role);
                      return (
                        <div
                          key={idx}
                          className={`transcript-segment ${seg.speaker_role}`}
                        >
                          <div style={{ marginBottom: 4 }}>
                            <span className={roleInfo.className}>
                              [{roleInfo.text}] {seg.speaker}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 8 }}>
                              {seg.start_time.toFixed(1)}s - {seg.end_time.toFixed(1)}s
                            </span>
                            <Tag
                              color="blue"
                              style={{ float: 'right', fontSize: 11 }}
                            >
                              {(seg.confidence * 100).toFixed(0)}%
                            </Tag>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.9)' }}>{seg.text}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Text type="secondary">暂无转写结果</Text>
                )}
              </Card>
            </div>
          ) : (
            <Card className="ice-card" bordered={false} style={{ minHeight: 400 }}>
              <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                <AudioOutlined style={{ fontSize: 64, color: 'rgba(0,212,255,0.3)' }} />
                <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 16 }}>
                  上传音频文件后将在此处显示处理结果
                </p>
                <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                  包括语音转写、说话人识别、年代推断、气候事件检测等
                </p>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
