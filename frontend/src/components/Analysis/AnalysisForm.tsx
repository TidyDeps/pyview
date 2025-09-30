// Analysis Configuration Form Component
import React, { useState } from 'react'
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  InputNumber,
  Switch,
  Tag,
  Divider,
  Typography
} from 'antd'
import { FolderOpenOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { AnalysisRequest, AnalysisOptions } from '@/types/api'

const { Title, Text } = Typography

interface AnalysisFormProps {
  onSubmit: (request: AnalysisRequest) => void
  loading?: boolean
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({ onSubmit, loading = false }) => {
  const [form] = Form.useForm()
  const [excludePatterns, setExcludePatterns] = useState<string[]>([])
  const [patternInput, setPatternInput] = useState('')


  const handleAddPattern = () => {
    if (patternInput.trim() && !excludePatterns.includes(patternInput.trim())) {
      setExcludePatterns([...excludePatterns, patternInput.trim()])
      setPatternInput('')
    }
  }

  const handleRemovePattern = (pattern: string) => {
    setExcludePatterns(excludePatterns.filter(p => p !== pattern))
  }

  const handleSubmit = (values: any) => {
    const options: AnalysisOptions = {
      max_depth: values.max_depth || 10,
      exclude_patterns: excludePatterns,
      include_stdlib: values.include_stdlib || false,
      enable_type_inference: values.enable_type_inference || true,
    }

    const request: AnalysisRequest = {
      project_path: values.project_path,
      options
    }

    onSubmit(request)
  }

  return (
    <Card title="Configure Project Analysis">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          max_depth: 10,
          include_stdlib: false,
          enable_type_inference: true,
        }}
      >
        <Title level={4}>Project Settings</Title>
        
        <Form.Item
          name="project_path"
          label="Project Path"
          rules={[{ required: true, message: 'Please enter project path' }]}
        >
          <Input
            placeholder="/path/to/your/python/project"
            prefix={<FolderOpenOutlined />}
          />
        </Form.Item>

        <Divider />
        
        <Title level={4}>Analysis Options</Title>


        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            name="max_depth"
            label="Max Depth"
            tooltip="Maximum dependency depth to analyze"
          >
            <InputNumber
              min={1}
              max={50}
              precision={0}
              parser={(value) => value ? parseInt(value.replace(/[^\d]/g, '')) : 0}
              formatter={(value) => value ? `${value}` : ''}
            />
          </Form.Item>

        </Space>

        <Form.Item label="Exclude Patterns">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="e.g., *.pyc, __pycache__"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              onPressEnter={handleAddPattern}
            />
            <Button onClick={handleAddPattern}>Add</Button>
          </Space.Compact>
          
          <div style={{ marginTop: 8 }}>
            {excludePatterns.map(pattern => (
              <Tag
                key={pattern}
                closable
                onClose={() => handleRemovePattern(pattern)}
                style={{ marginBottom: 4 }}
              >
                {pattern}
              </Tag>
            ))}
          </div>
        </Form.Item>

        <Space style={{ width: '100%' }} direction="vertical">
          <Form.Item
            name="include_stdlib"
            valuePropName="checked"
            tooltip="Include Python standard library in analysis"
          >
            <Switch checkedChildren="Include" unCheckedChildren="Exclude" />
            <Text style={{ marginLeft: 8 }}>Standard Library</Text>
          </Form.Item>

          <Form.Item
            name="enable_type_inference"
            valuePropName="checked"
            tooltip="Enable advanced type inference analysis"
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            <Text style={{ marginLeft: 8 }}>Type Inference</Text>
          </Form.Item>
        </Space>

        <Form.Item style={{ marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<PlayCircleOutlined />}
            size="large"
            block
          >
            Start Analysis
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AnalysisForm