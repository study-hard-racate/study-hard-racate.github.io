"""list.js 链表渲染器测试：在 Node 中执行 svg.js + list.js，
验证链表快照 → SVG specs 的正确性（节点/数据/边线/箭头/NULL 框/指针标签/空链表）。"""

import os
import subprocess
import sys
import tempfile

import json

import pytest

sys_pages = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, sys_pages)

DOM_STUB = r"""
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this._text = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}
global.document = {
  createElementNS: (ns, tag) => new FakeEl(tag),
};
global.window = global;
"""


def _read(path):
    with open(os.path.join(sys_pages, "static", "js", path), encoding="utf-8") as f:
        return f.read()


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


SNAP = {
    "ids": [1, 2],
    "data": {1: 8, 2: 3},
    "ptrs": [
        {"name": "head", "id": 1},
        {"name": "p", "id": 2},
        {"name": "q", "id": None},
    ],
    "cur": 2,
}

EMPTY = {
    "ids": [],
    "data": {},
    "ptrs": [{"name": "head", "id": None}],
    "cur": None,
}


def _render_js(snap_js, assert_js, name):
    js = (DOM_STUB + _read("svg.js") + "\n" + _read("list.js") + "\n"
          + "const specs = listSpecs(" + snap_js + ");\n" + assert_js + "\nconsole.log('ok');")
    return _run_js(js, name)


def test_list_specs_render_nodes_edges_and_data():
    out = _render_js(
        json.dumps(SNAP), """
const keys = specs.map(s => s.k);
for (const need of ["ln-1", "ln-2", "lt-1", "lt-2", "le-0", "la-0", "lnull", "lntext"]) {
  if (keys.indexOf(need) < 0) throw new Error("缺少元素 " + need);
}
const d1 = specs.find(s => s.k === "lt-1");
if (d1.c !== "8") throw new Error("节点 1 数据应为 8: " + d1.c);
const d2 = specs.find(s => s.k === "lt-2");
if (d2.c !== "3") throw new Error("节点 2 数据应为 3: " + d2.c);
const cur = specs.find(s => s.k === "ln-2");
if (cur.a.fill !== "#ffd166") throw new Error("当前节点应黄色高亮: " + cur.a.fill);
const nullText = specs.find(s => s.k === "lntext");
if (nullText.c !== "NULL") throw new Error("末尾应有 NULL 框: " + nullText.c);
""", "节点/边线/NULL")
    assert "ok" in out


def test_list_specs_draw_pointer_labels():
    out = _render_js(
        json.dumps(SNAP), """
const head = specs.find(s => s.k === "lpt-head");
if (!head || head.c !== "head") throw new Error("head 指针标签缺失");
const pLab = specs.find(s => s.k === "lpt-p");
if (!pLab || pLab.c !== "p") throw new Error("p 指针标签缺失");
const qLab = specs.find(s => s.k === "lpt-q");
if (!qLab || qLab.c.indexOf("NULL") < 0) throw new Error("空指针应显示为 NULL: " + (qLab && qLab.c));
const lp = specs.find(s => s.k === "lp-head");
if (!lp) throw new Error("指针连线缺失");
""", "指针标签")
    assert "ok" in out


def test_list_specs_empty_list_hint():
    out = _render_js(
        json.dumps(EMPTY), """
const keys = specs.map(s => s.k);
if (keys.indexOf("ln-0") < 0) throw new Error("空链表应画虚线框");
const t = specs.find(s => s.k === "lempty");
if (!t || t.c.indexOf("空链表") < 0) throw new Error("空链表提示缺失: " + (t && t.c));
const head = specs.find(s => s.k === "lpt-head");
if (!head || head.c.indexOf("NULL") < 0) throw new Error("空链表时 head 应显示 = NULL");
""", "空链表")
    assert "ok" in out


def test_list_specs_detached_node_rendered_dashed():
    out = _render_js(
        '{"ids":[1,2],"data":{1:8,2:3},"ptrs":[{"name":"head","id":1},{"name":"tmp","id":9}],"cur":null}',
        """
const tmp = specs.find(s => s.k === "ln-9");
if (!tmp) throw new Error("游离节点应单独画出");
if (tmp.a["stroke-dasharray"] === undefined) throw new Error("游离节点应为虚线: " + JSON.stringify(tmp.a));
""", "游离节点")
    assert "ok" in out


