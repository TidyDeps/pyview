import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Progress, Tag, Typography, Statistic, Empty, message } from 'antd';
import { CheckCircleOutlined, WarningOutlined, AppstoreOutlined, DashboardOutlined } from '@ant-design/icons';
import { QualityMetrics } from '../../types/api';
import ApiService from '../../services/api';

const { Title, Text } = Typography;

interface QualityMetricsPageProps {
  analysisId: string | null;
}

const QualityMetricsPage: React.FC<QualityMetricsPageProps> = ({ analysisId }) => {
  const [metrics, setMetrics] = useState<QualityMetrics[]>([]);
  // const [filteredMetrics, setFilteredMetrics] = useState<QualityMetrics[]>([]);
  // const [gradeFilter, setGradeFilter] = useState<string | undefined>(undefined);
  // const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!analysisId) return;

    let isMounted = true;
    const abortController = new AbortController();

    const fetchMetrics = async () => {
      try {
        const response = await ApiService.getQualityMetrics(analysisId);
        if (isMounted) {
          setMetrics(response);
          // setFilteredMetrics(response);
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
  // useEffect(() => {
  //   let filtered = metrics;
  //   
  //   if (gradeFilter) {
  //     filtered = filtered.filter(metric => metric.quality_grade === gradeFilter);
  //   }
  //   
  //   if (entityTypeFilter) {
  //     filtered = filtered.filter(metric => metric.entity_type === entityTypeFilter);
  //   }
  //   
  //   setFilteredMetrics(filtered);
  //   setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  // }, [metrics, gradeFilter, entityTypeFilter]);

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
      render: (id: string, record: QualityMetrics) => (
        <div>
          <Text strong>{id.split(':').pop()}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.entity_type}
          </Text>
        </div>
      )
    },
    {
      title: 'Quality Grade',
      dataIndex: 'quality_grade',
      key: 'grade',
      render: (grade: string) => (
        <Tag color={getGradeColor(grade)} style={{ fontSize: 14, fontWeight: 'bold' }}>
          {grade}
        </Tag>
      )
    },
    {
      title: 'Complexity',
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
      title: 'Maintainability',
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
      title: 'Coupling',
      key: 'coupling',
      render: (record: QualityMetrics) => (
        <div>
          <Text style={{ fontSize: 12 }}>
            In: {record.afferent_coupling} | Out: {record.efferent_coupling}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Instability: {record.instability.toFixed(2)}
          </Text>
        </div>
      )
    },
    {
      title: 'Tech Debt',
      dataIndex: 'technical_debt_ratio',
      key: 'tech_debt',
      render: (ratio: number) => {
        const percentage = ratio * 100;
        const status = percentage <= 10 ? 'success' : percentage <= 25 ? 'active' : 'exception';
        return (
          <Progress
            percent={percentage}
            status={status}
            strokeWidth={8}
            format={() => `${percentage.toFixed(1)}%`}
          />
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
        // extra={
        //   <Space>
        //     <FilterOutlined />
        //     <Select
        //       placeholder="Filter by Grade"
        //       allowClear
        //       style={{ width: 120 }}
        //       value={gradeFilter}
        //       onChange={setGradeFilter}
        //     >
        //       <Select.Option value="A">Grade A</Select.Option>
        //       <Select.Option value="B">Grade B</Select.Option>
        //       <Select.Option value="C">Grade C</Select.Option>
        //       <Select.Option value="D">Grade D</Select.Option>
        //       <Select.Option value="F">Grade F</Select.Option>
        //     </Select>
        //     <Select
        //       placeholder="Filter by Type"
        //       allowClear
        //       style={{ width: 120 }}
        //       value={entityTypeFilter}
        //       onChange={setEntityTypeFilter}
        //     >
        //       <Select.Option value="module">Module</Select.Option>
        //       <Select.Option value="class">Class</Select.Option>
        //       <Select.Option value="method">Method</Select.Option>
        //     </Select>
        //   </Space>
        // }
      >
        <Table
          columns={columns}
          dataSource={metrics}
          rowKey="entity_id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: metrics.length,
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
    </div>
  );
};

export default QualityMetricsPage;