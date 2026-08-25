"""汉诺塔模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证递归完成后所有盘移到 C 柱、移动步骤携带 cur 高亮。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/classic/hanoi"


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


def test_hanoi_all_disks_move_to_c():
    """递归完成后：A、B 全空，C = [4,3,2,1]（大在底小在顶）"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("最后一步缺 vars");
const A = last.arr || [];
const B = last.vars.B || [];
const C = last.vars.C || [];
if (A.some(v => v > 0)) throw new Error("A 应全空: " + JSON.stringify(A));
if (B.some(v => v > 0)) throw new Error("B 应全空: " + JSON.stringify(B));
const want = [4,3,2,1];
if (JSON.stringify(C) !== JSON.stringify(want)) {
  throw new Error("C 应为 [4,3,2,1]: " + JSON.stringify(C));
}
""", "汉诺塔完成态")
    assert "ok" in out


def test_hanoi_move_steps_have_cur():
    """移动步骤应携带 cur（当前移动的盘号），且每一步后仍然合法（大盘不压小盘）"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
let moveSteps = 0;
for (const s of res.steps) {
  if (!s.vars) continue;
  const cur = s.vars.cur;
  if (cur !== undefined && cur !== null && cur >= 1) {
    moveSteps++;
    // 检查三柱：任何柱内自底向上必须递减（大盘在下）
    const A = s.arr || [], B = s.vars.B || [], C = s.vars.C || [];
    for (const peg of [A, B, C]) {
      let prev = 999;
      for (const d of peg) {
        if (d > 0) {
          if (d >= prev) throw new Error("大盘压小盘: " + JSON.stringify(peg));
          prev = d;
        }
      }
    }
  }
}
if (moveSteps < 15) throw new Error("4 个盘应有 15 次移动: " + moveSteps);
""", "汉诺塔移动步骤")
    assert "ok" in out


def test_hanoi_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "hanoi"' in html
    assert "hanoi.js" in html
