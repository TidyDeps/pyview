#!/usr/bin/env python3
import re

# 파일 읽기
with open('HierarchicalNetworkGraph.tsx', 'r') as f:
    content = f.read()

# 1. createContainerElements 함수 확장
old_create_container = '''  // 컨테이너 요소 생성
  const createContainerElements = (clusters: { packages: ClusterContainer[], modules: ClusterContainer[] }) => {'''

new_create_container = '''  // 컨테이너 요소 생성  
  const createContainerElements = (clusters: { packages: ClusterContainer[], modules: ClusterContainer[], classes: ClusterContainer[] }) => {'''

content = content.replace(old_create_container, new_create_container)

# Class 컨테이너 생성 로직 추가
class_container_logic = '''
    
    // 클래스 컨테이너
    clusters.classes.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            type: 'class-container',
            parent: cluster.parentCluster
          },
          classes: 'class-container'
        });
      }
    });'''

# 모듈 컨테이너 다음에 추가
insert_after = '''    // 모듈 컨테이너
    clusters.modules.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            type: 'module-container',
            parent: cluster.parentCluster
          },
          classes: 'module-container'
        });
      }
    });'''

content = content.replace(insert_after, insert_after + class_container_logic)

# 2. assignNodesToContainers 함수 확장
old_assign_nodes = '''  // 노드를 컨테이너에 할당
  const assignNodesToContainers = (nodes: HierarchicalNode[], clusters: { packages: ClusterContainer[], modules: ClusterContainer[] }) => {'''

new_assign_nodes = '''  // 노드를 컨테이너에 할당
  const assignNodesToContainers = (nodes: HierarchicalNode[], clusters: { packages: ClusterContainer[], modules: ClusterContainer[], classes: ClusterContainer[] }) => {'''

content = content.replace(old_assign_nodes, new_assign_nodes)

# Method/Field 노드를 클래스 컨테이너에 할당하는 로직 추가
method_field_assignment = '''
      
      // Method/Field 노드 → 클래스 컨테이너
      if (node.type === 'method' || node.type === 'field') {
        const classId = extractClassId(node.id);
        if (classId) {
          const classCluster = clusters.classes.find(c => c.id === `class-cluster-${classId}`);
          if (classCluster && classCluster.children?.includes(node.id)) {
            parentContainer = classCluster.id;
          }
        }
      }'''

# 클래스 노드 할당 로직 다음에 추가
insert_after_class = '''      // 클래스 노드 → 모듈 컨테이너
      if (node.type === 'class') {
        const moduleId = extractModuleId(node.id);
        if (moduleId) {
          const moduleCluster = clusters.modules.find(c => c.id === `module-cluster-${moduleId}`);
          if (moduleCluster && moduleCluster.children?.includes(node.id)) {
            parentContainer = moduleCluster.id;
          }
        }
      }'''

content = content.replace(insert_after_class, insert_after_class + method_field_assignment)

# 파일 쓰기
with open('HierarchicalNetworkGraph.tsx', 'w') as f:
    f.write(content)

print('createContainerElements 및 assignNodesToContainers 확장 완료')
