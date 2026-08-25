"""Trie 模块测试：从页面提取 C 代码，验证前缀共享结构与单词结尾标记正确。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/trie"


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


def test_trie_structure():
    """插入 AB/ABC/AD 后：A(1) 复用，结构为
       0 -A(1)-> {1} -B(2)-> {2 词尾} -C(3)-> {3 词尾}
                   {1} -D(4)-> {4 词尾}"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("最后一步缺 vars");
const v = last.vars;
const ch = last.arr;
// 节点字母
if (ch[1] !== 1 || ch[2] !== 2 || ch[3] !== 3 || ch[4] !== 4) {
  throw new Error("节点字母错误: " + JSON.stringify(ch.slice(0, 6)));
}
// 结构：a[0]=1（根→A），b[1]=2（A→B），c[2]=3（B→C），d[1]=4（A→D）
if (v.a[0] !== 1) throw new Error("a[0] 应为 1: " + v.a[0]);
if (v.b[1] !== 2) throw new Error("b[1] 应为 2: " + v.b[1]);
if (v.c[2] !== 3) throw new Error("c[2] 应为 3: " + v.c[2]);
if (v.d[1] !== 4) throw new Error("d[1] 应为 4: " + v.d[1]);
// 单词结尾
if (v.isWord[2] !== 1 || v.isWord[3] !== 1 || v.isWord[4] !== 1) {
  throw new Error("isWord 标记错误: " + JSON.stringify(v.isWord.slice(0, 6)));
}
// AB 共享：根只有 A 一个子节点
if (v.b[0] !== -1 || v.c[0] !== -1 || v.d[0] !== -1) {
  throw new Error("根节点不应有其他子节点");
}
""", "Trie 结构")
    assert "ok" in out


def test_trie_phases():
    """阶段 1/2/3 齐全，插入过程出现节点创建"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set(), cntSeen = new Set();
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) phases.add(s.vars.phase);
  if (s.vars && s.vars.cnt !== undefined && s.vars.cnt > 1) cntSeen.add(s.vars.cnt);
}
for (const want of [1,2,3]) if (!phases.has(want)) throw new Error("缺少阶段 " + want);
for (const want of [2,3,4,5]) if (!cntSeen.has(want)) throw new Error("未出现节点数 " + want);
""", "Trie 阶段")
    assert "ok" in out


def test_trie_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "trie"' in html
    assert "trie.js" in html
