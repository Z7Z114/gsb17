import React, { useState, useEffect } from 'react';
import { Row, Col, Card, List, Tag, Button, Space } from 'antd';
import {
  DatabaseOutlined,
  RiseOutlined,
  AudioOutlined,
  SendOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getLogs, getDepthSeries, getPendingTransmissions } from '../services/api';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [depthSeries, setDepthSeries] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, depthRes, pendingRes] = await Promise.all([
        getLogs(10),
        getDepthSeries(null, 100),
        getPendingTransmissions(),
      ]);
      setLogs(logsRes.data.logs);
      setDepthSeries(depthRes.data.data);
      setPending(pendingRes.data.pending_logs);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = [
    {
      title: '总钻探日志',
      value: logs.length,
      icon: <DatabaseOutlined style={{ fontSize: 32, color: '#00d4ff' }} />,
    },
    {
      title: '最大钻探深度',
      value: depthSeries.length > 0
        ? `${Math.max(...depthSeries.map(d => d.depth_meters)).toFixed(1)}m`
        : '0m',
      icon: <RiseOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    },
    {
      title: '已处理音频',
      value: logs.length,
      icon: <AudioOutlined style={{ fontSize: 32, color: '#faad14' }} />,
    },
    {
      title: '待传输日志',
      value: pending.length,
      icon: <SendOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />,
    },
  ];

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: 0 }}>数据总览</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
          style={{ background: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff', color: '#00d4ff' }}
        >
          刷新数据
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat, index) => (
          <Col xs={12} sm={12} md={6} key={index}>
            <Card className="ice-card" bordered={false}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="ice-stat-value">{stat.value}</div>
                  <div className="ice-stat-label">{stat.title}</div>
                </div>
                {stat.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card
            className="ice-card"
            title="最近钻探日志"
            bordered={false}
            extra={
              <Button type="link" style={{ color: '#00d4ff' }}>
                查看全部
              </Button>
            }
          >
            <List
              dataSource={logs.slice(0, 5)}
              locale={{ emptyText: '暂无钻探日志' }}
              renderItem={(log) => (
                <List.Item
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '16px 0',
                  }}
                >
                  <List.Item.Meta
                    title={
                      <span style={{ color: '#00d4ff' }}>
                        {log.log_id} - {log.location}
                      </span>
                    }
                    description={
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                          深度: {log.ice_core_data?.depth_meters}m |
                          CO₂: {log.ice_core_data?.co2_concentration}ppm |
                          {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm')}
                        </div>
                        <Space wrap>
                          {log.climate_events?.slice(0, 3).map((event, idx) => (
                            <Tag key={idx} className={`event-tag ${getEventColor(event.event_type)}`}>
                              {event.event_type}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    }
                  />
                  <Tag color={log.transmitted ? 'success' : 'warning'}>
                    {log.transmitted ? '已传输' : '待传输'}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card
            className="ice-card"
            title="待传输日志"
            bordered={false}
            style={{ marginBottom: 16 }}
          >
            <List
              dataSource={pending.slice(0, 5)}
              locale={{ emptyText: '没有待传输的日志' }}
              renderItem={(item) => (
                <List.Item
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '12px 0',
                  }}
                >
                  <List.Item.Meta
                    title={<span style={{ color: '#fff' }}>{item.log_id}</span>}
                    description={
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {item.location} | {dayjs(item.timestamp).format('MM-DD HH:mm')}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card
            className="ice-card"
            title="最新深度数据"
            bordered={false}
          >
            <List
              dataSource={depthSeries.slice(-5).reverse()}
              locale={{ emptyText: '暂无深度数据' }}
              renderItem={(record) => (
                <List.Item
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '12px 0',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#00d4ff', fontWeight: 600 }}>
                        {record.depth_meters}m
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        {dayjs(record.timestamp).format('HH:mm')}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
                      CO₂: {record.co2_concentration}ppm | CH₄: {record.methane_concentration}ppb
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