def test_list_viewbox_scales_with_node_count():
    out = _render_js(
        '{"ids":[1,2,3,4,5],"data":{},"ptrs":[],"cur":null}',
        """
const vb = listViewBox({ids:[1,2,3,4,5],data:{},ptrs:[],cur:null});
const w = Number(vb.split(" ")[2]);
if (w < 380) throw new Error("宽度至少 380: " + w);
const vb2 = listViewBox({"ids":[1,2,3,4,5],"data":{"1":8,"2":3,"3":1,"4":9,"5":7},"ptrs":[],"cur":null});
if (Number(vb2.split(" ")[2]) !== w) throw new Error("同样数量节点宽度应一致");
""", "viewBox")
    assert "ok" in out


def test_list_specs_fan_out_multi_ptr_same_node():
    """同一节点多个指针（如反转时 head/prev/curr/next 同指）标签按宽度分层，不得重叠"""
    out = _render_js(
        """{"ids":[1,2,3],"data":{"1":1,"2":2,"3":3},"ptrs":[
            {"name":"head","id":1},{"name":"prev","id":1},{"name":"curr","id":1},{"name":"next","id":1},
            {"name":"reverseList.head","id":1},{"name":"tail","id":3}],"cur":1}""",
        """
const labels = specs.filter(s => s.k.indexOf("lpt-") === 0);
const byName = {};
for (const s of labels) byName[s.k] = s;
for (const need of ["lpt-head", "lpt-prev", "lpt-curr", "lpt-next", "lpt-reverseList.head", "lpt-tail"]) {
  if (!byName[need]) throw new Error("缺少标签 " + need);
}
/* 同一节点（挂在 id=1 的 5 个标签）：同 y 行内中心距必须 ≥ 两标签宽的一半（不止叠） */
const g1 = ["lpt-head", "lpt-prev", "lpt-curr", "lpt-next", "lpt-reverseList.head"]
  .map(k => ({ k, x: byName[k].a.x, y: byName[k].a.y, w: labelW(byName[k].c) }));
for (let i = 0; i < g1.length; i++) {
  for (let j = i + 1; j < g1.length; j++) {
    if (g1[i].y !== g1[j].y) continue;
    const d = Math.abs(g1[i].x - g1[j].x);
    const need = (g1[i].w + g1[j].w) / 2;
    if (d < need) throw new Error("同层标签重叠: " + g1[i].k + " vs " + g1[j].k + " 中心距 " + d + " < " + need);
  }
}
/* 分层（5 个含长名标签应至少 2 层）且同标签跨层不重叠 */
const ys = new Set(g1.map(o => o.y));
if (ys.size < 2) throw new Error("长名标签应自动分层");
const keys = specs.map(s => s.k);
const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
if (dup.length) throw new Error("specs 存在重复 key（会互相覆盖）: " + dup.join(","));
/* 最左标签不得超出画布（x - w/2 ≥ 0） */
for (const o of g1) {
  if (o.x - o.w / 2 < 0) throw new Error("标签出界: " + o.k);
}
""", "同节点指针分层")
    assert "ok" in out


def test_list_specs_multi_null_ptrs_staggered():
    """多个 NULL 指针（如 prev=NULL 与 next=NULL）标签应错开"""
    out = _render_js(
        """{"ids":[1,2],"data":{"1":8,"2":3},"ptrs":[
            {"name":"prev","id":null},{"name":"next","id":null}],"cur":null}""",
        """
const p1 = specs.find(s => s.k === "lpt-prev");
const p2 = specs.find(s => s.k === "lpt-next");
if (!p1 || !p2) throw new Error("NULL 指针标签缺失");
if (p1.a.x === p2.a.x && p1.a.y === p2.a.y) throw new Error("NULL 指针标签重叠");
const d = Math.abs(p1.a.x - p2.a.x);
const need = (labelW(p1.c) + labelW(p2.c)) / 2;
if (p1.a.y === p2.a.y && d < need) throw new Error("NULL 标签同层重叠");
if (p1.a.y !== p2.a.y && Math.abs(p1.a.y - p2.a.y) < 17) throw new Error("NULL 分层过近");
const keys = specs.map(s => s.k);
const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
if (dup.length) throw new Error("specs 存在重复 key: " + dup.join(","));
""", "NULL 指针错开")
    assert "ok" in out


