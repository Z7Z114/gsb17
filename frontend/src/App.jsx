import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  AudioOutlined,
  RiseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard.jsx';
import DrillingLogs from './pages/DrillingLogs.jsx';
import AudioUpload from './pages/AudioUpload.jsx';
import DepthCharts from './pages/DepthCharts.jsx';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: '1', icon: <DashboardOutlined />, label: '数据总览' },
  { key: '2', icon: <RiseOutlined />, label: '深度与气泡图表' },
  { key: '3', icon: <FileTextOutlined />, label: '钻探日志' },
  { key: '4', icon: <AudioOutlined />, label: '音频处理' },
];

export default function App() {
  const [currentPage, setCurrentPage] = React.useState('1');

  const renderPage = () => {
    switch (currentPage) {
      case '1':
        return <Dashboard />;
      case '2':
        return <DepthCharts />;
      case '3':
        return <DrillingLogs />;
      case '4':
        return <AudioUpload />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout className="app-container" style={{ minHeight: '100vh' }}>
      <Header className="ice-header" style={{ padding: '0 24px' }}>
        <div className="ice-logo" style={{ float: 'left' }}>
          ❄️ 冰封纪要
        </div>
        <div style={{ float: 'right', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
          极地冰芯钻探数据系统 v1.0
        </div>
      </Header>
      <Layout>
        <Sider
          width={220}
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            onClick={({ key }) => setCurrentPage(key)}
            style={{
              background: 'transparent',
              borderRight: 'none',
              paddingTop: '20px',
            }}
            items={menuItems.map(item => ({
              ...item,
              style: { color: 'rgba(255,255,255,0.7)' },
            }))}
          />
        </Sider>
        <Layout>
          <Content className="ice-content">
            {renderPage()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
