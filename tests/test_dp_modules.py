"""新增 DP 模块测试：从页面内联 setupDemo 提取 C 代码，
在 Node 中执行 csim.js，验证爬楼梯与 LIS 的动画结果正确。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

STAIRS = "/dp/stairs"
LIS = "/dp/lis"


def _load_csim():
    with open(os.path.join(ROOT, "static", "js", "csim.js"), encoding="utf-8") as f:
        return f.read()


def _extract_sample(path):
    """从页面提取 setupDemo 的 sample 字符串并还原为 C 代码"""
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    m = re.search(r'sample: "(.*?)", renderMode', html, re.S)
    assert m, f"{path} 未找到 sample"
    raw = m.group(1)
    # 还原 JS 字符串转义：\n \u003c \u0026 \" 等
    return codecs.decode(raw, "unicode_escape")


def _run_js(js_code, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js_code)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["node", tmp], capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
        )
        if proc.returncode != 0:
            pytest.fail(f"{name} 执行失败: {proc.stderr.strip()[:2000]}")
        return proc.stdout
    finally:
        os.unlink(tmp)


def _case(code, assert_js, name):
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + "const res = CSim.run(" + json.dumps(code) + ", {});\n"
          + assert_js + "\nconsole.log('ok');")
    return _run_js(js, name)


def test_stairs_dp_result_correct():
    """爬楼梯：dp 快照阶段齐全，dp[10] = 89（斐波那契）"""
    code = _extract_sample(STAIRS)
    out = _case(code, """
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
let phases = new Set(), dpSeen = 0;
for (const s of res.steps) {
  if (s.dp) {
    dpSeen++;
    phases.add(s.dp.phase);
  }
}
if (!dpSeen) throw new Error("应有 dp 快照");
if (!phases.has(1) || !phases.has(2) || !phases.has(3)) {
  throw new Error("阶段不完整: " + JSON.stringify([...phases]));
}
const last = res.steps[res.steps.length - 1];
if (!last.dp || last.dp.table[10] !== 89) throw new Error("dp[10] 应为 89: " + JSON.stringify(last.dp && last.dp.table));
if (last.dp.table[5] !== 8) throw new Error("dp[5] 应为 8: " + JSON.stringify(last.dp.table));
""", "爬楼梯")
    assert "ok" in out


def test_lis_dp_result_correct():
    """LIS：dp 表正确，最终最长递增子序列长度为 4"""
    code = _extract_sample(LIS)
    out = _case(code, """
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
let dpSeen = 0;
for (const s of res.steps) if (s.dp) dpSeen++;
if (!dpSeen) throw new Error("应有 dp 快照");
const last = res.steps[res.steps.length - 1];
if (!last.dp) throw new Error("最后一步缺 dp 快照");
const t = last.dp.table;
// 期望 dp = [1,1,2,1,3,4,2,4]
const want = [1,1,2,1,3,4,2,4];
if (JSON.stringify(t) !== JSON.stringify(want)) {
  throw new Error("dp 表不符: " + JSON.stringify(t) + " 期望 " + JSON.stringify(want));
}
let mx = 0; for (const v of t) if (v > mx) mx = v;
if (mx !== 4) throw new Error("LIS 长度应为 4: " + mx);
""", "LIS")
    assert "ok" in out


def test_stairs_lis_pages_have_dp_legend():
    """新页面应带 DP 图例与复杂度卡片"""
    for path in (STAIRS, LIS):
        with open(page_path(path), encoding="utf-8") as f:
            html = f.read()
        assert 'id="stage"' in html
        assert "complexity-card" in html
        assert "renderMode" in html
        assert "dp.js" in html
