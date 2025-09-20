#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""PyView - Interactive Python module dependency visualization
"""
# pragma: nocover
import io
import sys

import setuptools
from setuptools.command.test import test as TestCommand

version='3.0.1'


class PyTest(TestCommand):
    user_options = [('pytest-args=', 'a', "Arguments to pass to py.test")]

    def initialize_options(self):
        TestCommand.initialize_options(self)
        self.pytest_args = []

    def finalize_options(self):
        TestCommand.finalize_options(self)
        self.test_args = []
        self.test_suite = True

    def run_tests(self):
        # import here, cause outside the eggs aren't loaded
        import pytest
        errno = pytest.main(self.pytest_args)
        sys.exit(errno)


setuptools.setup(
    name='pyview',
    version=version,
    packages=setuptools.find_packages(exclude=['tests*']),
    python_requires=">=3.8",
    install_requires=[
        'stdlib_list',
    ],
    long_description=io.open('README.md', encoding='utf8').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/yourusername/pyview',  # 실제 GitHub URL로 변경 필요
    cmdclass={'test': PyTest},
    license='BSD',
    author='bjorn',
    author_email='bp@datakortet.no',
    maintainer='Your Name',  # 실제 이름으로 변경 필요
    maintainer_email='your.email@example.com',  # 실제 이메일로 변경 필요
    description='Interactive Python module dependency visualization with WebGL',
    keywords='Python Module Dependency graphs visualization interactive WebGL',
    classifiers=[
        'Development Status :: 4 - Beta',  # 개발 중이므로 Beta로 변경
        'Intended Audience :: Developers',
        'Natural Language :: English',
        'License :: OSI Approved :: BSD License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Software Development :: Quality Assurance',
        'Topic :: Scientific/Engineering :: Visualization',
    ]
)