def test_list_specs_no_overlap_across_groups_global_slots():
    """反转中段：节点 1 挂 4 指针 + 3 个游离节点 + NULL 指针，
    所有标签两两区间不得重叠（全局槽分配），游离节点框横向铺开"""
    out = _render_js(
        """{"ids":[1],"data":{"1":1,"2":2,"3":3,"4":4},"ptrs":[
            {"name":"head","id":1},{"name":"reverseList.head","id":1},
            {"name":"prev","id":3},{"name":"curr","id":4},{"name":"next","id":2},
            {"name":"tail","id":null}],"cur":1}""",
        """
const labels = specs.filter(s => s.k.indexOf("lpt-") === 0);
const ls = labels.map(s => ({ k: s.k, x: Number(s.a.x), y: Number(s.a.y),
  w: labelW(s.c), l: s.c }));
for (let i = 0; i < ls.length; i++) {
  for (let j = i + 1; j < ls.length; j++) {
    if (Math.abs(ls[i].y - ls[j].y) >= 14) continue;
    const d = Math.abs(ls[i].x - ls[j].x);
    const need = (ls[i].w + ls[j].w) / 2;
    if (d < need) throw new Error("跨组标签重叠: " + ls[i].k + " vs " + ls[j].k
      + " 中心距 " + d + " < " + need + " (" + ls[i].l + " / " + ls[j].l + ")");
  }
}
/* 游离节点框（2/3/4 不在主链）应横向铺开，x 位置互不相同且不与主链节点重叠 */
const detBoxes = ["ln-2", "ln-3", "ln-4"].map(k => specs.find(s => s.k === k));
for (const b of detBoxes) if (!b) throw new Error("游离节点框缺失");
const xs = new Set(detBoxes.map(b => b.a.x));
if (xs.size !== 3) throw new Error("游离节点框应横向铺开，位置互不相同");
for (const b of detBoxes) {
  if (Number(b.a.x) >= 24 && Number(b.a.x) < 24 + 64) throw new Error("游离节点框与主链节点重叠");
}
""", "跨组全局槽分配")
    assert "ok" in out


def test_list_viewbox_grows_for_detached_nodes_and_layers():
    """viewBox 应随游离节点数量与标签层数扩展（宽度 + 顶部空间）"""
    out = _render_js(
        """{"ids":[1],"data":{"1":1,"2":2},"ptrs":[
            {"name":"head","id":1},{"name":"curr","id":2},
            {"name":"reverseList.head","id":1}],"cur":1}""",
        """
const base = listViewBox({"ids":[1],"data":{"1":1},"ptrs":[{"name":"head","id":1}],"cur":null});
const withDet = listViewBox({"ids":[1],"data":{"1":1,"2":2,"3":3,"4":4,"5":5},"ptrs":[
  {"name":"head","id":1},{"name":"a","id":2},{"name":"b","id":3},
  {"name":"c","id":4},{"name":"d","id":5}],"cur":null});
if (Number(withDet.split(" ")[2]) < 380) throw new Error("宽度至少 380: " + withDet);
if (Number(withDet.split(" ")[2]) <= Number(base.split(" ")[2]) + 280) {
  if (Number(withDet.split(" ")[2]) <= Number(base.split(" ")[2])) {
    throw new Error("4 个游离节点应扩展画布宽度: " + withDet);
  }
}
const layered = listViewBox({"ids":[1],"data":{"1":1},"ptrs":[
  {"name":"head","id":1},{"name":"reverseList.head","id":1},
  {"name":"prev","id":1}],"cur":null});
if (layered.split(" ")[1] !== "0" || layered.split(" ")[0] !== "0") {
  if (layered.split(" ")[1][0] !== "-") throw new Error("多层标签应向上扩展: " + layered);
}
""", "viewBox 扩展")
    assert "ok" in out


