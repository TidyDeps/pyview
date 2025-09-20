#!/usr/bin/env python3
"""
PyView 통합 실행 스크립트
백엔드와 프론트엔드를 동시에 실행합니다.
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

def check_requirements():
    """실행 전 필요 조건 확인"""
    current_dir = Path(__file__).parent

    # Node.js 확인
    try:
        subprocess.run(['node', '--version'], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Node.js가 설치되지 않았습니다. https://nodejs.org 에서 설치해주세요.")
        return False

    # npm 확인
    try:
        subprocess.run(['npm', '--version'], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ npm이 설치되지 않았습니다.")
        return False

    # 프론트엔드 의존성 확인
    frontend_dir = current_dir / 'frontend'
    node_modules = frontend_dir / 'node_modules'

    if not node_modules.exists():
        print("📦 프론트엔드 의존성을 설치하는 중...")
        try:
            subprocess.run(['npm', 'install'], cwd=frontend_dir, check=True)
            print("✅ 프론트엔드 의존성 설치 완료")
        except subprocess.CalledProcessError:
            print("❌ 프론트엔드 의존성 설치 실패")
            return False

    return True

def start_servers():
    """백엔드와 프론트엔드 서버 시작"""
    current_dir = Path(__file__).parent
    server_dir = current_dir / 'server'
    frontend_dir = current_dir / 'frontend'

    print("🚀 PyView 서버를 시작합니다...")
    print("=" * 50)

    processes = []

    try:
        # 백엔드 서버 시작
        print("🔧 백엔드 서버 시작 중...")
        backend_process = subprocess.Popen(
            [sys.executable, 'app.py'],
            cwd=server_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        processes.append(('Backend', backend_process))

        # 백엔드 서버가 시작될 때까지 잠시 대기
        time.sleep(3)

        # 프론트엔드 서버 시작
        print("⚛️  프론트엔드 서버 시작 중...")
        frontend_process = subprocess.Popen(
            ['npm', 'run', 'dev'],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        processes.append(('Frontend', frontend_process))

        print("✅ 서버 시작 완료!")
        print("=" * 50)
        print("🌐 프론트엔드: http://localhost:3000")
        print("🔧 백엔드 API: http://localhost:8000")
        print("📖 API 문서: http://localhost:8000/docs")
        print("=" * 50)
        print("🛑 종료하려면 Ctrl+C를 누르세요")
        print("=" * 50)

        # 프로세스 모니터링
        while True:
            for name, process in processes:
                if process.poll() is not None:
                    print(f"❌ {name} 서버가 예상치 못하게 종료되었습니다.")
                    return

            # 출력 스트림 읽기 (non-blocking)
            for name, process in processes:
                try:
                    while True:
                        line = process.stdout.readline()
                        if not line:
                            break
                        # 중요한 로그만 출력
                        if any(keyword in line.lower() for keyword in ['error', 'warning', 'started', 'running']):
                            print(f"[{name}] {line.strip()}")
                except:
                    pass

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n🛑 서버를 종료하는 중...")

        # 모든 프로세스 종료
        for name, process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ {name} 서버 종료 완료")
            except subprocess.TimeoutExpired:
                process.kill()
                print(f"🔪 {name} 서버 강제 종료")
            except:
                pass

        print("👋 PyView 서버가 종료되었습니다.")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

        # 프로세스 정리
        for name, process in processes:
            try:
                process.terminate()
            except:
                pass

def main():
    """메인 실행 함수"""
    print("🎯 PyView - Interactive Python Dependency Visualization")
    print("=" * 50)

    # 필요 조건 확인
    if not check_requirements():
        print("❌ 실행 조건이 충족되지 않았습니다.")
        sys.exit(1)

    # 서버 시작
    start_servers()

if __name__ == '__main__':
    main()