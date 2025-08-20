#!/usr/bin/env python3
import re

# 파일 읽기
with open('HierarchicalNetworkGraph.tsx', 'r') as f:
    content = f.read()

# 모듈 컨테이너 스타일 다음에 클래스 컨테이너 스타일 추가
class_container_style = '''    
    // 클래스 컨테이너 스타일
    {
      selector: '.class-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#f0f9ff',
        'background-opacity': 0.06,
        'border-width': 1,
        'border-style': 'dotted',
        'border-color': '#1890ff',
        'border-opacity': 0.6,
        'content': '',  // 클러스터 라벨 숨김
        'text-opacity': 0,  // 텍스트 완전 숨김
        'padding': `${Math.round(containerPadding * 0.5)}px`,
        'width': 100,
        'height': 80,
        'z-index': 3,
        'overlay-opacity': 0,
        'events': 'no'
      }
    },'''

# 모듈 컨테이너 스타일 다음에 삽입
insert_after_module = '''    // 모듈 컨테이너 스타일
    {
      selector: '.module-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#f9f0ff',
        'background-opacity': 0.08,
        'border-width': 2,
        'border-style': 'dashed',
        'border-color': '#722ed1',
        'border-opacity': 0.7,
        'content': '',  // 클러스터 라벨 숨김
        'text-opacity': 0,  // 텍스트 완전 숨김
        'padding': `${Math.round(containerPadding * 0.7)}px`,
        'width': 150,
        'height': 100,
        'z-index': 2,
        'overlay-opacity': 0,
        'events': 'no'
      }
    },'''

content = content.replace(insert_after_module, insert_after_module + class_container_style)

# 하이라이트 처리에서 class-container도 제외하도록 수정
# 여러 곳에서 module-container와 함께 체크하는 부분들 찾아서 수정

# 1. setupEventHandlers에서
old_highlight_check1 = "if (highlightMode && nodeData.type !== 'package-container' && nodeData.type !== 'module-container') {"
new_highlight_check1 = "if (highlightMode && nodeData.type !== 'package-container' && nodeData.type !== 'module-container' && nodeData.type !== 'class-container') {"
content = content.replace(old_highlight_check1, new_highlight_check1)

# 2. handleHierarchicalHighlight에서
old_highlight_check2 = "return nodeType !== 'package-container' && nodeType !== 'module-container';"
new_highlight_check2 = "return nodeType !== 'package-container' && nodeType !== 'module-container' && nodeType !== 'class-container';"
content = content.replace(old_highlight_check2, new_highlight_check2)

# 3. dimmed 처리에서도 class-container 제외
old_dimmed_check = '''      const nonContainerNodes = cy.nodes().filter(node => {
        const nodeType = node.data('type');
        return nodeType !== 'package-container' && nodeType !== 'module-container';
      });'''
new_dimmed_check = '''      const nonContainerNodes = cy.nodes().filter(node => {
        const nodeType = node.data('type');
        return nodeType !== 'package-container' && nodeType !== 'module-container' && nodeType !== 'class-container';
      });'''
content = content.replace(old_dimmed_check, new_dimmed_check)

# 파일 쓰기
with open('HierarchicalNetworkGraph.tsx', 'w') as f:
    f.write(content)

print('클래스 컨테이너 스타일 및 하이라이트 로직 추가 완료')
