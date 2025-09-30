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
  Typography,
  message
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
  const [excludePatterns, setExcludePatterns] = useState<string[]>([
    '__pycache__',
    '.git',
    '.venv',
    'venv',
    'env',
    'tests',
    'node_modules'
  ])
  const [patternInput, setPatternInput] = useState('')
  const [isComposing, setIsComposing] = useState(false)


  const validateGitIgnorePattern = (pattern: string): boolean => {
    // .gitignore 패턴 엄격한 검증

    // 빈 패턴 제거
    if (!pattern.trim()) {
      return false
    }

    // 주석은 허용하지 않음 (UI에서는 실제 패턴만)
    if (pattern.startsWith('#')) {
      return false
    }

    // 기본적인 문자 검증 (제어 문자 제외)
    if (/[\x00-\x08\x0E-\x1F\x7F]/.test(pattern)) {
      return false
    }

    // 과도한 와일드카드 중첩 방지
    if (/\*{4,}/.test(pattern)) {
      return false
    }

    // 과도한 경로 구분자 중첩 방지
    if (/\/{3,}/.test(pattern)) {
      return false
    }

    // 닫히지 않은 문자 클래스 검증
    if (pattern.includes('[') && !pattern.includes(']')) {
      return false
    }

    // 빈 문자 클래스 방지
    if (/\[\]/.test(pattern)) {
      return false
    }

    // Windows 스타일 경로 구분자 방지 (Unix 환경에서)
    if (pattern.includes('\\')) {
      return false
    }

    // 연속된 점 패턴 과도한 사용 방지
    if (/\.{4,}/.test(pattern)) {
      return false
    }

    // 패턴 길이 제한 (너무 긴 패턴 방지)
    if (pattern.length > 255) {
      return false
    }

    // 과도한 ** 중첩 방지
    if ((pattern.match(/\*\*/g) || []).length > 3) {
      return false
    }

    return true
  }

  const handleAddPattern = () => {
    // 한글 입력 조합 중일 때는 실행하지 않음
    if (isComposing) {
      return
    }

    const trimmedPattern = patternInput.trim()

    if (!trimmedPattern) {
      return
    }

    // Check for duplicates
    if (excludePatterns.includes(trimmedPattern)) {
      message.warning('Pattern already exists')
      return
    }

    // Validate .gitignore-style pattern
    if (!validateGitIgnorePattern(trimmedPattern)) {
      // 구체적인 오류 메시지 제공
      let errorMsg = 'Invalid pattern format'

      if (trimmedPattern.startsWith('#')) {
        errorMsg = 'Comments are not allowed in patterns'
      } else if (/[\x00-\x08\x0E-\x1F\x7F]/.test(trimmedPattern)) {
        errorMsg = 'Control characters are not allowed'
      } else if (/\*{4,}/.test(trimmedPattern)) {
        errorMsg = 'Too many consecutive wildcards (*)'
      } else if (/\/{3,}/.test(trimmedPattern)) {
        errorMsg = 'Too many consecutive slashes (/)'
      } else if (trimmedPattern.includes('[') && !trimmedPattern.includes(']')) {
        errorMsg = 'Unclosed character class [...]'
      } else if (/\[\]/.test(trimmedPattern)) {
        errorMsg = 'Empty character class is not allowed'
      } else if (trimmedPattern.includes('\\')) {
        errorMsg = 'Backslashes (\\) are not supported'
      } else if (/\.{4,}/.test(trimmedPattern)) {
        errorMsg = 'Too many consecutive dots (.)'
      } else if (trimmedPattern.length > 255) {
        errorMsg = 'Pattern is too long (max 255 characters)'
      } else if ((trimmedPattern.match(/\*\*/g) || []).length > 3) {
        errorMsg = 'Too many double wildcards (**)'
      }

      message.error(errorMsg)
      return
    }

    setExcludePatterns([...excludePatterns, trimmedPattern])
    setPatternInput('')
    message.success('Pattern added successfully')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter 키 처리 (한글 조합 중이 아닐 때만)
    if (e.key === 'Enter' && !isComposing) {
      e.preventDefault()
      handleAddPattern()
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

        <Form.Item label="Exclude Patterns" help="Enter .gitignore-style patterns to exclude files/folders (supports *, /, wildcards)">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="e.g., *.pyc, __pycache__/, test_*, node_modules/"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
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