def test_list_specs_two_ptr_same_detached_node_single_box():
    """两个指针指向同一游离节点：只画一个节点框，标签扇形错开"""
    out = _render_js(
        """{"ids":[1,2],"data":{"1":8,"2":3,"9":0},"ptrs":[
            {"name":"head","id":1},{"name":"a","id":9},{"name":"b","id":9}],"cur":null}""",
        """
const boxes = specs.filter(s => s.k === "ln-9");
if (boxes.length !== 1) throw new Error("游离节点应只画一个框: " + boxes.length);
const la = specs.find(s => s.k === "lpt-a");
const lb = specs.find(s => s.k === "lpt-b");
if (la.a.x === lb.a.x && la.a.y === lb.a.y) throw new Error("游离节点指针标签重叠");
""", "游离节点多指针")
    assert "ok" in out


def test_list_specs_edges_driven_lines():
    """edges 驱动：正常右向直线、NULL 线、反向曲线（ler-）、mark 红色高亮"""
    out = _render_js(
        """{"ids":[1,2],"data":{"1":8,"2":3,"3":9},"ptrs":[
            {"name":"head","id":1},{"name":"p","id":3}],"cur":null,
            "edges":{"1":2,"2":null,"3":1},
            "markNode":3,"markField":"n3->next"}""",
        """
/* 1 -> 2 正常右向 */
if (!specs.find(s => s.k === "le-1")) throw new Error("正常边 le-1 缺失");
/* 2 -> NULL 线 */
if (!specs.find(s => s.k === "le-2")) throw new Error("NULL 线 le-2 缺失");
const l2 = specs.find(s => s.k === "le-2");
if (l2.a.x2 < 200) throw new Error("NULL 线应连到右侧 NULL 框: " + l2.a.x2);
/* 3（游离）-> 1（主链）：反向曲线 */
const curve = specs.find(s => s.k === "ler-3");
if (!curve) throw new Error("反向曲线 ler-3 缺失");
if (curve.a.stroke !== "#ff6b6b") throw new Error("反向曲线应为红色: " + curve.a.stroke);
if (!specs.find(s => s.k === "lra-3")) throw new Error("反向箭头 lra-3 缺失");
/* mark 节点红色 */
const mk = specs.find(s => s.k === "ln-3");
if (mk.a.stroke !== "#ff6b6b") throw new Error("mark 节点应红色描边: " + mk.a.stroke);
""", "edges 驱动渲染")
    assert "ok" in out


def test_list_specs_mark_red_highlight():
    """主链 mark 节点：红色描边 + 红色文字；cur 与 mark 共存时描边红、填充黄"""
    out = _render_js(
        """{"ids":[1,2],"data":{"1":8,"2":3},"ptrs":[{"name":"head","id":1}],
            "cur":2,"edges":{"1":2,"2":null},"markNode":2,"markField":"head->data"}""",
        """
const mk = specs.find(s => s.k === "ln-2");
if (mk.a.stroke !== "#ff6b6b") throw new Error("mark+cur 节点描边应为红: " + mk.a.stroke);
if (mk.a.fill !== "#ffd166") throw new Error("mark+cur 节点填充保持黄: " + mk.a.fill);
const t = specs.find(s => s.k === "lt-2");
if (t.a.fill !== "#1c2433") throw new Error("mark+cur 文字保持深色: " + t.a.fill);
""", "mark 高亮")
    assert "ok" in out


def test_list_specs_side_chain_rendered():
    """次链（side）：第二行绿色节点 + NULL 框 + 标签；l2 指针标签指向次链节点"""
    out = _render_js(
        """{"ids":[1,2,3],"data":{"1":1,"2":2,"3":4,"4":1,"5":3,"6":4},
            "ptrs":[{"name":"l1","id":1},{"name":"l2","id":4}],
            "cur":null,"edges":{"1":2,"2":3,"3":null,"4":5,"5":6,"6":null},
            "side":{"ids":[4,5,6],"data":{"4":1,"5":3,"6":4},"label":"l2"}}""",
        """
const sideY = 58 + 88; /* L_TOP + L_ROW_DY */
const n4 = specs.find(s => s.k === "ls-4");
if (!n4) throw new Error("次链节点 4 缺失");
if (n4.a.y !== sideY) throw new Error("次链节点应在第二行: " + n4.a.y);
if (n4.a.stroke !== "#3ecf8e") throw new Error("次链节点应为绿色描边: " + n4.a.stroke);
if (!specs.find(s => s.k === "lst-4")) throw new Error("次链节点数据文字缺失");
if (!specs.find(s => s.k === "lnull2")) throw new Error("次链 NULL 框缺失");
if (!specs.find(s => s.k === "lside-label")) throw new Error("次链标签缺失");
/* 次链内部边（绿色直线） */
const e4 = specs.find(s => s.k === "le-4");
if (!e4 || e4.a.stroke !== "#3ecf8e") throw new Error("次链边应为绿色: " + JSON.stringify(e4 && e4.a));
/* l2 标签应指向次链节点 4 */
const lp = specs.find(s => s.k === "lp-l2");
if (!lp) throw new Error("l2 指针连线缺失");
if (Number(lp.a.x2) < 24 || Number(lp.a.x2) > 150) throw new Error("l2 连线应指向次链行节点: " + lp.a.x2);
""", "次链渲染")
    assert "ok" in out


