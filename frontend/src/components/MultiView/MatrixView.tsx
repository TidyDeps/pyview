import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Tag, Tooltip, Spin } from 'antd';
import { HeatMapOutlined } from '@ant-design/icons';
import ApiService from '../../services/api';

const { Title } = Typography;

interface MatrixViewProps {
  analysisId: string | null;
}

interface MatrixCell {
  from: string;
  to: string;
  count: number;
  type: 'import' | 'inheritance' | 'call' | 'composition';
}

interface MatrixData {
  entities: string[];
  matrix: MatrixCell[][];
  summary: {
    total_dependencies: number;
    max_dependencies: number;
    avg_dependencies: number;
  };
}

const MatrixView: React.FC<MatrixViewProps> = ({ analysisId }) => {
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (analysisId) {
      fetchMatrixData();
    }
  }, [analysisId]);

  const fetchMatrixData = async () => {
    if (!analysisId) return;
    
    setLoading(true);
    try {
      // Fetch actual analysis results
      const results = await ApiService.getAnalysisResults(analysisId);
      
      if (!results || !results.dependency_graph) {
        setMatrixData(null);
        return;
      }
      
      const { dependency_graph, relationships } = results;
      
      // Extract module names for matrix
      const modules = dependency_graph.modules || [];
      const entities = modules.slice(0, 10).map((module: any) => module.name); // Limit to 10 for performance
      
      // Create dependency matrix
      const matrix: MatrixCell[][] = [];
      let totalDependencies = 0;
      let maxDependencies = 0;
      
      for (let i = 0; i < entities.length; i++) {
        const row: MatrixCell[] = [];
        let rowDependencies = 0;
        
        for (let j = 0; j < entities.length; j++) {
          const fromEntity = entities[i];
          const toEntity = entities[j];
          
          // Count dependencies between these entities
          const dependencyCount = (relationships || []).filter((rel: any) => 
            rel.from_entity?.includes(fromEntity) && rel.to_entity?.includes(toEntity)
          ).length;
          
          // Determine dependency type
          let depType: 'import' | 'inheritance' | 'call' | 'composition' = 'import';
          if (dependencyCount > 0) {
            const firstRel = (relationships || []).find((rel: any) => 
              rel.from_entity?.includes(fromEntity) && rel.to_entity?.includes(toEntity)
            );
            depType = firstRel?.dependency_type || 'import';
          }
          
          row.push({
            from: fromEntity,
            to: toEntity,
            count: dependencyCount,
            type: depType
          });
          
          if (i !== j) { // Don't count self-dependencies
            rowDependencies += dependencyCount;
            totalDependencies += dependencyCount;
          }
        }
        
        maxDependencies = Math.max(maxDependencies, rowDependencies);
        matrix.push(row);
      }
      
      const matrixData: MatrixData = {
        entities,
        matrix,
        summary: {
          total_dependencies: totalDependencies,
          max_dependencies: maxDependencies,
          avg_dependencies: entities.length > 0 ? totalDependencies / entities.length : 0
        }
      };
      
      setMatrixData(matrixData);
    } catch (error) {
      console.error('Failed to fetch matrix data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntensityColor = (count: number, maxCount: number) => {
    if (count === 0) return '#f5f5f5';
    const intensity = count / maxCount;
    if (intensity <= 0.2) return '#e6f7ff';
    if (intensity <= 0.4) return '#91d5ff';
    if (intensity <= 0.6) return '#40a9ff';
    if (intensity <= 0.8) return '#1890ff';
    return '#0050b3';
  };

  const getTextColor = (count: number, maxCount: number) => {
    const intensity = count / maxCount;
    return intensity > 0.6 ? '#ffffff' : '#000000';
  };

  const getDependencyTypeColor = (type: string) => {
    switch (type) {
      case 'import': return 'blue';
      case 'inheritance': return 'purple';
      case 'call': return 'green';
      case 'composition': return 'orange';
      default: return 'default';
    }
  };

  if (!analysisId) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <HeatMapOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
        <p style={{ marginTop: 16, color: '#999' }}>Select an analysis to view dependency matrix</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Loading dependency matrix...</p>
      </div>
    );
  }

  if (!matrixData) return null;

  const maxDependencyCount = Math.max(
    ...matrixData.matrix.flat().map(cell => cell.count)
  );

  return (
    <div style={{ padding: '20px' }}>
      <Title level={3} style={{ marginBottom: '20px' }}>
        <HeatMapOutlined /> Dependency Matrix
      </Title>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                {matrixData.summary.total_dependencies}
              </div>
              <div style={{ color: '#666' }}>Total Dependencies</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                {matrixData.summary.max_dependencies}
              </div>
              <div style={{ color: '#666' }}>Max Dependencies</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                {matrixData.summary.avg_dependencies.toFixed(1)}
              </div>
              <div style={{ color: '#666' }}>Avg Dependencies</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Dependency Matrix */}
      <Card title="Module Dependency Matrix" size="small">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', border: '1px solid #d9d9d9', background: '#fafafa' }}>
                  From / To
                </th>
                {matrixData.entities.map((entity, index) => (
                  <th
                    key={index}
                    style={{
                      padding: '8px',
                      border: '1px solid #d9d9d9',
                      background: '#fafafa',
                      minWidth: '120px',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'left bottom',
                      height: '80px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ width: '80px', textAlign: 'left' }}>
                      {entity.replace('.py', '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData.matrix.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td style={{
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    background: '#fafafa',
                    fontWeight: 'bold',
                    minWidth: '120px'
                  }}>
                    {matrixData.entities[rowIndex].replace('.py', '')}
                  </td>
                  {row.map((cell, colIndex) => (
                    <Tooltip
                      key={colIndex}
                      title={
                        cell.count > 0
                          ? `${cell.from} → ${cell.to}: ${cell.count} dependencies (${cell.type})`
                          : 'No dependencies'
                      }
                    >
                      <td
                        style={{
                          padding: '8px',
                          border: '1px solid #d9d9d9',
                          textAlign: 'center',
                          backgroundColor: getIntensityColor(cell.count, maxDependencyCount),
                          color: getTextColor(cell.count, maxDependencyCount),
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                          minWidth: '60px',
                          position: 'relative'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {cell.count || ''}
                        </div>
                        {cell.count > 0 && (
                          <Tag
                            color={getDependencyTypeColor(cell.type)}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              fontSize: '8px',
                              lineHeight: '12px',
                              padding: '0 4px'
                            }}
                          >
                            {cell.type.charAt(0).toUpperCase()}
                          </Tag>
                        )}
                      </td>
                    </Tooltip>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Legend:</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tag color="blue">I - Import</Tag>
            <Tag color="purple">I - Inheritance</Tag>
            <Tag color="green">C - Call</Tag>
            <Tag color="orange">C - Composition</Tag>
          </div>
          <div style={{ marginLeft: '16px', fontSize: '12px' }}>
            Intensity: Darker = More Dependencies
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MatrixView;