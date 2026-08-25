"""静态站结构测试：所有页面存在、算法页含播放器/舞台/演示初始化、
全部 JS 语法正确、内联脚本语法正确（替代原 Flask 路由测试）。"""

import os
import re
import subprocess
import sys
import tempfile

import pytest

from conftest import ALL_PAGES, ALGO_PAGES, ROOT, PAGES, page_path

PLAYER_IDS = ["code-lines", "stage", "btn-play", "btn-next", "btn-prev", "btn-reset", "speed-slider", "step-info"]


@pytest.mark.parametrize("path", ALL_PAGES)
def test_page_exists(path):
    """每个路由都有对应的静态 HTML 且非空"""
    p = page_path(path)
    assert os.path.isfile(p), f"{path} 缺少文件 {PAGES[path]}"
    with open(p, encoding="utf-8") as f:
        assert f.read().strip(), f"{path} 文件为空"


def test_404_exists():
    assert os.path.isfile(os.path.join(ROOT, "404.html")), "缺少 404.html"


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_algo_page_has_player_and_stage(page, path):
    html = page(path)
    for el in PLAYER_IDS:
        assert f'id="{el}"' in html, f"{path} 缺少 id={el}"
    assert "player.js" in html, f"{path} 缺少 player.js"
    assert html.count('id="code-lines"') == 1


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_algo_page_has_c_code_and_steps(page, path):
    html = page(path)
    assert "code-lines" in html, f"{path} 缺少代码面板"
    assert "setupDemo(" in html, f"{path} 缺少演示初始化"
    assert "renderMode" in html, f"{path} 缺少渲染模式"


def _node_check(js_code, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js_code)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["node", "--check", tmp],
            capture_output=True, text=True, timeout=60,
        )
        if proc.returncode != 0:
            pytest.fail(f"{name} JS 语法错误:\n{proc.stderr}")
    finally:
        os.unlink(tmp)


def test_static_js_files_syntax():
    static_dir = os.path.join(ROOT, "static", "js")
    for fn in sorted(os.listdir(static_dir)):
        if fn.endswith(".js"):
            with open(os.path.join(static_dir, fn), encoding="utf-8") as f:
                _node_check(f.read(), f"static/js/{fn}")


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_inline_js_syntax(page, path):
    """模块页必须有内联 setupDemo 脚本且语法正确（列表页/首页只有外部 JS 引用，不在此列）"""
    html = page(path)
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    assert scripts, f"{path} 没有内联脚本"
    for i, code in enumerate(scripts):
        if code.strip():
            _node_check(code, f"{path} 内联脚本#{i}")


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_algo_page_has_stats_and_progress(page, path):
    """第一阶段交互增强的产物应存在于所有模块页"""
    html = page(path)
    assert 'id="step-stats"' in html, f"{path} 缺少统计面板"
    assert 'id="step-progress"' in html, f"{path} 缺少步骤进度条"
    assert 'id="step-comment"' in html, f"{path} 缺少步骤注释"


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_algo_page_has_complexity_card(page, path):
    html = page(path)
    assert "complexity-card" in html, f"{path} 缺少复杂度卡片"
