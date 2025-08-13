// Main Application Layout Component
import React from 'react'
import { Layout, Menu, Typography, theme } from 'antd'
import { BarChartOutlined, ProjectOutlined, SearchOutlined } from '@ant-design/icons'

const { Header, Content, Sider } = Layout
const { Title } = Typography

interface AppLayoutProps {
  children: React.ReactNode
  selectedKey?: string
  onMenuSelect?: (key: string) => void
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  selectedKey = 'analysis', 
  onMenuSelect 
}) => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: 'analysis',
      icon: <ProjectOutlined />,
      label: 'Project Analysis',
    },
    {
      key: 'visualization',
      icon: <BarChartOutlined />,
      label: 'Dependency Graph',
    },
    {
      key: 'search',
      icon: <SearchOutlined />,
      label: 'Search',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    onMenuSelect?.(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ color: 'white', marginRight: 24 }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            PyView
          </Title>
        </div>
      </Header>
      
      <Layout>
        <Sider 
          width={200} 
          style={{ background: colorBgContainer }}
          breakpoint="lg"
          collapsedWidth="0"
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
            onClick={handleMenuClick}
          />
        </Sider>
        
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default AppLayout