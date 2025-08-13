// Graph Visualization Control Panel
import React from 'react'
import { Card, Space, Switch, Slider, Select, Typography, Divider, Button } from 'antd'
import { DownloadOutlined, SettingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const { Option } = Select

interface GraphControlsProps {
  selectedLevel: string
  onLevelChange: (level: string) => void
  nodeSize: number
  onNodeSizeChange: (size: number) => void
  edgeOpacity: number
  onEdgeOpacityChange: (opacity: number) => void
  showLabels: boolean
  onShowLabelsChange: (show: boolean) => void
  layoutMode: string
  onLayoutModeChange: (mode: string) => void
  onExport?: () => void
  onResetLayout?: () => void
}

const GraphControls: React.FC<GraphControlsProps> = ({
  selectedLevel,
  onLevelChange,
  nodeSize,
  onNodeSizeChange,
  edgeOpacity,
  onEdgeOpacityChange,
  showLabels,
  onShowLabelsChange,
  layoutMode,
  onLayoutModeChange,
  onExport,
  onResetLayout
}) => {
  const levelOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 'package', label: 'Package Level' },
    { value: 'module', label: 'Module Level' },
    { value: 'class', label: 'Class Level' },
    { value: 'method', label: 'Method Level' },
    { value: 'field', label: 'Field Level' }
  ]

  const layoutOptions = [
    { value: 'force', label: 'Force-Directed' },
    { value: 'circular', label: 'Circular' },
    { value: 'hierarchical', label: 'Hierarchical' },
    { value: 'grid', label: 'Grid' }
  ]

  return (
    <Card title="Visualization Controls" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Title level={5}>
            <SettingOutlined /> Display Options
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Analysis Level</Text>
              <Select
                value={selectedLevel}
                onChange={onLevelChange}
                style={{ width: '100%', marginTop: 4 }}
              >
                {levelOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong>Layout Mode</Text>
              <Select
                value={layoutMode}
                onChange={onLayoutModeChange}
                style={{ width: '100%', marginTop: 4 }}
              >
                {layoutOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <Title level={5}>Visual Settings</Title>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Node Size: {nodeSize}</Text>
              <Slider
                min={1}
                max={20}
                value={nodeSize}
                onChange={onNodeSizeChange}
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <Text strong>Edge Opacity: {Math.round(edgeOpacity * 100)}%</Text>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={edgeOpacity}
                onChange={onEdgeOpacityChange}
                style={{ marginTop: 4 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Show Labels</Text>
              <Switch
                checked={showLabels}
                onChange={onShowLabelsChange}
                size="small"
              />
            </div>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <Title level={5}>Actions</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button 
              type="default" 
              onClick={onResetLayout}
              style={{ width: '100%' }}
            >
              Reset Layout
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={onExport}
              style={{ width: '100%' }}
            >
              Export Graph
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <Title level={5}>Legend</Title>
          <Space direction="vertical" size="small">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#1890ff' }} />
              <Text type="secondary">Package</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#52c41a' }} />
              <Text type="secondary">Module</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fa8c16' }} />
              <Text type="secondary">Class</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#eb2f96' }} />
              <Text type="secondary">Method</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#722ed1' }} />
              <Text type="secondary">Field</Text>
            </div>
          </Space>
        </div>
      </Space>
    </Card>
  )
}

export default GraphControls