#!/usr/bin/env python3
import re

# 파일 읽기
with open('HierarchicalNetworkGraph.tsx', 'r') as f:
    content = f.read()

# 1. extractClassId 함수 추가
extract_class_id_function = '''
  // 클래스 ID 추출 (method/field에서)
  const extractClassId = (nodeId: string): string | null => {
    // method:package.module:ClassName:methodName → cls:package.module:ClassName
    // field:package.module:ClassName:fieldName → cls:package.module:ClassName
    if (nodeId.startsWith('method:') || nodeId.startsWith('field:')) {
      const parts = nodeId.split(':');
      if (parts.length >= 3) {
        return `cls:${parts[1]}:${parts[2]}`;
      }
    }
    return null;
  };
'''

# extractModuleId 함수 다음에 삽입
insertion_point = content.find('  // 컨테이너 요소 생성')
if insertion_point != -1:
    content = content[:insertion_point] + extract_class_id_function + '\n' + content[insertion_point:]

# 2. identifyClusters 함수에서 클래스 클러스터 추가
# const classClusters 라인 추가
clusters_line = "    const moduleClusters = new Map<string, ClusterContainer>();"
new_clusters_line = clusters_line + "\n    const classClusters = new Map<string, ClusterContainer>();"
content = content.replace(clusters_line, new_clusters_line)

# Class 클러스터 식별 로직 추가
class_cluster_logic = '''
      
      // Class 클러스터 식별 (method/field 노드들을 그룹핑)
      if (node.type === 'method' || node.type === 'field') {
        const classId = extractClassId(node.id);
        if (classId && !classClusters.has(classId)) {
          const moduleId = extractModuleId(classId);
          classClusters.set(classId, {
            id: `class-cluster-${classId}`,
            type: 'class-cluster',
            name: `🏷️ ${classId.split(':').pop() || classId}`,
            children: [],
            parentCluster: moduleId ? `module-cluster-${moduleId}` : undefined
          });
        }
        if (classId) {
          classClusters.get(classId)!.children.push(node.id);
        }
      }'''

# 마지막 } 전에 삽입할 위치 찾기
insert_before = "    });"
insert_position = content.find(insert_before, content.find("nodes.forEach(node => {"))
if insert_position != -1:
    content = content[:insert_position] + class_cluster_logic + '\n' + content[insert_position:]

# return 문 수정
old_return = '''    return {
      packages: Array.from(packageClusters.values()),
      modules: Array.from(moduleClusters.values())
    };'''

new_return = '''    return {
      packages: Array.from(packageClusters.values()),
      modules: Array.from(moduleClusters.values()),
      classes: Array.from(classClusters.values())
    };'''

content = content.replace(old_return, new_return)

# 파일 쓰기
with open('HierarchicalNetworkGraph.tsx', 'w') as f:
    f.write(content)

print('Class 클러스터링 기본 구조 추가 완료')
