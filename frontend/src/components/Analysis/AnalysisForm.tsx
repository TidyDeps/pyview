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
  Typography,
  message
} from 'antd'
import { FolderOpenOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { AnalysisRequest, AnalysisOptions } from '@/types/api'

const { Title } = Typography

interface FormData {
  project_path: string
  max_depth: number
  include_stdlib: boolean
  exclude_patterns: string[]
}

interface AnalysisFormProps {
  onSubmit: (request: AnalysisRequest) => void
  loading?: boolean
  formData?: FormData
  onFormDataChange?: (data: FormData) => void
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({
  onSubmit,
  loading = false,
  formData,
  onFormDataChange
}) => {
  const [form] = Form.useForm()
  const [excludePatterns, setExcludePatterns] = useState<string[]>(
    formData?.exclude_patterns || [
      '__pycache__',
      '.git',
      '.venv',
      'venv',
      'env',
      'tests',
      'node_modules'
    ]
  )
  const [patternInput, setPatternInput] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)
  const [pathValidationMessage, setPathValidationMessage] = useState('')
  const [hasUserInput, setHasUserInput] = useState(false)

  // formData가 변경되면 Form과 로컬 state 업데이트
  React.useEffect(() => {
    if (formData) {
      form.setFieldsValue({
        project_path: formData.project_path,
        max_depth: formData.max_depth,
        include_stdlib: formData.include_stdlib
      })
      setExcludePatterns(formData.exclude_patterns)
    }
  }, [formData, form])

  // 폼 데이터 변경을 상위에 알려주는 함수
  const updateFormData = (updates: Partial<FormData>) => {
    if (onFormDataChange) {
      const currentValues = form.getFieldsValue()
      const newFormData = {
        project_path: currentValues.project_path || formData?.project_path || '',
        max_depth: currentValues.max_depth !== undefined ? currentValues.max_depth : (formData?.max_depth || 10),
        include_stdlib: currentValues.include_stdlib !== undefined ? currentValues.include_stdlib : (formData?.include_stdlib || false),
        exclude_patterns: excludePatterns,
        ...updates
      }
      onFormDataChange(newFormData)
    }
  }

  // 실시간 폼 유효성 검사
  const validateForm = () => {
    const projectPath = form.getFieldValue('project_path')

    // 사용자가 한 번이라도 입력했는지 체크
    if (projectPath !== undefined) {
      setHasUserInput(true)
    }

    if (!hasUserInput && !projectPath) {
      setPathValidationMessage('')
      setIsFormValid(false)
      return
    }

    // 빈 값 처리
    if (!projectPath || projectPath.trim().length === 0) {
      setPathValidationMessage('프로젝트 경로를 입력해주세요')
      setIsFormValid(false)
      return
    }

    // 절대경로 검사
    const isAbsolutePath = projectPath.startsWith('/') || /^[A-Za-z]:\\/.test(projectPath)
    if (!isAbsolutePath) {
      setPathValidationMessage('절대 경로를 입력해주세요 (예: /path/to/project 또는 C:\\path\\to\\project)')
      setIsFormValid(false)
      return
    }

    // 유효한 경우
    setPathValidationMessage('')
    setIsFormValid(true)

    // 상위 컴포넌트에 폼 데이터 변경 알림
    updateFormData({})
  }

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
      message.warning('이미 존재하는 패턴입니다')
      return
    }

    // Validate .gitignore-style pattern
    if (!validateGitIgnorePattern(trimmedPattern)) {
      // 구체적인 오류 메시지 제공
      let errorMsg = '잘못된 패턴 형식입니다'

      if (trimmedPattern.startsWith('#')) {
        errorMsg = '주석은 패턴에 사용할 수 없습니다'
      } else if (/[\x00-\x08\x0E-\x1F\x7F]/.test(trimmedPattern)) {
        errorMsg = '제어 문자는 사용할 수 없습니다'
      } else if (/\*{4,}/.test(trimmedPattern)) {
        errorMsg = '와일드카드(*)가 너무 많습니다'
      } else if (/\/{3,}/.test(trimmedPattern)) {
        errorMsg = '슬래시(/)가 너무 많습니다'
      } else if (trimmedPattern.includes('[') && !trimmedPattern.includes(']')) {
        errorMsg = '닫히지 않은 문자 클래스 [...]입니다'
      } else if (/\[\]/.test(trimmedPattern)) {
        errorMsg = '빈 문자 클래스는 사용할 수 없습니다'
      } else if (trimmedPattern.includes('\\')) {
        errorMsg = '백슬래시(\\)는 지원되지 않습니다'
      } else if (/\.{4,}/.test(trimmedPattern)) {
        errorMsg = '점(.)이 너무 많습니다'
      } else if (trimmedPattern.length > 255) {
        errorMsg = '패턴이 너무 깁니다 (최대 255자)'
      } else if ((trimmedPattern.match(/\*\*/g) || []).length > 3) {
        errorMsg = '이중 와일드카드(**)가 너무 많습니다'
      }

      message.error(errorMsg)
      return
    }

    const newPatterns = [...excludePatterns, trimmedPattern]
    setExcludePatterns(newPatterns)
    setPatternInput('')
    message.success('패턴이 추가되었습니다')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter 키 처리 (한글 조합 중이 아닐 때만)
    if (e.key === 'Enter' && !isComposing) {
      e.preventDefault()
      handleAddPattern()
    }
  }

  const handleRemovePattern = (pattern: string) => {
    const newPatterns = excludePatterns.filter(p => p !== pattern)
    setExcludePatterns(newPatterns)

    // 상위 컴포넌트에 패턴 변경 알림
    updateFormData({ exclude_patterns: newPatterns })
  }

  const handleSubmit = (values: any) => {
    const options: AnalysisOptions = {
      max_depth: values.max_depth || 10,
      exclude_patterns: excludePatterns,
      include_stdlib: values.include_stdlib === true,
    }

    const request: AnalysisRequest = {
      project_path: values.project_path,
      options
    }

    onSubmit(request)
  }

  return (
    <Card title="프로젝트 분석 설정">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={validateForm}
        initialValues={{
          project_path: formData?.project_path || '',
          max_depth: formData?.max_depth || 10,
          include_stdlib: formData?.include_stdlib || false,
        }}
      >
        <Title level={4}>프로젝트 설정</Title>

        <Form.Item
          name="project_path"
          label="프로젝트 경로"
          validateStatus={hasUserInput && pathValidationMessage ? 'error' : ''}
          help={hasUserInput && pathValidationMessage ? pathValidationMessage : 'Python 프로젝트의 절대 경로를 입력하세요'}
          rules={[{ required: true, message: '프로젝트 경로를 입력해주세요' }]}
        >
          <Input
            placeholder="/path/to/your/python/project"
            prefix={<FolderOpenOutlined />}
          />
        </Form.Item>

        <Title level={4} style={{ marginTop: 120, marginBottom: 16 }}>Analysis Options</Title>

        {/* Max Depth field temporarily disabled */}
        {/*
        <Form.Item
            name="max_depth"
            label="최대 깊이"
            tooltip="분석할 최대 의존성 깊이"
          >
            <InputNumber
              min={0}
              max={50}
              precision={0}
              parser={(value) => value ? parseInt(value.replace(/[^\d]/g, '')) : 0}
              formatter={(value) => value === 0 ? '0 (unlimited)' : (value ? `${value}` : '')}
              placeholder="0 for unlimited"
            />
          </Form.Item>
        */}

        <Form.Item label="제외 패턴" help=".gitignore 스타일 패턴을 입력하여 파일/폴더를 제외하세요 (*, /, 와일드카드 지원)">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="예: *.pyc, __pycache__/, test_*, node_modules/"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            />
            <Button onClick={handleAddPattern}>추가</Button>
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

        {/* Standard Library field temporarily disabled */}
        {/*
        <Form.Item
          name="include_stdlib"
          label={<span style={{ fontWeight: 'bold' }}>Standard Library</span>}
          valuePropName="checked"
          tooltip="Python 표준 라이브러리를 분석에 포함"
          style={{ marginTop: 48 }}
        >
          <Switch
            checkedChildren="포함"
            unCheckedChildren="제외"
            onChange={(checked) => {
              form.setFieldValue('include_stdlib', checked)
              // 상위 컴포넌트에 변경 알림
              updateFormData({ include_stdlib: checked })
            }}
          />
        </Form.Item>
        */}

        <Form.Item style={{ marginTop: 120 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={!isFormValid || loading}
            icon={<PlayCircleOutlined />}
            size="large"
            block
          >
            분석 시작
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AnalysisForm