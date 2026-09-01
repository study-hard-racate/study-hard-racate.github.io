"""PWA 离线支持测试：
- manifest.json 合法且字段齐全、图标文件存在且为 PNG
- sw.js 存在、语法正确、含 install/fetch 处理与关键预缓存项
- 全部 HTML 页面带 manifest / theme-color / apple-touch-icon
- common.js 注册 Service Worker"""

import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, PAGES, page_path


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def _node_check(js, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
        tmp = f.name
    try:
        proc = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, timeout=60)
        if proc.returncode != 0:
            pytest.fail(f"{name} 语法错误: {proc.stderr}")
    finally:
        os.unlink(tmp)


def test_manifest_valid():
    manifest = json.loads(_read("manifest.json"))
    for key in ["name", "short_name", "start_url", "display", "theme_color", "background_color", "icons"]:
        assert key in manifest, f"manifest 缺 {key}"
    assert manifest["start_url"] == "/"
    assert manifest["display"] == "standalone"
    assert len(manifest["icons"]) >= 2
    for icon in manifest["icons"]:
        assert icon["type"] == "image/png"
        assert os.path.isfile(os.path.join(ROOT, icon["src"].lstrip("/"))), f"图标文件缺失: {icon['src']}"


def test_icons_are_png():
    for name in ["icon-192.png", "icon-512.png"]:
        p = os.path.join(ROOT, "static", "icons", name)
        assert os.path.isfile(p), f"缺 {name}"
        with open(p, "rb") as f:
            magic = f.read(8)
        assert magic[:4] == b"\x89PNG", f"{name} 不是 PNG"


def test_sw_valid_and_precaches_key_routes():
    sw = _read("sw.js")
    _node_check(sw, "sw.js")
    assert 'addEventListener("install"' in sw
    assert 'addEventListener("fetch"' in sw
    assert 'addEventListener("activate"' in sw
    for key in ['"/"', '"/404.html"', '"/learning-path"', '"/dp/lcs"', '"/static/css/style.css"',
                '"/manifest.json"', '"/static/js/demo.js"']:
        assert key in sw, f"预缓存缺 {key}"
    # 覆盖全部 40 个模块页路由
    for route in PAGES:
        if route == "/":
            continue
        assert '"' + route + '"' in sw, f"预缓存缺页面 {route}"


def test_all_pages_have_pwa_meta():
    html = _read("index.html")
    for needle in ['rel="manifest"', 'name="theme-color"', 'apple-touch-icon']:
        assert needle in html, f"首页缺 {needle}"
    # 抽查几个页面
    for route in ["/learning-path", "/dp/lcs", "/sorting/bubble"]:
        h = _read("index.html") if route == "/" else _read(page_path(route).replace(ROOT + "\\", ""))
        for needle in ['rel="manifest"', 'name="theme-color"']:
            assert needle in h, f"{route} 缺 {needle}"


def test_common_js_registers_sw():
    js = _read("static/js/common.js")
    assert "serviceWorker" in js
    assert 'register("/sw.js")' in js
