// Analysis Progress Display Component
import React from 'react'
import { Card, Progress, Typography, Space, Tag } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
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
      default:
        return null
    }
  }

  const formatDuration = (created: string, updated: string) => {
    const start = new Date(created)
    const end = new Date(updated)
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000)
    
    if (duration < 60) {
      return `${duration}s`
    } else if (duration < 3600) {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`
    } else {
      const hours = Math.floor(duration / 3600)
      const minutes = Math.floor((duration % 3600) / 60)
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
                Duration: {formatDuration(analysis.created_at, analysis.updated_at)}
              </Text>
            </div>
          )}
        </Space>
      )}

    </Card>
  )
}

export default ProgressDisplay