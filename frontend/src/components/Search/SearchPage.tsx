// Entity Search Page Component
import React, { useState } from 'react'
import { 
  Card, 
  Input, 
  Select, 
  Button, 
  Table, 
  Space, 
  Tag, 
  Typography, 
  message, 
  Empty,
  Spin
} from 'antd'
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons'
import { ApiService } from '@/services/api'
import type { SearchRequest, SearchResponse, SearchResult } from '@/types/api'

const { Search } = Input
const { Option } = Select
const { Text, Link } = Typography

interface SearchPageProps {
  analysisId: string | null
}

const SearchPage: React.FC<SearchPageProps> = ({ analysisId }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [entityType, setEntityType] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  const entityTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'package', label: 'Package' },
    { value: 'module', label: 'Module' },
    { value: 'class', label: 'Class' },
    { value: 'method', label: 'Method' },
    { value: 'field', label: 'Field' }
  ]

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      message.warning('Please enter a search query')
      return
    }

    try {
      setLoading(true)
      
      const request: SearchRequest = {
        query: query.trim(),
        entity_type: entityType === 'all' ? undefined : entityType,
        analysis_id: analysisId
      }
      
      const response: SearchResponse = await ApiService.searchEntities(request)
      
      setSearchResults(response.results)
      setTotalResults(response.total_results)
      
      if (response.total_results === 0) {
        message.info('No results found for your search')
      } else {
        message.success(`Found ${response.total_results} results`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getEntityTypeColor = (type: string) => {
    const colors = {
      package: 'blue',
      module: 'green',
      class: 'orange',
      method: 'magenta',
      field: 'purple'
    }
    return colors[type as keyof typeof colors] || 'default'
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: SearchResult) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'entity_type',
      key: 'entity_type',
      render: (type: string) => (
        <Tag color={getEntityTypeColor(type)}>
          {type.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Module',
      dataIndex: 'module_path',
      key: 'module_path',
      render: (path: string) => <Text code>{path}</Text>
    },
    {
      title: 'File',
      dataIndex: 'file_path',
      key: 'file_path',
      render: (path: string, record: SearchResult) => (
        <div>
          <Text ellipsis style={{ maxWidth: 200 }} title={path}>
            {path}
          </Text>
          {record.line_number && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Line {record.line_number}
              </Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        description ? (
          <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
            {description}
          </Text>
        ) : (
          <Text type="secondary" italic>No description</Text>
        )
      )
    }
  ]

  if (!analysisId) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              Please complete an analysis first to search entities.
            </span>
          }
        />
      </Card>
    )
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="Search Entities">
        <Space.Compact style={{ width: '100%' }}>
          <Select
            value={entityType}
            onChange={setEntityType}
            style={{ width: 150 }}
          >
            {entityTypes.map(type => (
              <Option key={type.value} value={type.value}>
                {type.label}
              </Option>
            ))}
          </Select>
          
          <Search
            placeholder="Search for classes, methods, functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            loading={loading}
            enterButton={
              <Button type="primary" icon={<SearchOutlined />}>
                Search
              </Button>
            }
            style={{ flex: 1 }}
          />
        </Space.Compact>
      </Card>

      {searchResults.length > 0 && (
        <Card 
          title={`Search Results (${totalResults} found)`}
          extra={
            <Text type="secondary">
              Query: "{searchQuery}" in {entityType === 'all' ? 'all types' : entityType}
            </Text>
          }
        >
          <Spin spinning={loading}>
            <Table
              dataSource={searchResults}
              columns={columns}
              rowKey={(record) => `${record.entity_type}-${record.name}-${record.file_path}`}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} results`
              }}
              size="middle"
            />
          </Spin>
        </Card>
      )}

      {!loading && searchQuery && searchResults.length === 0 && totalResults === 0 && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No results found. Try different keywords or entity types."
          />
        </Card>
      )}
    </Space>
  )
}

export default SearchPage