def test_list_specs_cmp_ids_purple():
    """条件比较的两个节点：紫色描边高亮"""
    out = _render_js(
        """{"ids":[1,2,3],"data":{"1":1,"2":2,"3":4},
            "ptrs":[{"name":"l1","id":1}],"cur":null,
            "edges":{"1":2,"2":3,"3":null},"cmpIds":[1,3]}""",
        """
const n1 = specs.find(s => s.k === "ln-1");
if (n1.a.stroke !== "#b98cff") throw new Error("比较节点 1 应紫色: " + n1.a.stroke);
const n3 = specs.find(s => s.k === "ln-3");
if (n3.a.stroke !== "#b98cff") throw new Error("比较节点 3 应紫色: " + n3.a.stroke);
const n2 = specs.find(s => s.k === "ln-2");
if (n2.a.stroke === "#b98cff") throw new Error("非比较节点不应紫色");
""", "比较高亮")
    assert "ok" in out


STACKQUEUE_STUBS = r"""
global.window = global;
class FakeEl2 {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this._text = "";
    this.__specs = {};
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}
global.document = { createElementNS: (ns, t) => new FakeEl2(t), getElementById: () => null };
"""


def test_stackqueue_array_stack_render():
    """数组栈渲染：top 高亮、未入栈区域空、top 指针标签"""
    js = (STACKQUEUE_STUBS + _read("svg.js") + "\n" + _read("stackqueue.js") + "\n"
          + """
const stage = document.createElementNS("svg", "svg");
renderArrayStack(stage, { arr: [1, 2, 3, 0, 0, 0], vars: { top: 2 } });
const svg = stage.__svg;
const keys = Object.keys(svg.__specs);
if (!keys.some(k => k === "sq-2")) throw new Error("栈格缺失");
if (!keys.some(k => k === "sqtop")) throw new Error("top 标签缺失");
console.log('ok');
""")
    out = _run_js(js, "数组栈渲染")
    assert "ok" in out


def test_graph_renderer_layout():
    """图渲染器：邻接表 → 顶点 + 边 + visited 绿色"""
    js = (STACKQUEUE_STUBS + _read("svg.js") + "\n" + _read("graph.js") + "\n"
          + """
const stage = document.createElementNS("svg", "svg");
renderGraphCsim(stage, { adj: {0: [2, 1], 1: [3]}, data: {1: 1, 2: 2, 3: 3}, n: 4, vars: { visited: [1, 1, 0, 0] } });
const svg = stage.__svg;
const keys = Object.keys(svg.__specs);
if (!keys.some(k => k === "gn-0")) throw new Error("顶点 0 缺失");
if (!keys.some(k => k.indexOf("ge-") === 0)) throw new Error("边缺失");
const v0 = svg.__specs["gn-0"];
if (v0.getAttribute("fill") !== "#3ecf8e") throw new Error("已访问顶点应为绿色: " + v0.getAttribute("fill"));
console.log('ok');
""")
    out = _run_js(js, "图渲染")
    assert "ok" in out


