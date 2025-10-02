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

  return (
    <Card 
      title="Analysis Progress"
      extra={analysis && (
        <Space>
          {getStatusIcon(analysis.status)}
          <Tag color={getStatusColor(analysis.status)}>
            {analysis.status.toUpperCase()}
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
            <Text strong>Analysis ID: </Text>
            <Text code>{analysis.analysis_id}</Text>
          </div>
          
          <Progress 
            percent={Math.round(analysis.progress * 100)}
            status={analysis.status === 'failed' ? 'exception' : 
                   analysis.status === 'completed' ? 'success' : 'active'}
            showInfo
          />
          
          <div>
            <Text>{analysis.message}</Text>
          </div>

          {analysis.created_at && analysis.updated_at && (
            <div>
              <Text type="secondary">
                Duration: {formatDuration(analysis.created_at, analysis.updated_at, analysis.status)}
              </Text>
            </div>
          )}
        </Space>
      )}

    </Card>
  )
}

export default ProgressDisplay