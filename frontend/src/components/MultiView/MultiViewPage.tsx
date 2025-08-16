import React, { useState } from 'react';
import { Tabs, Card, Empty } from 'antd';
import { ApartmentOutlined, HeatMapOutlined, TableOutlined } from '@ant-design/icons';
import MatrixView from './MatrixView';
import HierarchyView from './HierarchyView';

const { TabPane } = Tabs;

interface MultiViewPageProps {
  analysisId: string | null;
}

const MultiViewPage: React.FC<MultiViewPageProps> = ({ analysisId }) => {
  const [activeTab, setActiveTab] = useState('hierarchy');

  if (!analysisId) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Empty
          image={<TableOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description="No analysis selected"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ marginBottom: '24px' }}
        >
          <TabPane
            tab={
              <span>
                <ApartmentOutlined />
                Hierarchy View
              </span>
            }
            key="hierarchy"
          >
            <HierarchyView analysisId={analysisId} />
          </TabPane>
          
          <TabPane
            tab={
              <span>
                <HeatMapOutlined />
                Matrix View
              </span>
            }
            key="matrix"
          >
            <MatrixView analysisId={analysisId} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default MultiViewPage;