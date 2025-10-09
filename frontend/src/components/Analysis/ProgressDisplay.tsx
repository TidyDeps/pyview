// Analysis Progress Display Component
import React, { useState, useEffect } from 'react'
import { Card, Progress, Typography, Space, Tag } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { AnalysisStatusResponse } from '@/types/api'

const { Title, Text, Paragraph } = Typography

interface ProgressDisplayProps {
  analysis?: AnalysisStatusResponse | null
  error?: string | null
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  analysis,
  error
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [localStartTime, setLocalStartTime] = useState<Date | null>(null)

  // 분석이 처음 시작될 때 로컬 시작 시간 설정
  useEffect(() => {
    if (analysis && (analysis.status === 'pending' || analysis.status === 'running') && !localStartTime) {
      setLocalStartTime(new Date())
    } else if (analysis && (analysis.status === 'completed' || analysis.status === 'failed')) {
      setLocalStartTime(null)
    }
  }, [analysis?.status, localStartTime])

  // 분석이 진행 중일 때만 실시간 시간 업데이트
  useEffect(() => {
    if (!analysis || analysis.status === 'completed' || analysis.status === 'failed') {
      return
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [analysis?.status])

  if (!analysis) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      case 'running':
        return 'processing'
      case 'pending':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      default:
        return null
    }
  }

  const formatDuration = (created: string, updated: string, status: string) => {
    // 진행 중일 때는 로컬 시작 시간을 우선 사용, 없으면 서버 시간 사용
    const start = (status === 'running' || status === 'pending') && localStartTime
      ? localStartTime
      : new Date(created)

    // 진행 중일 때는 현재 시간을, 완료/실패 시에는 updated 시간을 사용
    const end = (status === 'running' || status === 'pending') ? currentTime : new Date(updated)
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000)

    // 음수 방지
    const safeDuration = Math.max(0, duration)

    if (safeDuration < 60) {
      return `${safeDuration}s`
    } else if (safeDuration < 3600) {
      return `${Math.floor(safeDuration / 60)}m ${safeDuration % 60}s`
    } else {
      const hours = Math.floor(safeDuration / 3600)
      const minutes = Math.floor((safeDuration % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'failed':
        return '실패'
      case 'running':
        return '진행 중'
      case 'pending':
        return '대기 중'
      default:
        return status.toUpperCase()
    }
  }

  const getProgressMessage = (status: string, progress: number) => {
    if (status === 'completed') {
      return '분석이 완료되었습니다'
    }
    if (status === 'failed') {
      return '분석이 실패했습니다'
    }
    if (status === 'pending') {
      return '분석 대기 중입니다...'
    }

    // 진행률에 따른 단계별 메시지
    if (progress < 0.1) {
      return '분석을 시작하고 있습니다...'
    } else if (progress < 0.3) {
      return '파일을 스캔하고 있습니다...'
    } else if (progress < 0.5) {
      return '의존성을 분석하고 있습니다...'
    } else if (progress < 0.7) {
      return '의존성 그래프를 구성하고 있습니다...'
    } else if (progress < 0.9) {
      return '순환 참조를 탐지하고 있습니다...'
    } else {
      return '분석을 마무리하고 있습니다...'
    }
  }

  return (
    <Card
      title="분석 진행 상황"
      extra={analysis && (
        <Space>
          {getStatusIcon(analysis.status)}
          <Tag color={getStatusColor(analysis.status)}>
            {getStatusText(analysis.status)}
          </Tag>
        </Space>
      )}
    >
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      {analysis && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>분석 ID: </Text>
            <Text code>{analysis.analysis_id}</Text>
          </div>

          <Progress
            percent={Math.round(analysis.progress * 100)}
            status={analysis.status === 'failed' ? 'exception' :
                   analysis.status === 'completed' ? 'success' : 'active'}
            showInfo
          />

          <div>
            <Text>{getProgressMessage(analysis.status, analysis.progress)}</Text>
          </div>

          {analysis.created_at && analysis.updated_at && (
            <div>
              <Text type="secondary">
                소요 시간: {formatDuration(analysis.created_at, analysis.updated_at, analysis.status)}
              </Text>
            </div>
          )}
        </Space>
      )}

    </Card>
  )
}

export default ProgressDisplay