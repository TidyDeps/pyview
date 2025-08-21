# -*- coding: utf-8 -*-
"""CLI 진입점들
"""
from __future__ import print_function
import json
import os
import sys

from pydeps.configs import Config
from . import py2depgraph, cli, dot, target
from .depgraph2dot import dep2dot  # , cycles2dot
import logging
from . import colors
log = logging.getLogger(__name__)


def _pydeps(trgt, **kw):
    # 함수들한테 넘겨야 해서 args를 **kw dict로 전달하는데,
    # 코드 좀 더 예쁘게 (그리고 에러 덜 나게) 만들려고
    # 로컬에서 쓸 파라미터들 먼저 빼둠
    # print("KW:", kw, '\n', os.getcwd())  # 디버깅용
    # print('abspath:', os.path.abspath(kw.get('deps_out')))  # 경로 확인
    # print('target', trgt.workdir)  # 타겟 작업 디렉토리
    # print('target', trgt)  # 타겟 객체
    colors.START_COLOR = kw.get('start_color')
    # show_cycles = kw.get('show_cycles')  # 순환 의존성 보여줄지
    nodot = kw.get('no_dot')
    no_output = kw.get('no_output')
    output = kw.get('output')
    fmt = kw['format']
    show_svg = kw.get('show')
    deps_out = kw.get('deps_out')
    dot_out = kw.get('dot_out')
    # reverse = kw.get('reverse')  # 역방향으로 그릴지
    if os.getcwd() != trgt.workdir:
        # 테스트에서 _pydeps 직접 호출하는 경우
        os.chdir(trgt.workdir)

    dep_graph = py2depgraph.py2dep(trgt, **kw)

    if kw.get('show_deps'):
        cli.verbose("DEPS:")
        if deps_out:
            # 출력 파일이 이상한 곳에 안 가도록 체크
            directory, _fname = os.path.split(deps_out)
            if not directory:
                deps_out = os.path.join(trgt.calling_dir, deps_out)
            with open(deps_out, 'w') as fp:
                fp.write(dep_graph.__json__())
        else:
            print(dep_graph.__json__())

    dotsrc = depgraph_to_dotsrc(trgt, dep_graph, **kw)

    if not nodot:
        if kw.get('show_dot'):
            cli.verbose("DOTSRC:")
            if dot_out:
                # make sure output files are written to sensible directories
                directory, _fname = os.path.split(dot_out)
                if not directory:
                    dot_out = os.path.join(trgt.calling_dir, dot_out)
                with open(dot_out, 'w') as fp:
                    fp.write(dotsrc)
            else:
                print(dotsrc)

        if not no_output:
            try:
                svg = dot.call_graphviz_dot(dotsrc, fmt)
            except OSError as cause:
                raise RuntimeError("While rendering {!r}: {}".format(output, cause))
            if fmt == 'svg':
                svg = svg.replace(b'</title>', b'</title><style>.edge>path:hover{stroke-width:8}</style>')

            try:
                with open(output, 'wb') as fp:
                    cli.verbose("Writing output to:", output)
                    fp.write(svg)
            except OSError as cause:
                raise RuntimeError("While writing {!r}: {}".format(output, cause))

            if show_svg:
                try:
                    dot.display_svg(kw, output)
                except OSError as cause:
                    helpful = ""
                    if cause.errno == 2:
                        helpful = " (can be caused by not finding the program to open this file)"
                    raise RuntimeError("While opening {!r}: {}{}".format(output, cause, helpful))


def depgraph_to_dotsrc(target, dep_graph, **kw):
    """Convert the dependency graph (DepGraph class) to dot source code.
    """
    # if kw.get('show_cycles'):
    #     dotsrc = cycles2dot(target, dep_graph, **kw)
    # el
    if not kw.get('no_dot'):
        dotsrc = dep2dot(target, dep_graph, **kw)
    else:
        dotsrc = None
    return dotsrc


def externals(trgt, **kwargs):
    """Return a list of direct external dependencies of ``pkgname``.
       Called for the ``pydeps --externals`` command.
    """
    kw = dict(
        T='svg', config=None, debug=False, display=None, exclude=[], exclude_exact=[],
        externals=True, format='svg', max_bacon=2**65, no_config=True, nodot=False,
        noise_level=2**65, no_show=True, output=None, pylib=True, pylib_all=True,
        show=False, show_cycles=False, show_deps=False, show_dot=False,
        show_raw_deps=False, verbose=0, include_missing=True, start_color=0
    )
    kw.update(kwargs)
    depgraph = py2depgraph.py2dep(trgt, **kw)
    pkgname = trgt.fname
    log.info("DEPGRAPH: %s", depgraph)
    pkgname = os.path.splitext(pkgname)[0]

    res = {}
    ext = set()

    for k, src in list(depgraph.sources.items()):
        if k.startswith('_'):
            continue
        if not k.startswith(pkgname):
            continue
        if src.imports:
            imps = [imp for imp in src.imports if not imp.startswith(pkgname)]
            if imps:
                for imp in imps:
                    ext.add(imp.split('.')[0])
                res[k] = imps
    # return res  # debug
    return list(sorted(ext))


def pydeps(**args):
    """Entry point for the ``pydeps`` command.

       This function should do all the initial parameter and environment
       munging before calling ``_pydeps`` (so that function has a clean
       execution path).
    """
    sys.setrecursionlimit(10000)
    _args = dict(iter(Config(**args))) if args else cli.parse_args(sys.argv[1:])
    _args['curdir'] = os.getcwd()
    inp = target.Target(_args['fname'])
    log.debug("Target: %r", inp)

    if _args.get('output'):
        _args['output'] = os.path.abspath(_args['output'])
    else:
        _args['output'] = os.path.join(
            inp.calling_dir,
            inp.modpath.replace('.', '_') + '.' + _args.get('format', 'svg')
        )

    with inp.chdir_work():
        # log.debug("Current directory: %s", os.getcwd())
        _args['fname'] = inp.fname
        _args['isdir'] = inp.is_dir

        if _args.get('externals'):
            del _args['fname']
            exts = externals(inp, **_args)
            print(json.dumps(exts, indent=4))
            # return exts  # so the tests can assert

        else:
            # this is the call you're looking for :-)
            try:
                return _pydeps(inp, **_args)
            except (OSError, RuntimeError) as cause:
                if log.isEnabledFor(logging.DEBUG):
                    # we only want to log the exception if we're in debug mode
                    log.exception("While running pydeps:")
                cli.error(str(cause))


def call_pydeps(file_or_dir, **kwargs):
    """Programatic entry point for pydeps.

       See :class:`pydeps.configs.Config` class for the available options.
    """
    sys.setrecursionlimit(10000)
    inp = target.Target(file_or_dir)
    log.debug("Target: %r", inp)
    config = Config(**kwargs)

    if config.output:
        config.output = os.path.abspath(config.output)
    else:
        config.output = os.path.join(
            inp.calling_dir,
            inp.modpath.replace('.', '_') + '.' + config.format
        )

    ctx = dict(iter(config))

    with inp.chdir_work():
        ctx['fname'] = inp.fname
        ctx['isdir'] = inp.is_dir
        if config.externals:
            del ctx['fname']
            return externals(inp, **ctx)

        return _pydeps(inp, **ctx)


if __name__ == '__main__':  # pragma: nocover
    pydeps()
