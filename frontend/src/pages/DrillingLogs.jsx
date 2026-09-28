import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Descriptions,
  Row,
  Col,
  List,
  message,
  Empty,
  Spin,
} from 'antd';
import {
  EyeOutlined,
  SendOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getLogs, getLog, generateSummary, transmitLog } from '../services/api';
import dayjs from 'dayjs';

export default function DrillingLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [transmitLoading, setTransmitLoading] = useState({});

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getLogs(100);
      setLogs(res.data.logs);
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const viewLogDetail = async (logId) => {
    try {
      const res = await getLog(logId);
      setSelectedLog(res.data);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('加载日志详情失败');
    }
  };

  const handleGenerateSummary = async (logId) => {
    setSummaryLoading(true);
    try {
      const res = await generateSummary(logId);
      message.success('摘要生成成功');
      setSelectedLog(prev => ({
        ...prev,
        summary: res.data.summary,
        sample_allocation: res.data.sample_allocation,
      }));
      loadLogs();
    } catch (error) {
      message.error('摘要生成失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleTransmit = async (logId) => {
    setTransmitLoading(prev => ({ ...prev, [logId]: true }));
    try {
      const res = await transmitLog(logId);
      if (res.data.transmitted) {
        message.success('日志传输成功');
      } else {
        message.error(`传输失败: ${res.data.error_message}`);
      }
      loadLogs();
    } catch (error) {
      message.error('传输失败');
    } finally {
      setTransmitLoading(prev => ({ ...prev, [logId]: false }));
    }
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

  const columns = [
    {
      title: '日志ID',
      dataIndex: 'log_id',
      key: 'log_id',
      width: 180,
      render: (text) => <span style={{ color: '#00d4ff' }}>{text}</span>,
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 120,
    },
    {
      title: '深度',
      dataIndex: 'ice_core_data',
      key: 'depth',
      width: 100,
      render: (data) => `${data?.depth_meters || 0}m`,
    },
    {
      title: 'CO₂浓度',
      dataIndex: 'ice_core_data',
      key: 'co2',
      width: 100,
      render: (data) => `${data?.co2_concentration || 0} ppm`,
    },
    {
      title: '气候事件',
      dataIndex: 'climate_events',
      key: 'events',
      width: 150,
      render: (events) => (
        <Space wrap>
          {events?.slice(0, 2).map((event, idx) => (
            <Tag key={idx} className={`event-tag ${getEventColor(event.event_type)}`}>
              {event.event_type}
            </Tag>
          ))}
          {events?.length > 2 && <Tag>+{events.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      width: 120,
      render: (summary) => (
        summary ? <Tag color="success">已生成</Tag> : <Tag color="default">未生成</Tag>
      ),
    },
    {
      title: '传输状态',
      dataIndex: 'transmitted',
      key: 'transmitted',
      width: 100,
      render: (transmitted) => (
        transmitted ? <Tag color="success">已传输</Tag> : <Tag color="warning">待传输</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => viewLogDetail(record.log_id)}
            size="small"
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<FileTextOutlined />}
            disabled={!!record.summary}
            onClick={() => handleGenerateSummary(record.log_id)}
            size="small"
          >
            生成摘要
          </Button>
          <Button
            type="link"
            icon={<SendOutlined />}
            disabled={!record.summary || record.transmitted}
            loading={transmitLoading[record.log_id]}
            onClick={() => handleTransmit(record.log_id)}
            size="small"
          >
            传输
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: 0 }}>钻探日志管理</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadLogs}
          loading={loading}
          style={{ background: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff', color: '#00d4ff' }}
        >
          刷新
        </Button>
      </div>

      <Card className="ice-card" bordered={false}>
        <Table
          className="ice-table"
          columns={columns}
          dataSource={logs}
          rowKey="log_id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={
          <span style={{ color: '#00d4ff' }}>
            日志详情 - {selectedLog?.log_id}
          </span>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="summary"
            type="primary"
            icon={<FileTextOutlined />}
            disabled={!!selectedLog?.summary}
            loading={summaryLoading}
            onClick={() => selectedLog && handleGenerateSummary(selectedLog.log_id)}
          >
            生成摘要
          </Button>,
          <Button
            key="transmit"
            type="primary"
            icon={<SendOutlined />}
            disabled={!selectedLog?.summary || selectedLog?.transmitted}
            onClick={() => selectedLog && handleTransmit(selectedLog.log_id)}
          >
            传输日志
          </Button>,
        ]}
      >
        {selectedLog ? (
          <div className="log-detail-container">
            <div>
              <Card
                className="ice-card"
                title="冰芯数据"
                bordered={false}
                style={{ marginBottom: 16 }}
              >
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="钻探深度">
                    {selectedLog.ice_core_data?.depth_meters}m
                  </Descriptions.Item>
                  <Descriptions.Item label="冰层温度">
                    {selectedLog.ice_core_data?.ice_temperature}°C
                  </Descriptions.Item>
                  <Descriptions.Item label="CO₂浓度">
                    {selectedLog.ice_core_data?.co2_concentration} ppm
                  </Descriptions.Item>
                  <Descriptions.Item label="甲烷浓度">
                    {selectedLog.ice_core_data?.methane_concentration} ppb
                  </Descriptions.Item>
                  <Descriptions.Item label="δ¹⁸O比率">
                    {selectedLog.ice_core_data?.oxygen18_ratio}‰
                  </Descriptions.Item>
                  <Descriptions.Item label="粉尘浓度">
                    {selectedLog.ice_core_data?.dust_concentration}
                  </Descriptions.Item>
                  <Descriptions.Item label="气泡密度">
                    {selectedLog.ice_core_data?.bubble_density}
                  </Descriptions.Item>
                  <Descriptions.Item label="估计年代">
                    {selectedLog.ice_core_data?.estimated_age
                      ? `${selectedLog.ice_core_data.estimated_age.toLocaleString()} 年`
                      : '未测定'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card
                className="ice-card"
                title="气候事件"
                bordered={false}
                style={{ marginBottom: 16 }}
              >
                {selectedLog.climate_events?.length > 0 ? (
                  <List
                    dataSource={selectedLog.climate_events}
                    renderItem={(event) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <Tag className={`event-tag ${getEventColor(event.event_type)}`}>
                          {event.event_type}
                        </Tag>
                        <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.8)' }}>
                          {event.description}
                          {event.depth_reference && ` (${event.depth_reference}m)`}
                        </span>
                        <Tag color="blue" style={{ marginLeft: 'auto' }}>
                          置信度: {(event.confidence * 100).toFixed(0)}%
                        </Tag>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="未检测到气候事件" />
                )}
              </Card>

              <Card
                className="ice-card"
                title="AI摘要"
                bordered={false}
                style={{ marginBottom: 16 }}
              >
                {selectedLog.summary ? (
                  <div className="summary-box">{selectedLog.summary}</div>
                ) : (
                  <Empty description="点击上方按钮生成摘要" />
                )}
              </Card>

              {selectedLog.sample_allocation && (
                <Card
                  className="ice-card"
                  title="样品分配方案"
                  bordered={false}
                >
                  <div className="allocation-section">
                    <h4>冰芯段划分</h4>
                    <List
                      dataSource={selectedLog.sample_allocation.core_segments}
                      renderItem={(seg) => (
                        <List.Item style={{ padding: '8px 0' }}>
                          <span style={{ color: '#fff' }}>
                            {seg.start_depth}m - {seg.end_depth}m ({seg.length}m)
                          </span>
                          <Tag
                            className={`priority-${seg.priority === '高' ? 'high' : seg.priority === '中' ? 'medium' : 'low'}`}
                            style={{ marginLeft: 'auto' }}
                          >
                            优先级: {seg.priority}
                          </Tag>
                        </List.Item>
                      )}
                    />
                  </div>
                  <div className="allocation-section">
                    <h4>实验室分配</h4>
                    {selectedLog.sample_allocation.lab_allocations?.map((lab, idx) => (
                      <div key={idx} className="lab-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#00d4ff', fontWeight: 600 }}>{lab.lab}</span>
                          <Tag
                            className={`priority-${lab.priority === '高' ? 'high' : lab.priority === '中' ? 'medium' : 'low'}`}
                          >
                            优先级: {lab.priority}
                          </Tag>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
                          分析项目: {lab.samples?.join(', ')} | 用量: {lab.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div>
              <Card className="ice-card" title="语音转写记录" bordered={false}>
                {selectedLog.transcript?.length > 0 ? (
                  <div>
                    {selectedLog.transcript.map((seg, idx) => {
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
                  <Empty description="暂无转写记录" />
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        )}
      </Modal>
    </div>
  );
}