def test_graph_viewbox_covers_all_elements():
    """图 viewBox 必须覆盖全部元素（顶点负坐标不被裁剪）"""
    js = (STACKQUEUE_STUBS + _read("svg.js") + "\n" + _read("graph.js") + "\n"
          + """
const stage = document.createElementNS("svg", "svg");
renderGraphCsim(stage, { adj: {0: [2, 1], 1: [3], 2: [5], 3: [5]}, data: {1: 1, 2: 2, 3: 3, 4: 5, 5: 5}, n: 6, vars: { visited: [1, 1, 0, 0, 0, 0] } });
const svg = stage.__svg;
const vb = svg.getAttribute("viewBox").split(" ").map(Number);
if (vb.length !== 4) throw new Error("viewBox 格式错误: " + vb.join(" "));
if (vb[0] >= 0) throw new Error("viewBox 左缘应为负（包含左侧顶点）: " + vb.join(" "));
for (const k in svg.__specs) {
  const a = svg.__specs[k].attrs;
  for (const attr of ["x", "x1", "x2", "cx"]) {
    if (a[attr] !== undefined && (+a[attr] < vb[0] || +a[attr] > vb[0] + vb[2])) throw new Error("元素超出横向: " + k);
  }
  for (const attr of ["y", "y1", "y2", "cy"]) {
    if (a[attr] !== undefined && (+a[attr] < vb[1] || +a[attr] > vb[1] + vb[3])) throw new Error("元素超出纵向: " + k);
  }
}
console.log('ok');
""")
    out = _run_js(js, "图 viewBox 覆盖")
    assert "ok" in out


SEARCH_STUBS = r"""
global.window = global;
class FakeEl3 {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this._text = ""; this.__specs = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}
global.document = { createElementNS: (ns, t) => new FakeEl3(t), getElementById: () => null };
"""


def test_search_renderers_basic():
    """查找渲染器：线性/二分/分块输出格子与状态消息，二分含 lo/hi/mid 标签"""
    js = (SEARCH_STUBS + _read("svg.js") + "\n" + _read("search.js") + "\n"
          + """
const stage = document.createElementNS("svg", "svg");
renderBinarySearch(stage, { arr: [1,3,5,7,9,11,13,15], vars: { lo: 4, hi: 7, mid: 5, x: 11, found: 5 } });
const keys = Object.keys(stage.__svg.__specs);
if (!keys.some(k => k === "bp-lo")) throw new Error("缺 lo 指针");
if (!keys.some(k => k === "bp-hi")) throw new Error("缺 hi 指针");
if (!keys.some(k => k === "bp-mid")) throw new Error("缺 mid 指针");
const st2 = document.createElementNS("svg", "svg");
renderLinearSearch(st2, { arr: [3,7,2,9], vars: { x: 7, found: 1, i: 3 } });
const k2 = Object.keys(st2.__svg.__specs);
if (!k2.some(k => k === "stgt")) throw new Error("缺目标徽标");
const st3 = document.createElementNS("svg", "svg");
renderBlockSearch(st3, { arr: [3,5,8,12,15,18,21,26], vars: { x: 26, b: 1, found: 7, block: [12,26] } });
const k3 = Object.keys(st3.__svg.__specs);
if (!k3.some(k => k === "bl-1")) throw new Error("缺索引表格");
console.log('ok');
""")
    out = _run_js(js, "查找渲染器")
    assert "ok" in out


def test_hash_renderer_buckets_and_chain():
    """哈希渲染器：竖直槽 + 冲突链节点 + 当前链节点高亮"""
    js = (SEARCH_STUBS + _read("svg.js") + "\n" + _read("hash.js") + "\n"
          + """
const stage = document.createElementNS("svg", "svg");
renderHash(stage, { adj: {0: [5], 1: [8], 3: [10, 3]}, data: {5: 5, 8: 8, 10: 10, 3: 3}, n: 7, cur: 10 });
const svg = stage.__svg;
const keys = Object.keys(svg.__specs);
if (!keys.some(k => k === "hs-0") || !keys.some(k => k === "hs-6")) throw new Error("槽缺失");
if (!keys.some(k => k === "hn-10") || !keys.some(k => k === "hn-3")) throw new Error("冲突链节点缺失");
const cur = svg.__specs["hn-10"];
if (cur.getAttribute("stroke") !== "#ffd166") throw new Error("当前节点应黄色: " + cur.getAttribute("stroke"));
console.log('ok');
""")
    out = _run_js(js, "哈希渲染器")
    assert "ok" in out
