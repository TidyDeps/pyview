import React, { useState, useEffect } from 'react';
import { Card, Tree, Row, Col, Statistic, Tag, Typography, Spin, Button, Select } from 'antd';
import {
  ApartmentOutlined,
  FolderOutlined,
  FileOutlined,
  AppstoreOutlined,
  FunctionOutlined,
  BugOutlined
} from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import ApiService from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

interface HierarchyViewProps {
  analysisId: string | null;
}

interface HierarchyNode {
  id: string;
  name: string;
  type: 'package' | 'module' | 'class' | 'method' | 'field';
  file_path?: string;
  line_number?: number;
  children?: HierarchyNode[];
  metrics?: {
    complexity?: number;
    lines_of_code?: number;
    dependencies?: number;
  };
}

const HierarchyView: React.FC<HierarchyViewProps> = ({ analysisId }) => {
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Data fetching
  const fetchHierarchyData = async () => {
    if (!analysisId) return;
    
    setLoading(true);
    try {
      // Fetch actual analysis results
      const results = await ApiService.getAnalysisResults(analysisId);
      
      if (!results || !results.dependency_graph) {
        setHierarchyData([]);
        return;
      }
      
      const { dependency_graph } = results;
      
      // Build hierarchy from actual data
      const packagesMap = new Map<string, HierarchyNode>();
      const modulesMap = new Map<string, HierarchyNode>();
      
      // Create package nodes
      if (dependency_graph.packages) {
        dependency_graph.packages.forEach((pkg: any) => {
          const packageNode: HierarchyNode = {
            id: pkg.id || pkg.name,
            name: pkg.name,
            type: 'package',
            children: [],
            metrics: {
              complexity: pkg.modules?.length || 0,
              lines_of_code: 0,
              dependencies: 0
            }
          };
          packagesMap.set(pkg.name, packageNode);
        });
      }
      
      // Create module nodes
      if (dependency_graph.modules) {
        dependency_graph.modules.forEach((module: any) => {
          const moduleNode: HierarchyNode = {
            id: module.id || module.name,
            name: module.name,
            type: 'module',
            file_path: module.file_path,
            children: [],
            metrics: {
              complexity: module.complexity || 5,
              lines_of_code: module.loc || 100,
              dependencies: module.dependencies?.length || 0
            }
          };
          
          modulesMap.set(module.id || module.name, moduleNode);
          
          // Try to find parent package
          const packageName = module.name.split('.')[0];
          const parentPackage = packagesMap.get(packageName);
          if (parentPackage) {
            parentPackage.children!.push(moduleNode);
          }
        });
      }
      
      // Add classes to modules
      if (dependency_graph.classes) {
        dependency_graph.classes.forEach((cls: any) => {
          const classNode: HierarchyNode = {
            id: cls.id || cls.name,
            name: cls.name,
            type: 'class',
            file_path: cls.file_path,
            line_number: cls.line_number,
            children: [],
            metrics: {
              complexity: cls.methods?.length * 2 || 4,
              lines_of_code: cls.methods?.length * 15 || 80,
              dependencies: 1
            }
          };
          
          // Find parent module
          const parentModule = modulesMap.get(cls.module || '');
          if (parentModule) {
            parentModule.children!.push(classNode);
          }
          
          // Add methods to class
          if (cls.methods && Array.isArray(cls.methods)) {
            cls.methods.forEach((method: any) => {
              const methodNode: HierarchyNode = {
                id: method.id || method.name,
                name: method.name + '()',
                type: 'method',
                file_path: method.file_path,
                line_number: method.line_number,
                metrics: {
                  complexity: method.complexity || 2,
                  lines_of_code: method.lines_of_code || 15
                }
              };
              classNode.children!.push(methodNode);
            });
          }
        });
      }
      
      // Convert to array and filter out empty packages
      const hierarchyData = Array.from(packagesMap.values())
        .filter(pkg => pkg.children && pkg.children.length > 0);
      
      // If no packages, create a flat structure with modules
      if (hierarchyData.length === 0 && dependency_graph.modules) {
        const moduleNodes = Array.from(modulesMap.values());
        setHierarchyData(moduleNodes);
        setExpandedKeys(moduleNodes.map(node => node.id));
      } else {
        setHierarchyData(hierarchyData);
        setExpandedKeys(hierarchyData.map(node => node.id));
      }
      
    } catch (error) {
      console.error('Failed to fetch hierarchy data:', error);
      setHierarchyData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchyData();
  }, [analysisId]);

  const getNodeIcon = (type: string, complexity?: number) => {
    const getComplexityColor = (complexity: number) => {
      if (complexity <= 5) return '#52c41a';
      if (complexity <= 10) return '#faad14';
      return '#f5222d';
    };

    switch (type) {
      case 'package':
        return <FolderOutlined style={{ color: '#1890ff' }} />;
      case 'module':
        return <FileOutlined style={{ color: '#722ed1' }} />;
      case 'class':
        return <AppstoreOutlined style={{ color: '#fa8c16' }} />;
      case 'method':
        return <FunctionOutlined 
          style={{ color: complexity ? getComplexityColor(complexity) : '#13c2c2' }} 
        />;
      case 'field':
        return <BugOutlined style={{ color: '#eb2f96' }} />;
      default:
        return <FileOutlined />;
    }
  };

  const convertToTreeData = (nodes: HierarchyNode[]): TreeDataNode[] => {
    return nodes
      .filter(node => {
        if (selectedLevel === 'all') return true;
        return node.type === selectedLevel;
      })
      .map(node => ({
        key: node.id,
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {getNodeIcon(node.type, node.metrics?.complexity)}
            <span>{node.name}</span>
            {node.metrics?.complexity && (
              <Tag color={node.metrics.complexity <= 5 ? 'green' : node.metrics.complexity <= 10 ? 'orange' : 'red'}>
                C: {node.metrics.complexity}
              </Tag>
            )}
            {node.metrics?.lines_of_code && (
              <Tag color="blue">
                LOC: {node.metrics.lines_of_code}
              </Tag>
            )}
          </div>
        ),
        children: node.children ? convertToTreeData(node.children) : undefined,
      }));
  };

  const getStatistics = () => {
    const countNodes = (nodes: HierarchyNode[], type?: string): number => {
      let count = 0;
      for (const node of nodes) {
        if (!type || node.type === type) count++;
        if (node.children) count += countNodes(node.children, type);
      }
      return count;
    };

    return {
      total: countNodes(hierarchyData),
      packages: countNodes(hierarchyData, 'package'),
      modules: countNodes(hierarchyData, 'module'),
      classes: countNodes(hierarchyData, 'class'),
      methods: countNodes(hierarchyData, 'method'),
      fields: countNodes(hierarchyData, 'field')
    };
  };

  const stats = getStatistics();

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApartmentOutlined />
            Project Hierarchy
          </Title>
          <Select
            value={selectedLevel}
            onChange={setSelectedLevel}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="all">All Levels</Option>
            <Option value="package">Packages</Option>
            <Option value="module">Modules</Option>
            <Option value="class">Classes</Option>
            <Option value="method">Methods</Option>
            <Option value="field">Fields</Option>
          </Select>
        </div>
      }
      style={{ height: '100%' }}
    >
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Statistic title="Total" value={stats.total} />
          </Col>
          <Col span={4}>
            <Statistic title="Packages" value={stats.packages} />
          </Col>
          <Col span={4}>
            <Statistic title="Modules" value={stats.modules} />
          </Col>
          <Col span={4}>
            <Statistic title="Classes" value={stats.classes} />
          </Col>
          <Col span={4}>
            <Statistic title="Methods" value={stats.methods} />
          </Col>
          <Col span={4}>
            <Statistic title="Fields" value={stats.fields} />
          </Col>
        </Row>
        
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Button 
            size="small"
            onClick={() => {
              const getAllKeys = (nodes: HierarchyNode[]): string[] => {
                let keys: string[] = [];
                for (const node of nodes) {
                  keys.push(node.id);
                  if (node.children) {
                    keys = keys.concat(getAllKeys(node.children));
                  }
                }
                return keys;
              };
              setExpandedKeys(getAllKeys(hierarchyData));
            }}
          >
            Expand All
          </Button>
          <Button 
            size="small"
            onClick={() => setExpandedKeys([])}
          >
            Collapse All
          </Button>
        </div>

        <Tree
          treeData={convertToTreeData(hierarchyData)}
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          height={400}
          style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: 6, 
            padding: 8,
            backgroundColor: '#fafafa'
          }}
        />
      </Spin>
    </Card>
  );
};

export default HierarchyView;