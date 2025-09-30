"""
.gitignore 스타일 패턴 매칭 유틸리티

.gitignore와 동일한 패턴 매칭 규칙을 지원:
- * : 0개 이상의 문자 매칭 (/ 제외)
- ** : 모든 디렉토리 매칭
- / : 디렉토리 구분자
- [abc] : 문자 클래스
- ! : 부정 패턴 (제외하지 않음)
"""

import fnmatch
import os
from pathlib import Path, PurePath
from typing import List, Union


class GitIgnorePatternMatcher:
    """
    .gitignore 스타일 패턴 매칭을 처리하는 클래스
    """

    def __init__(self, patterns: List[str]):
        """
        패턴 목록으로 매처 초기화

        Args:
            patterns: .gitignore 스타일 패턴 목록
        """
        self.include_patterns = []  # 포함할 패턴들 (! 로 시작)
        self.exclude_patterns = []  # 제외할 패턴들

        for pattern in patterns:
            pattern = pattern.strip()
            if not pattern or pattern.startswith('#'):
                continue

            if pattern.startswith('!'):
                # 부정 패턴 (제외하지 않음)
                self.include_patterns.append(pattern[1:])
            else:
                self.exclude_patterns.append(pattern)

    def should_exclude(self, file_path: Union[str, Path]) -> bool:
        """
        주어진 파일/디렉토리 경로가 제외되어야 하는지 확인

        Args:
            file_path: 확인할 파일/디렉토리 경로

        Returns:
            True if 제외되어야 함, False otherwise
        """
        path_str = str(file_path)
        path_obj = Path(path_str)

        # 먼저 제외 패턴들을 확인
        excluded = False
        for pattern in self.exclude_patterns:
            if self._match_pattern(path_str, path_obj, pattern):
                excluded = True
                break

        if not excluded:
            return False

        # 부정 패턴 확인 (제외에서 다시 포함)
        for pattern in self.include_patterns:
            if self._match_pattern(path_str, path_obj, pattern):
                return False

        return excluded

    def _match_pattern(self, path_str: str, path_obj: Path, pattern: str) -> bool:
        """
        개별 패턴과 경로를 매칭

        Args:
            path_str: 문자열 경로
            path_obj: Path 객체
            pattern: 매칭할 패턴

        Returns:
            True if 매칭됨, False otherwise
        """
        # 절대 경로 패턴 (/ 로 시작)
        if pattern.startswith('/'):
            pattern = pattern[1:]
            return fnmatch.fnmatch(path_str, pattern)

        # 디렉토리 패턴 (/ 로 끝남)
        if pattern.endswith('/'):
            pattern = pattern[:-1]
            if path_obj.is_dir():
                return self._match_name_parts(path_obj, pattern)
            return False

        # ** 패턴 처리
        if '**' in pattern:
            return self._match_double_star(path_str, pattern)

        # 일반 패턴
        return self._match_name_parts(path_obj, pattern)

    def _match_name_parts(self, path_obj: Path, pattern: str) -> bool:
        """
        경로의 각 부분과 패턴을 매칭
        """
        # 전체 경로 매칭
        if fnmatch.fnmatch(str(path_obj), pattern):
            return True

        # 파일명만 매칭
        if fnmatch.fnmatch(path_obj.name, pattern):
            return True

        # 경로의 각 부분 매칭
        for part in path_obj.parts:
            if fnmatch.fnmatch(part, pattern):
                return True

        return False

    def _match_double_star(self, path_str: str, pattern: str) -> bool:
        """
        ** 패턴 매칭 (모든 디렉토리 레벨)
        """
        # ** 를 * 로 변경하여 fnmatch 사용
        # fnmatch에서는 ** 를 직접 지원하지 않으므로 변환 필요

        if pattern == '**':
            return True

        # **/pattern 형태
        if pattern.startswith('**/'):
            sub_pattern = pattern[3:]
            return fnmatch.fnmatch(os.path.basename(path_str), sub_pattern)

        # pattern/** 형태
        if pattern.endswith('/**'):
            dir_pattern = pattern[:-3]
            return fnmatch.fnmatch(os.path.dirname(path_str), dir_pattern)

        # 일반적인 ** 포함 패턴
        # ** 를 임시로 치환하여 처리
        temp_pattern = pattern.replace('**', '*')
        return fnmatch.fnmatch(path_str, temp_pattern)


def create_gitignore_matcher(patterns: List[str]) -> GitIgnorePatternMatcher:
    """
    .gitignore 스타일 패턴 매처 생성

    Args:
        patterns: 패턴 목록

    Returns:
        GitIgnorePatternMatcher 인스턴스
    """
    return GitIgnorePatternMatcher(patterns)


# 편의 함수들
def should_exclude_path(file_path: Union[str, Path], patterns: List[str]) -> bool:
    """
    주어진 경로가 패턴들에 의해 제외되어야 하는지 확인
    """
    matcher = create_gitignore_matcher(patterns)
    return matcher.should_exclude(file_path)


def filter_paths(paths: List[Union[str, Path]], patterns: List[str]) -> List[Union[str, Path]]:
    """
    경로 목록을 패턴으로 필터링
    """
    matcher = create_gitignore_matcher(patterns)
    return [path for path in paths if not matcher.should_exclude(path)]