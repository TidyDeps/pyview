// Main Application Component
import React, { useState } from 'react'
import { ConfigProvider, message } from 'antd'
import AppLayout from '@/components/Layout/AppLayout'
import AnalysisForm from '@/components/Analysis/AnalysisForm'
import ProgressDisplay from '@/components/Analysis/ProgressDisplay'
import { useAnalysis } from '@/hooks/useAnalysis'
import type { AnalysisRequest } from '@/types/api'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('analysis')
  const [messageApi, contextHolder] = message.useMessage()
  
  const {
    currentAnalysis,
    isLoading,
    error,
    progress,
    startAnalysis,
    clearError
  } = useAnalysis()

  const handleAnalysisStart = async (request: AnalysisRequest) => {
    try {
      clearError()
      messageApi.info('Starting project analysis...')
      await startAnalysis(request)
    } catch (err) {
      messageApi.error('Failed to start analysis')
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
            {(currentAnalysis || progress || error) && (
              <div style={{ flex: 1, minWidth: '400px' }}>
                <ProgressDisplay
                  analysis={currentAnalysis}
                  progress={progress}
                  error={error}
                />
              </div>
            )}
          </div>
        )
      
      case 'visualization':
        return (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <h2>Dependency Graph Visualization</h2>
            <p>This feature will be implemented next with WebGL rendering.</p>
          </div>
        )
      
      case 'search':
        return (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <h2>Entity Search</h2>
            <p>Search functionality will be available after analysis completion.</p>
          </div>
        )
      
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