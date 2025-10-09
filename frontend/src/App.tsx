// 메인 애플리케이션 컴포넌트
import React, { useState } from 'react'
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('analysis')
  const [messageApi, contextHolder] = message.useMessage()
  
  const {
    currentAnalysis,
    isLoading,
    error,
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

  const renderContent = () => {
    switch (currentView) {
      case 'analysis':
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '400px' }}>
              <AnalysisForm 
                onSubmit={handleAnalysisStart}
                loading={isLoading}
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