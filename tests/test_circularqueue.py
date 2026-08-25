"""循环队列模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证 front/rear 循环移动、出队后空间复用。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/circular-queue"


def _load_csim():
    with open(os.path.join(ROOT, "static", "js", "csim.js"), encoding="utf-8") as f:
        return f.read()


def _extract_sample(path):
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    m = re.search(r'sample: "(.*?)", renderMode', html, re.S)
    assert m, f"{path} 未找到 sample"
    return codecs.decode(m.group(1), "unicode_escape")


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


def _case(assert_js, name):
    code = _extract_sample(PATH)
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + "const res = CSim.run(" + json.dumps(code) + ", {});\n"
          + assert_js + "\nconsole.log('ok');")
    return _run_js(js, name)


def test_circular_queue_final_state():
    """入队 1,2,3 → 出队两次 → 入队 4,5,6：
       最终 front=2、rear=0（绕回）、size=4，队列元素为 q[2..5] = 3,4,5,6"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("最后一步缺 vars");
if (last.vars.front !== 2) throw new Error("front 应为 2: " + last.vars.front);
if (last.vars.rear !== 0) throw new Error("rear 应绕回为 0: " + last.vars.rear);
if (last.vars.size !== 4) throw new Error("size 应为 4: " + last.vars.size);
const q = last.arr;
if (q[2] !== 3 || q[3] !== 4 || q[4] !== 5 || q[5] !== 6) {
  throw new Error("队列内容错误: " + JSON.stringify(q));
}
""", "循环队列最终状态")
    assert "ok" in out


def test_circular_queue_wrap_observed():
    """动画过程中应出现 rear 从 5 绕回 0（% 6 取模），证明空间循环利用"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let rear5Seen = false, rear0After5 = false;
let prevRear = null;
for (const s of res.steps) {
  if (s.vars && s.vars.rear !== undefined) {
    if (s.vars.rear === 5) rear5Seen = true;
    if (prevRear === 5 && s.vars.rear === 0) rear0After5 = true;
    prevRear = s.vars.rear;
  }
}
if (!rear5Seen) throw new Error("应出现 rear=5");
if (!rear0After5) throw new Error("rear 应从 5 绕回 0（未体现循环）");
""", "循环绕回")
    assert "ok" in out


def test_circular_queue_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "circularqueue"' in html
