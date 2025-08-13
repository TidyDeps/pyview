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
  Select,
  Tag,
  Divider,
  Typography
} from 'antd'
import { FolderOpenOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { AnalysisRequest, AnalysisOptions } from '@/types/api'

const { TextArea } = Input
const { Title, Text } = Typography
const { Option } = Select

interface AnalysisFormProps {
  onSubmit: (request: AnalysisRequest) => void
  loading?: boolean
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({ onSubmit, loading = false }) => {
  const [form] = Form.useForm()
  const [excludePatterns, setExcludePatterns] = useState<string[]>([])
  const [patternInput, setPatternInput] = useState('')

  const analysisLevels = [
    { value: 'package', label: 'Package Level' },
    { value: 'module', label: 'Module Level' },
    { value: 'class', label: 'Class Level' },
    { value: 'method', label: 'Method Level' },
    { value: 'field', label: 'Field Level' },
  ]

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
      analysis_levels: values.analysis_levels || ['package', 'module', 'class'],
      enable_type_inference: values.enable_type_inference || true,
      max_workers: values.max_workers || 4
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
          analysis_levels: ['package', 'module', 'class'],
          enable_type_inference: true,
          max_workers: 4
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

        <Form.Item
          name="analysis_levels"
          label="Analysis Levels"
          tooltip="Select which levels of the codebase to analyze"
        >
          <Select
            mode="multiple"
            placeholder="Select analysis levels"
            style={{ width: '100%' }}
          >
            {analysisLevels.map(level => (
              <Option key={level.value} value={level.value}>
                {level.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            name="max_depth"
            label="Max Depth"
            tooltip="Maximum dependency depth to analyze"
          >
            <InputNumber min={1} max={50} />
          </Form.Item>

          <Form.Item
            name="max_workers"
            label="Workers"
            tooltip="Number of parallel workers"
          >
            <InputNumber min={1} max={16} />
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