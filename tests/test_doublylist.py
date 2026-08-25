"""双向链表模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证 prevEdges 快照存在、删除操作后链正确。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/doubly-linked-list"


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


def test_doubly_list_final_chain():
    """建链 1-2-3-4-5，删除 3 和头节点 1 后，主链应为 2,4,5"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.list) throw new Error("最后一步缺链表快照");
const l = last.list;
const vals = l.ids.map(id => l.data[id]);
if (vals.join(",") !== "2,4,5") {
  throw new Error("最终链应为 2,4,5: " + vals.join(",") + " ids=" + l.ids.join(","));
}
""", "双向链表最终链")
    assert "ok" in out


def test_doubly_list_prev_edges_present():
    """快照携带 prevEdges；最终态：新头节点 2 的 prev=null，4 的 prev=2，5 的 prev=4"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let sawPrev = false;
for (const s of res.steps) {
  const l = s.list;
  if (!l || !l.prevEdges) continue;
  sawPrev = true;
  // 所有 prev 指向必须是 null 或链内真实节点
  for (const id in l.prevEdges) {
    const to = l.prevEdges[id];
    if (to !== null && l.ids.indexOf(to) < 0 && !(l.data[to] !== undefined)) {
      throw new Error("prev 指向不存在的节点: " + id + " -> " + to);
    }
  }
}
if (!sawPrev) throw new Error("应出现 prevEdges 快照");
const last = res.steps[res.steps.length - 1].list;
if (!last.prevEdges) throw new Error("最后一步缺 prevEdges");
// 最终链 2,4,5：新头 2 的 prev 应为 null，4.prev=2，5.prev=4
if (last.prevEdges[last.ids[0]] !== null) throw new Error("新头节点 prev 应为 null");
if (last.prevEdges[last.ids[1]] !== last.ids[0]) throw new Error("4.prev 应为 2");
if (last.prevEdges[last.ids[2]] !== last.ids[1]) throw new Error("5.prev 应为 4");
""", "prev 边")
    assert "ok" in out


def test_doubly_list_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "doublylist"' in html
