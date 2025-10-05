import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Progress, Tag, Typography, Statistic, Empty, message, Select, Space, Modal, List, Divider, Button, Tooltip } from 'antd';
import { CheckCircleOutlined, WarningOutlined, AppstoreOutlined, DashboardOutlined, FilterOutlined, ExclamationCircleOutlined, InfoCircleOutlined, QuestionCircleOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import { QualityMetrics } from '../../types/api';
import ApiService from '../../services/api';

const { Title, Text } = Typography;

interface QualityMetricsPageProps {
  analysisId: string | null;
}

const QualityMetricsPage: React.FC<QualityMetricsPageProps> = ({ analysisId }) => {
  const [metrics, setMetrics] = useState<QualityMetrics[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<QualityMetrics[]>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [selectedCycleInfo, setSelectedCycleInfo] = useState<QualityMetrics | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  useEffect(() => {
    if (!analysisId) return;

    let isMounted = true;
    const abortController = new AbortController();

    const fetchMetrics = async () => {
      try {
        const response = await ApiService.getQualityMetrics(analysisId);
        if (isMounted) {
          setMetrics(response);
          setFilteredMetrics(response);
        }
      } catch (error) {
        if (isMounted && !abortController.signal.aborted) {
          console.error('Failed to fetch quality metrics:', error);
          message.error('Server connection lost. Please try again.');
        }
      }
    };

    fetchMetrics();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [analysisId]);

  // Filter metrics when filters change
  useEffect(() => {
    let filtered = metrics;
    
    if (entityTypeFilter) {
      filtered = filtered.filter(metric => metric.entity_type === entityTypeFilter);
    }
    
    setFilteredMetrics(filtered);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  }, [metrics, entityTypeFilter]);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'green';
      case 'B': return 'blue';
      case 'C': return 'orange';
      case 'D': return 'red';
      case 'F': return 'red';
      default: return 'default';
    }
  };

  const getComplexityStatus = (complexity: number) => {
    if (complexity <= 10) return { status: 'success' as const, text: 'Good' };
    if (complexity <= 20) return { status: 'active' as const, text: 'Moderate' };
    return { status: 'exception' as const, text: 'High' };
  };

  const getMaintainabilityStatus = (index: number) => {
    if (index >= 80) return { status: 'success' as const, text: 'Excellent' };
    if (index >= 60) return { status: 'active' as const, text: 'Good' };
    return { status: 'exception' as const, text: 'Poor' };
  };

  const getEntityTypeColor = (type: string) => {
    switch (type) {
      case 'module': return '#1890ff'; // 파란색
      case 'class': return '#52c41a'; // 초록색
      case 'method': return '#fa8c16'; // 주황색
      case 'function': return '#722ed1'; // 보라색
      default: return '#666666';
    }
  };

  const isInCycle = (record: QualityMetrics) => {
    return record.is_in_cycle;
  };

  const handleCycleIconClick = (record: QualityMetrics) => {
    setSelectedCycleInfo(record);
    setCycleModalVisible(true);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortedMetrics = () => {
    if (!sortField) return filteredMetrics;

    return [...filteredMetrics].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'grade':
          const gradeOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };
          aValue = gradeOrder[a.quality_grade as keyof typeof gradeOrder] || 6;
          bValue = gradeOrder[b.quality_grade as keyof typeof gradeOrder] || 6;
          break;
        case 'complexity':
          aValue = a.cyclomatic_complexity;
          bValue = b.cyclomatic_complexity;
          break;
        case 'maintainability':
          aValue = a.maintainability_index;
          bValue = b.maintainability_index;
          break;
        case 'cycle':
          aValue = a.is_in_cycle ? 1 : 0;
          bValue = b.is_in_cycle ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const calculateOverallStats = () => {
    if (metrics.length === 0) {
      return { 
        avgComplexity: 0, 
        avgMaintainability: 0, 
        gradeDistribution: {} as Record<string, number>
      };
    }
    
    const avgComplexity = metrics.reduce((sum, m) => sum + m.cyclomatic_complexity, 0) / metrics.length;
    const avgMaintainability = metrics.reduce((sum, m) => sum + m.maintainability_index, 0) / metrics.length;
    
    const gradeDistribution = metrics.reduce((acc: Record<string, number>, m) => {
      acc[m.quality_grade] = (acc[m.quality_grade] || 0) + 1;
      return acc;
    }, {});

    return { avgComplexity, avgMaintainability, gradeDistribution };
  };

  const { avgComplexity, avgMaintainability, gradeDistribution } = calculateOverallStats();

  const columns = [
    {
      title: 'Entity',
      dataIndex: 'entity_id',
      key: 'entity_id',
      render: (id: string, record: QualityMetrics) => {
        return (
          <div>
            <div>
              <Text 
                strong 
                style={{ 
                  color: getEntityTypeColor(record.entity_type),
                  fontSize: 14
                }}
              >
                {id.split(':').pop()}
              </Text>
            </div>
            <Text 
              type="secondary" 
              style={{ 
                fontSize: 12,
                color: getEntityTypeColor(record.entity_type)
              }}
            >
              {record.entity_type}
            </Text>
          </div>
        );
      }
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Grade
          <Button
            type="text"
            size="small"
            icon={sortField === 'grade' ? (sortOrder === 'asc' ? <CaretUpOutlined /> : <CaretDownOutlined />) : <CaretUpOutlined />}
            onClick={() => handleSort('grade')}
            style={{ padding: '0 4px', height: 'auto' }}
          />
        </div>
      ),
      dataIndex: 'quality_grade',
      key: 'grade',
      width: 100,
      render: (grade: string) => (
        <Tag color={getGradeColor(grade)} style={{ fontSize: 12, fontWeight: 'bold' }}>
          {grade}
        </Tag>
      )
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Complexity
          <Button
            type="text"
            size="small"
            icon={sortField === 'complexity' ? (sortOrder === 'asc' ? <CaretUpOutlined /> : <CaretDownOutlined />) : <CaretUpOutlined />}
            onClick={() => handleSort('complexity')}
            style={{ padding: '0 4px', height: 'auto' }}
          />
        </div>
      ),
      dataIndex: 'cyclomatic_complexity',
      key: 'complexity',
      render: (complexity: number) => {
        const status = getComplexityStatus(complexity);
        return (
          <div>
            <Progress
              percent={(complexity / 50) * 100}
              status={status.status}
              strokeWidth={8}
              format={() => complexity}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {status.text}
            </Text>
          </div>
        );
      }
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Maintainability
          <Button
            type="text"
            size="small"
            icon={sortField === 'maintainability' ? (sortOrder === 'asc' ? <CaretUpOutlined /> : <CaretDownOutlined />) : <CaretUpOutlined />}
            onClick={() => handleSort('maintainability')}
            style={{ padding: '0 4px', height: 'auto' }}
          />
        </div>
      ),
      dataIndex: 'maintainability_index',
      key: 'maintainability',
      render: (index: number) => {
        const status = getMaintainabilityStatus(index);
        return (
          <div>
            <Progress
              percent={index}
              status={status.status}
              strokeWidth={8}
              format={() => `${index.toFixed(1)}`}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {status.text}
            </Text>
          </div>
        );
      }
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Cycle Status
          <Button
            type="text"
            size="small"
            icon={sortField === 'cycle' ? (sortOrder === 'asc' ? <CaretUpOutlined /> : <CaretDownOutlined />) : <CaretUpOutlined />}
            onClick={() => handleSort('cycle')}
            style={{ padding: '0 4px', height: 'auto' }}
          />
        </div>
      ),
      key: 'cycle_status',
      width: 300,
      render: (record: QualityMetrics) => {
        const isCyclic = isInCycle(record);
        
        if (!isCyclic) {
          return (
            <div style={{ textAlign: 'center' }}>
              <Tag color="green" style={{ fontSize: 11 }}>
                <CheckCircleOutlined /> Normal
              </Tag>
            </div>
          );
        }

        const getCycleTypeText = (cycleType?: string) => {
          switch (cycleType) {
            case 'import': return 'Import Cycle';
            case 'call': return 'Call Cycle';
            case 'self': return 'Self Reference';
            default: return 'Circular Dependency';
          }
        };

        const getSeverityColor = (severity?: string) => {
          switch (severity) {
            case 'high': return 'red';
            case 'medium': return 'orange';
            case 'low': return 'yellow';
            default: return 'red';
          }
        };

        return (
          <div style={{ textAlign: 'center' }}>
            <Tag 
              color={getSeverityColor(record.cycle_severity)} 
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                handleCycleIconClick(record);
              }}
            >
              <ExclamationCircleOutlined /> {getCycleTypeText(record.cycle_type)}
            </Tag>
          </div>
        );
      }
    }
  ];

  if (!analysisId) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Empty description="No analysis selected" />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title level={3} style={{ marginBottom: '20px' }}>
        <DashboardOutlined /> Code Quality Metrics
      </Title>

      {/* Overall Quality Assessment */}
      <Card title="Overall Quality Assessment" size="small" style={{ marginBottom: '24px' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Average Complexity"
                value={avgComplexity}
                precision={1}
                valueStyle={{
                  color: avgComplexity <= 10 ? '#3f8600' : avgComplexity <= 20 ? '#faad14' : '#cf1322'
                }}
                prefix={avgComplexity <= 10 ? <CheckCircleOutlined /> : <WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg Maintainability"
                value={avgMaintainability}
                precision={1}
                valueStyle={{
                  color: avgMaintainability >= 80 ? '#3f8600' : avgMaintainability >= 60 ? '#faad14' : '#cf1322'
                }}
                suffix="/ 100"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Entities"
                value={metrics.length}
                prefix={<AppstoreOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card title="Quality Distribution" size="small">
              <div>
                {Object.keys(gradeDistribution).length > 0 ? (
                  Object.entries(gradeDistribution).map(([grade, count]) => (
                    <Tag key={grade} color={getGradeColor(grade)} style={{ margin: 2 }}>
                      {grade}: {count}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">No data</Text>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Metrics Table */}
      <Card 
        title="Detailed Quality Metrics" 
        size="small"
        extra={
          <Space>
            <Tooltip title="Measurement Criteria Help">
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                onClick={() => setHelpModalVisible(true)}
              />
            </Tooltip>
            <FilterOutlined />
            <Select
              placeholder="Filter by Type"
              allowClear
              style={{ width: 160 }}
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
            >
              <Select.Option value="module">Module</Select.Option>
              <Select.Option value="class">Class</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={getSortedMetrics()}
          rowKey="entity_id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredMetrics.length,
            showSizeChanger: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} items`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
              }
            },
            onShowSizeChange: (current, size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
            hideOnSinglePage: false
          }}
          locale={{
            emptyText: 'No data'
          }}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 순환참조 상세 정보 모달 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Circular Dependency Details</span>
          </div>
        }
        open={cycleModalVisible}
        onCancel={() => setCycleModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedCycleInfo && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>
                {selectedCycleInfo.entity_id.split(':').pop()}
              </Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({selectedCycleInfo.entity_type})
              </Text>
            </div>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Cycle Type:</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={
                  selectedCycleInfo.cycle_severity === 'high' ? 'red' :
                  selectedCycleInfo.cycle_severity === 'medium' ? 'orange' : 'yellow'
                }>
                  {selectedCycleInfo.cycle_type === 'import' ? 'Import Cycle' :
                   selectedCycleInfo.cycle_type === 'call' ? 'Call Cycle' :
                   selectedCycleInfo.cycle_type === 'self' ? 'Self Reference' : 'Circular Dependency'}
                </Tag>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Severity:</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={
                  selectedCycleInfo.cycle_severity === 'high' ? 'red' :
                  selectedCycleInfo.cycle_severity === 'medium' ? 'orange' : 'yellow'
                }>
                  {selectedCycleInfo.cycle_severity === 'high' ? 'High' :
                   selectedCycleInfo.cycle_severity === 'medium' ? 'Medium' : 'Low'}
                </Tag>
              </div>
            </div>


            {selectedCycleInfo.cycle_partners.length > 0 && (
              <div>
                <Text strong>Circular Dependency Entities:</Text>
                <div style={{ marginTop: 8 }}>
                  <List
                    size="small"
                    dataSource={selectedCycleInfo.cycle_partners}
                    renderItem={(partner, index) => (
                      <List.Item>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Text type="secondary" style={{ minWidth: '20px' }}>
                            {index + 1}.
                          </Text>
                          <Text 
                            code 
                            style={{ 
                              fontSize: 12, 
                              color: '#ff4d4f',
                              fontWeight: 'bold'
                            }}
                          >
                            {partner.split(':').pop() || partner}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ({partner})
                          </Text>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </div>
            )}

            {selectedCycleInfo.cycle_partners.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <InfoCircleOutlined style={{ fontSize: 24, color: '#ccc' }} />
                <div style={{ marginTop: 8, color: '#999' }}>
                  No reference information available.
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 도움말 모달 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QuestionCircleOutlined style={{ color: '#1890ff' }} />
            <span>Measurement Criteria</span>
          </div>
        }
        open={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        footer={null}
        width={700}
      >
        <div>
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Quality Grade</Title>
            <Text>
              Overall code quality rating based on complexity and maintainability metrics.
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><Text strong>A:</Text> Excellent (≤10 complexity, ≥80 maintainability)</li>
              <li><Text strong>B:</Text> Good (≤20 complexity, ≥60 maintainability)</li>
              <li><Text strong>C:</Text> Fair (≤50 complexity, ≥40 maintainability)</li>
              <li><Text strong>D:</Text> Poor (higher complexity, lower maintainability)</li>
              <li><Text strong>F:</Text> Very Poor (very high complexity, very low maintainability)</li>
            </ul>
          </div>

          <Divider />

          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Cyclomatic Complexity</Title>
            <Text>
              Measures the number of linearly independent paths through a program's source code.
              Higher values indicate more complex code that is harder to test and maintain.
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><Text strong>1-10:</Text> Simple, low risk</li>
              <li><Text strong>11-20:</Text> Moderate complexity</li>
              <li><Text strong>21-50:</Text> Complex, high risk</li>
              <li><Text strong>50+:</Text> Very complex, very high risk</li>
            </ul>
          </div>

          <Divider />

          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Maintainability Index</Title>
            <Text>
              Calculated using cyclomatic complexity and lines of code. Higher values indicate
              more maintainable code.
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><Text strong>80-100:</Text> Excellent maintainability</li>
              <li><Text strong>60-79:</Text> Good maintainability</li>
              <li><Text strong>40-59:</Text> Fair maintainability</li>
              <li><Text strong>0-39:</Text> Poor maintainability</li>
            </ul>
          </div>

          <Divider />

          <div>
            <Title level={4}>Cycle Status</Title>
            <Text>
              Indicates whether the entity is involved in circular dependencies.
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><Text strong>Normal:</Text> No circular dependencies detected</li>
              <li><Text strong>Import Cycle:</Text> Circular import dependencies</li>
              <li><Text strong>Call Cycle:</Text> Circular function call dependencies</li>
              <li><Text strong>Self Reference:</Text> Entity references itself</li>
            </ul>
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Click on cycle status tags to view detailed circular dependency information.
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QualityMetricsPage;