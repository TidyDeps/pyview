# -*- coding: utf-8 -*-
"""
pydeps가 작업할 대상 추상화
"""
from __future__ import print_function
import json
import os
import re
import shutil
import sys
import tempfile
from contextlib import contextmanager
import logging
log = logging.getLogger(__name__)


class Target(object):
    """컴파일 대상 클래스
    """
    is_pysource = False
    is_module = False
    is_dir = False

    def __init__(self, path, **kwargs):
        """타겟 초기화

        Args:
            path: 모듈 경로

        Keyword Args:
            use_calling_fname (bool): `self.get_src_fname`에서 `fname` 대신 `calling_fname` 쓸지 결정
        """

        # log.debug("CURDIR: %s, path: %s, exists: %s", os.getcwd(), path, os.path.exists(path))  # 디버깅용
        # print("Target::CURDIR: %s, path: %s, exists: %s" % (os.getcwd(), path, os.path.exists(path)))  # 디버깅용

        self.calling_fname = path
        self.calling_dir = os.getcwd()
        self.exists = os.path.exists(path)
        self.use_calling_fname = kwargs.get('use_calling_fname', False)

        if self.exists:
            self.path = os.path.realpath(path)
        else:  # pragma: nocover  # 테스트에서 안 다루는 경우
            print("No such file or directory:", repr(path), file=sys.stderr)
            if os.path.exists(path + '.py'):
                print("..did you mean:", path + '.py', '?', file=sys.stderr)
            sys.exit(1)
        self.is_dir = os.path.isdir(self.path)
        self.is_module = self.is_dir and '__init__.py' in os.listdir(self.path)
        self.is_pysource = os.path.splitext(self.path)[1] in ('.py', '.pyc', '.pyo', '.pyw')
        self.fname = os.path.basename(self.path)
        if self.is_dir:
            self.dirname = self.fname
            self.modname = self.fname
        else:
            self.dirname = os.path.dirname(self.path)
            self.modname = os.path.splitext(self.fname)[0]

        if self.is_pysource:
            # we will work directly on the file (in-situ)
            self.workdir = os.path.dirname(self.path)
        else:
            self.workdir = os.path.realpath(tempfile.mkdtemp())

        self.syspath_dir = self.get_package_root()
        # split path such that syspath_dir + relpath == path
        self.relpath = self.path[len(self.syspath_dir):].lstrip(os.path.sep)
        if self.is_dir:
            self.modpath = self.relpath.replace(os.path.sep, '.')
        else:
            self.modpath = os.path.splitext(self.relpath)[0].replace(os.path.sep, '.')
        self.package_root = os.path.join(
            self.syspath_dir,
            self._path_parts(self.relpath)[0]
        )

    def get_src_fname(self):
        """Return the source file name to use."""
        log.debug("[get_src_fname] use_calling_name: %s", self.use_calling_fname)

        return self.calling_fname if self.use_calling_fname else self.fname

    @contextmanager
    def chdir_work(self):
        try:
            os.chdir(self.workdir)
            sys.path.insert(0, self.syspath_dir)
            yield
        finally:
            os.chdir(self.calling_dir)
            if sys.path[0] == self.syspath_dir:
                sys.path = sys.path[1:]
            self.close()

    def get_package_root(self):
        for d in self.get_parents():
            if '__init__.py' not in os.listdir(d):
                return d

        raise Exception(
            "do you have an __init__.py file at the "
            "root of the drive..?")  # pragma: nocover

    def get_parents(self):
        def _parent_iter():
            parts = self._path_parts(self.path)
            for i in range(1, len(parts)):
                yield os.path.join(*parts[:-i])
        return list(_parent_iter())

    def _path_parts(self, pth):
        """Return a list of all directories in the path ``pth``.
        """
        res = re.split(r"[\\/]", pth)
        if res and os.path.splitdrive(res[0]) == (res[0], ''):
            res[0] += os.path.sep
        return res

    def __del__(self):
        self.close()

    def close(self):
        """Clean up after ourselves.
        """
        try:
            # make sure we don't delete the user's source file if we're working
            # on it in-situ.
            if not self.is_pysource and hasattr(self, 'workdir'):
                shutil.rmtree(self.workdir)
        except OSError:
            pass

    def __repr__(self):  # pragma: nocover
        return json.dumps(
            {k: v for k, v in self.__dict__.items() if not k.startswith('_')},
            indent=4, sort_keys=True
        )
