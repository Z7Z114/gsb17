import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Select, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getDepthSeries, getLogs } from '../services/api';

const { Option } = Select;

export default function DepthCharts() {
  const [depthSeries, setDepthSeries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, depthRes] = await Promise.all([
        getLogs(50),
        getDepthSeries(selectedLogId, 500),
      ]);
      setLogs(logsRes.data.logs);
      setDepthSeries(depthRes.data.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLogId]);

  const sortedData = [...depthSeries].sort((a, b) => a.depth_meters - b.depth_meters);

  const depthTemperatureOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      textStyle: { color: '#fff' },
    },
    grid: { left: '10%', right: '10%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: sortedData.map(d => `${d.depth_meters.toFixed(1)}m`),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.7)', rotate: 45 },
      name: '冰层深度',
      nameTextStyle: { color: 'rgba(255,255,255,0.7)' },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 (°C)',
        axisLine: { lineStyle: { color: '#00d4ff' } },
        axisLabel: { color: '#00d4ff' },
        nameTextStyle: { color: '#00d4ff' },
      },
      {
        type: 'value',
        name: '气泡密度',
        axisLine: { lineStyle: { color: '#faad14' } },
        axisLabel: { color: '#faad14' },
        nameTextStyle: { color: '#faad14' },
      },
    ],
    series: [
      {
        name: '冰层温度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: sortedData.map(d => d.ice_temperature),
        lineStyle: { color: '#00d4ff', width: 2 },
        itemStyle: { color: '#00d4ff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 212, 255, 0)' },
            ],
          },
        },
      },
      {
        name: '气泡密度',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        data: sortedData.map(d => d.bubble_density),
        lineStyle: { color: '#faad14', width: 2 },
        itemStyle: { color: '#faad14' },
      },
    ],
    legend: {
      data: ['冰层温度', '气泡密度'],
      textStyle: { color: 'rgba(255,255,255,0.7)' },
      top: 0,
    },
  };

  const gasConcentrationOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      textStyle: { color: '#fff' },
    },
    grid: { left: '10%', right: '10%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: sortedData.map(d => `${d.depth_meters.toFixed(1)}m`),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.7)', rotate: 45 },
      name: '冰层深度',
      nameTextStyle: { color: 'rgba(255,255,255,0.7)' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'CO₂ (ppm)',
        axisLine: { lineStyle: { color: '#722ed1' } },
        axisLabel: { color: '#722ed1' },
        nameTextStyle: { color: '#722ed1' },
      },
      {
        type: 'value',
        name: 'CH₄ (ppb)',
        axisLine: { lineStyle: { color: '#52c41a' } },
        axisLabel: { color: '#52c41a' },
        nameTextStyle: { color: '#52c41a' },
      },
    ],
    series: [
      {
        name: 'CO₂浓度',
        type: 'bar',
        data: sortedData.map(d => d.co2_concentration),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#722ed1' },
              { offset: 1, color: 'rgba(114, 46, 209, 0.3)' },
            ],
          },
        },
      },
      {
        name: '甲烷浓度',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: sortedData.map(d => d.methane_concentration),
        lineStyle: { color: '#52c41a', width: 2 },
        itemStyle: { color: '#52c41a' },
      },
    ],
    legend: {
      data: ['CO₂浓度', '甲烷浓度'],
      textStyle: { color: 'rgba(255,255,255,0.7)' },
      top: 0,
    },
  };

  const isotopeDustOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      textStyle: { color: '#fff' },
    },
    grid: { left: '10%', right: '10%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: sortedData.map(d => `${d.depth_meters.toFixed(1)}m`),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.7)', rotate: 45 },
      name: '冰层深度',
      nameTextStyle: { color: 'rgba(255,255,255,0.7)' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'δ¹⁸O (‰)',
        axisLine: { lineStyle: { color: '#13c2c2' } },
        axisLabel: { color: '#13c2c2' },
        nameTextStyle: { color: '#13c2c2' },
      },
      {
        type: 'value',
        name: '粉尘浓度',
        axisLine: { lineStyle: { color: '#ff4d4f' } },
        axisLabel: { color: '#ff4d4f' },
        nameTextStyle: { color: '#ff4d4f' },
      },
    ],
    series: [
      {
        name: '氧同位素比率',
        type: 'line',
        smooth: true,
        symbol: 'triangle',
        symbolSize: 8,
        data: sortedData.map(d => d.oxygen18_ratio),
        lineStyle: { color: '#13c2c2', width: 2 },
        itemStyle: { color: '#13c2c2' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(19, 194, 194, 0.2)' },
              { offset: 1, color: 'rgba(19, 194, 194, 0)' },
            ],
          },
        },
      },
      {
        name: '粉尘浓度',
        type: 'bar',
        yAxisIndex: 1,
        data: sortedData.map(d => d.dust_concentration),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#ff4d4f' },
              { offset: 1, color: 'rgba(255, 77, 79, 0.3)' },
            ],
          },
        },
      },
    ],
    legend: {
      data: ['氧同位素比率', '粉尘浓度'],
      textStyle: { color: 'rgba(255,255,255,0.7)' },
      top: 0,
    },
  };

  const ageDepthOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const data = params[0];
        if (data.value === null || data.value === undefined) {
          return `${data.name}<br/>年龄: 未测定`;
        }
        return `${data.name}<br/>年龄: ${data.value.toLocaleString()} 年`;
      },
    },
    grid: { left: '10%', right: '10%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: sortedData.map(d => `${d.depth_meters.toFixed(1)}m`),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.7)', rotate: 45 },
      name: '冰层深度',
      nameTextStyle: { color: 'rgba(255,255,255,0.7)' },
    },
    yAxis: {
      type: 'value',
      name: '估计年龄 (年)',
      axisLine: { lineStyle: { color: '#fa8c16' } },
      axisLabel: {
        color: '#fa8c16',
        formatter: (value) => value >= 10000 ? `${(value/10000).toFixed(1)}万` : value,
      },
      nameTextStyle: { color: '#fa8c16' },
    },
    series: [
      {
        name: '估计年龄',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: sortedData.map(d => d.estimated_age || null),
        lineStyle: { color: '#fa8c16', width: 3, type: 'dashed' },
        itemStyle: { color: '#fa8c16' },
        connectNulls: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(250, 140, 22, 0.2)' },
              { offset: 1, color: 'rgba(250, 140, 22, 0)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: 0 }}>冰层深度与气泡成分图表</h2>
        <Space>
          <Select
            placeholder="选择日志ID"
            style={{ width: 200 }}
            allowClear
            value={selectedLogId}
            onChange={setSelectedLogId}
          >
            {logs.map(log => (
              <Option key={log.log_id} value={log.log_id}>
                {log.log_id} - {log.location}
              </Option>
            ))}
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
            style={{ background: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff', color: '#00d4ff' }}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="ice-card" title="冰层温度与气泡密度" bordered={false}>
            <div className="chart-container">
              <ReactECharts option={depthTemperatureOption} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="ice-card" title="温室气体浓度" bordered={false}>
            <div className="chart-container">
              <ReactECharts option={gasConcentrationOption} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="ice-card" title="氧同位素与粉尘浓度" bordered={false}>
            <div className="chart-container">
              <ReactECharts option={isotopeDustOption} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="ice-card" title="深度-年代关系" bordered={false}>
            <div className="chart-container">
              <ReactECharts option={ageDepthOption} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
