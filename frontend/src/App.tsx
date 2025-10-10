// 메인 애플리케이션 컴포넌트
import React, { useState, useEffect } from 'react'
import { ConfigProvider, message } from 'antd'
import AppLayout from '@/components/Layout/AppLayout'
import AnalysisForm from '@/components/Analysis/AnalysisForm'
import ProgressDisplay from '@/components/Analysis/ProgressDisplay'
import VisualizationPage from '@/components/Visualization/VisualizationPage'
// import SearchPage from '@/components/Search/SearchPage'
import QualityMetricsPage from '@/components/QualityMetrics/QualityMetricsPage'
// import MultiViewPage from '@/components/MultiView/MultiViewPage'
import { useAnalysis } from '@/hooks/useAnalysis'
import type { AnalysisRequest } from '@/types/api'
import { AnalysisStatus } from '@/types/api'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('analysis')
  const [messageApi, contextHolder] = message.useMessage()
  const [hasShownAlert, setHasShownAlert] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // 폼 데이터를 앱 레벨에서 관리하여 탭 전환 시에도 유지
  const [formData, setFormData] = useState({
    project_path: '',
    max_depth: 10,
    include_stdlib: false,
    exclude_patterns: [
      '__pycache__',
      '.git',
      '.venv',
      'venv',
      'env',
      'tests',
      'node_modules'
    ]
  })
  
  const {
    currentAnalysis,
    isLoading,
    error,
    isServerConnected,
    checkServerConnection,
    startAnalysis,
    clearError
  } = useAnalysis()

  const handleAnalysisStart = async (request: AnalysisRequest) => {
    try {
      clearError()
      messageApi.info('프로젝트 분석을 시작합니다...')
      await startAnalysis(request)
    } catch (err) {
      messageApi.error('분석 시작에 실패했습니다')
    }
  }

  const handleMenuSelect = (key: string) => {
    setCurrentView(key)
  }

  // Check server connection on app load and periodically
  useEffect(() => {
    checkServerConnection().then(() => {
      setIsInitialLoad(false)
    })

    // Set up periodic connection check every 5 seconds
    const interval = setInterval(() => {
      checkServerConnection()
    }, 5000)

    return () => clearInterval(interval)
  }, [checkServerConnection])

  // Show alert when server connection changes to disconnected
  useEffect(() => {
    if (!isServerConnected && !hasShownAlert && !isInitialLoad) {
      // Show both Ant Design message and browser alert
      messageApi.error({
        content: '서버 연결 안 됨 - 백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.',
        duration: 0, // Don't auto-close
        key: 'server-error' // Prevent duplicates
      })
      alert('서버 연결 안 됨\n백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
      setHasShownAlert(true)
    } else if (isServerConnected && hasShownAlert) {
      // Reset alert flag and close error message when server is connected
      messageApi.destroy('server-error')
      messageApi.success('서버 연결이 복구되었습니다.')
      setHasShownAlert(false)
    }
  }, [isServerConnected, hasShownAlert, isInitialLoad, messageApi])

  // Show alert when analysis is completed
  useEffect(() => {
    if (currentAnalysis?.status === AnalysisStatus.COMPLETED) {
      messageApi.success({
        content: '프로젝트 분석이 완료되었습니다!',
        duration: 5 // Auto-close after 5 seconds
      })
    } else if (currentAnalysis?.status === AnalysisStatus.FAILED) {
      messageApi.error({
        content: '프로젝트 분석에 실패했습니다.',
        duration: 5
      })
    }
  }, [currentAnalysis?.status, messageApi])

  const renderContent = () => {
    switch (currentView) {
      case 'analysis':
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '400px' }}>
              <AnalysisForm
                onSubmit={handleAnalysisStart}
                loading={isLoading}
                formData={formData}
                onFormDataChange={setFormData}
              />
            </div>
            {(currentAnalysis || error) && (
              <div style={{ flex: 1, minWidth: '400px' }}>
                <ProgressDisplay
                  analysis={currentAnalysis}
                  error={error}
                />
              </div>
            )}
          </div>
        )
      
      case 'visualization':
        return (
          <VisualizationPage 
            analysisId={currentAnalysis?.analysis_id || null}
          />
        )
      
      // case 'search':
      //   return (
      //     <SearchPage 
      //       analysisId={currentAnalysis?.analysis_id || null}
      //     />
      //   )
      
      case 'quality-metrics':
        return (
          <QualityMetricsPage 
            analysisId={currentAnalysis?.analysis_id || null}
          />
        )
      
      // case 'multi-view':
      //   return (
      //     <MultiViewPage 
      //       analysisId={currentAnalysis?.analysis_id || null}
      //     />
      //   )
      
      default:
        return null
    }
  }

  return (
    <ConfigProvider>
      {contextHolder}
      <AppLayout 
        selectedKey={currentView}
        onMenuSelect={handleMenuSelect}
      >
        {renderContent()}
      </AppLayout>
    </ConfigProvider>
  )
}

export default App