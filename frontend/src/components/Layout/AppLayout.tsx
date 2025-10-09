// Main Application Layout Component
import React from 'react'
import { Layout, Menu, Typography, theme } from 'antd'
import { BarChartOutlined, ProjectOutlined, DashboardOutlined } from '@ant-design/icons'
// import { SearchOutlined, ApartmentOutlined } from '@ant-design/icons' // 주석처리된 탭용

const { Header, Content, Sider } = Layout
const { Title } = Typography

interface AppLayoutProps {
  children: React.ReactNode
  selectedKey?: string
  onMenuSelect?: (key: string) => void
  showFileTree?: boolean
  fileTreeContent?: React.ReactNode
  fileTreeWidth?: number
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  selectedKey = 'analysis', 
  onMenuSelect,
  showFileTree = false,
  fileTreeContent,
  fileTreeWidth = 300
}) => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: 'analysis',
      icon: <ProjectOutlined />,
      label: '프로젝트 분석',
    },
    {
      key: 'visualization',
      icon: <BarChartOutlined />,
      label: '의존성 그래프',
    },
    // {
    //   key: 'search',
    //   icon: <SearchOutlined />,
    //   label: 'Search',
    // },
    {
      key: 'quality-metrics',
      icon: <DashboardOutlined />,
      label: '품질 메트릭',
    },
    // {
    //   key: 'multi-view',
    //   icon: <ApartmentOutlined />,
    //   label: 'Multi View',
    // },
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
        
        {/* File Tree Sider - 조건부 렌더링 */}
        {showFileTree && (
          <Sider 
            width={fileTreeWidth} 
            style={{ 
              background: colorBgContainer,
              borderRight: '1px solid #f0f0f0'
            }}
            breakpoint="lg"
            collapsedWidth="0"
          >
            {fileTreeContent}
          </Sider>
        )}
        
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