"""csim.js 仿真器测试：在 Node 中执行 C 子集解释器，验证
- 常见排序代码（冒泡/选择/插入/快速/归并）能正确动画化：结果有序、行号合法、交换被标记
- 数组初值优先、随机数据替换
- 超出子集范围时给出中文错误 + 行号（printf/scanf/越界/死循环/无数组）
- 链表模式（struct Node + malloc + 指针）：真实执行 main、快照合法、指针/读写步骤正确"""

import json
import os
import subprocess
import sys
import tempfile

import pytest

sys_pages = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, sys_pages)

BUBBLE = """#include <stdio.h>
void bubble_sort(int a[], int n)
{
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                int t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;
            }
        }
    }
}
int main(void)
{
    int a[8];
    bubble_sort(a, 8);
    return 0;
}
"""

SELECTION = """void selection_sort(int a[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int min = i;
        for (int j = i + 1; j < n; j++) {
            if (a[j] < a[min]) {
                min = j;
            }
        }
        if (min != i) {
            int t = a[i];
            a[i] = a[min];
            a[min] = t;
        }
    }
}
"""

INSERTION = """void insertion_sort(int a[], int n) {
    for (int i = 1; i < n; i++) {
        int key = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > key) {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = key;
    }
}
"""

QUICK = """void swap(int *x, int *y) {
    int t = *x;
    *x = *y;
    *y = t;
}
void quick_sort(int a[], int lo, int hi) {
    if (lo >= hi) return;
    int i = lo, j = hi;
    int pivot = a[lo];
    while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) {
            swap(&a[i], &a[j]);
            i++;
            j--;
        }
    }
    quick_sort(a, lo, j);
    quick_sort(a, i, hi);
}
int main(void) {
    int a[8] = { 42, 17, 8, 91, 3, 56, 24, 71 };
    quick_sort(a, 0, 7);
    return 0;
}
"""

MERGE = """void merge(int a[], int lo, int mid, int hi) {
    int tmp[16];
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        if (a[i] <= a[j]) {
            tmp[k] = a[i];
            i++;
        } else {
            tmp[k] = a[j];
            j++;
        }
        k++;
    }
    while (i <= mid) { tmp[k] = a[i]; i++; k++; }
    while (j <= hi) { tmp[k] = a[j]; j++; k++; }
    for (int t = lo; t <= hi; t++) {
        a[t] = tmp[t];
    }
}
void merge_sort(int a[], int lo, int hi) {
    if (lo >= hi) return;
    int mid = (lo + hi) / 2;
    merge_sort(a, lo, mid);
    merge_sort(a, mid + 1, hi);
    merge(a, lo, mid, hi);
}
int main(void) {
    int a[8] = { 42, 17, 8, 91, 3, 56, 24, 71 };
    merge_sort(a, 0, 7);
    return 0;
}
"""

INIT_FIRST = """void f(int a[], int n) {
    for (int i = 0; i < n - 1; i++) {
        if (a[i] > a[i + 1]) {
            int t = a[i];
            a[i] = a[i + 1];
            a[i + 1] = t;
        }
    }
}
int main(void) {
    int a[] = { 9, 1, 5 };
    f(a, 3);
    return 0;
}
"""


def _load_csim():
    with open(os.path.join(sys_pages, "static", "js", "csim.js"), encoding="utf-8") as f:
        return f.read()


def _run_js(js_code, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js_code)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["node", tmp],
            capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
        )
        if proc.returncode != 0:
            pytest.fail(f"{name} 执行失败: {proc.stderr.strip()[:2000]}")
        return proc.stdout
    finally:
        os.unlink(tmp)


def _csim_case(code, opts=None, assert_js="", name="csim"):
    """执行 CSim.run(code, opts)，附断言脚本，返回 JS 表达式字符串"""
    opts_js = json.dumps(opts if opts is not None else {"size": 8})
    return (
        "const res = CSim.run(" + json.dumps(code) + ", " + opts_js + ");\n"
        + assert_js
    )


SORT_OK_ASSERT = """
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
if (res.steps.length < 10) throw new Error("步骤太少: " + res.steps.length);
const last = res.steps[res.steps.length - 1];
if (last.line !== -1) throw new Error("最后一步行号应为 -1");
const sorted = last.arr.every((v, i) => i === 0 || last.arr[i - 1] <= v);
if (!sorted) throw new Error("结果未有序: " + JSON.stringify(last.arr));
for (const s of res.steps) {
  if (s.line !== -1 && (s.line < 1 || s.line > res.lines.length)) {
    throw new Error("非法行号 " + s.line + "（共 " + res.lines.length + " 行）");
  }
  if (!Array.isArray(s.arr)) throw new Error("步骤缺少数组快照");
  if (!s.msg) throw new Error("步骤缺少中文提示");
}
"""


@pytest.mark.parametrize("code,name", [
    (BUBBLE, "冒泡"),
    (SELECTION, "选择"),
    (INSERTION, "插入"),
    (QUICK, "快速(swap函数+递归+main初值)"),
    (MERGE, "归并(辅助函数+局部数组+递归)"),
])
def test_sort_code_generates_valid_animation(code, name):
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {"size": 8}, SORT_OK_ASSERT) + "\nconsole.log('ok');")
    out = _run_js(js, name)
    assert "ok" in out


def test_animation_detects_swap_marks():
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(BUBBLE, {"size": 8}, """
if (!res.ok) throw new Error(res.error.msg);
const swaps = res.steps.filter(s => s.swap).length;
if (swaps < 4) throw new Error("冒泡应检测到多次交换: " + swaps);
if (!res.stats.swaps || res.stats.swaps < 1) throw new Error("统计交换次数异常: " + res.stats.swaps);
""") + "\nconsole.log('ok');")
    out = _run_js(js, "交换标记")
    assert "ok" in out


def test_array_initializer_takes_priority():
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(INIT_FIRST, {"size": 8}, """
if (!res.ok) throw new Error(res.error.msg);
if (res.steps[0].msg.indexOf("{ 9, 1, 5 }") < 0) throw new Error("初值未被使用: " + res.steps[0].msg);
if (res.steps[0].arr.length !== 3) throw new Error("数组长度应为初值长度: " + res.steps[0].arr.length);
""") + "\nconsole.log('ok');")
    out = _run_js(js, "初值优先")
    assert "ok" in out


def test_force_random_replaces_initializer():
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(INIT_FIRST, {"size": 8, "forceRandom": True}, """
if (!res.ok) throw new Error(res.error.msg);
if (res.steps[0].arr.length !== 8) throw new Error("随机模式应使用页面长度: " + res.steps[0].arr.length);
if (res.steps[0].msg.indexOf("{ 9, 1, 5 }") >= 0) throw new Error("随机模式不应使用初值");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "随机替换")
    assert "ok" in out


ERROR_CASES = [
    # (代码, 期望错误片段, 期望行号, 名称)
    ("""void f(int a[]) {
    scanf("%d", &a[0]);
}
int main(void) { int a[5]; f(a); return 0; }
""", "scanf", 2, "scanf 报错"),
    ("""void f(int a[]) {
    gets(buf);
}
int main(void) { int a[5]; f(a); return 0; }
""", "gets", 2, "gets 报错"),
    ("""void f(int a[]) { a[99] = 1; }
int main(void) { int a[5]; f(a); return 0; }
""", "越界", 1, "越界报错"),
    ("""void f(int a[]) { while (1) { } }
int main(void) { int a[5]; f(a); return 0; }
""", "上限", 1, "死循环保护"),
    ("int main(void) { int x = 3; return 0; }", "未找到包含 int 数组", 1, "无数组报错"),
    ("""void g(int *p) { *p = 1; }
int main(void) { int a[5]; g(a); return 0; }
""", "指针", 1, "指针报错"),
]


@pytest.mark.parametrize("code,expect,line,name", ERROR_CASES)
def test_unsupported_code_reports_chinese_error(code, expect, line, name):
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {"size": 8}, """
if (res.ok) throw new Error("本应报错却成功");
if (res.error.line !== LINE) throw new Error("行号错误: " + res.error.line + " 应为 " + LINE);
if (res.error.msg.indexOf("EXPECT") < 0) throw new Error("错误信息不含关键字: " + res.error.msg);
""".replace("LINE", str(line)).replace("EXPECT", expect)) + "\nconsole.log('ok');")
    out = _run_js(js, name)
    assert "ok" in out


# ---------------- 链表模式（struct Node + malloc + 指针） ----------------

INSERT_HEAD = """struct Node { int data; struct Node *next; };
void insertHead(struct Node **q, int v) {
  struct Node *p = malloc(sizeof(struct Node));
  p->data = v;
  p->next = *q;
  *q = p;
}
void traverse(struct Node *head) {
  struct Node *p = head;
  while (p != NULL) {
    p = p->next;
  }
}
int main() {
  struct Node *head = NULL;
  insertHead(&head, 3);
  insertHead(&head, 8);
  traverse(head);
  return 0;
}
"""

LINKED_STACK = """struct Node { int data; struct Node *next; };
void push(struct Node **top, int v) {
  struct Node *p = malloc(sizeof(struct Node));
  p->data = v;
  p->next = *top;
  *top = p;
}
int pop(struct Node **top) {
  int v;
  if (*top == NULL) return -1;
  v = (*top)->data;
  *top = (*top)->next;
  return v;
}
int main() {
  struct Node *top = NULL;
  push(&top, 1);
  push(&top, 2);
  push(&top, 3);
  pop(&top);
  pop(&top);
  return 0;
}
"""

LINKED_QUEUE = """struct Node { int data; struct Node *next; };
void enqueue(struct Node **head, struct Node **tail, int v) {
  struct Node *p = malloc(sizeof(struct Node));
  p->data = v;
  p->next = NULL;
  if (*head == NULL) {
    *head = p;
    *tail = p;
  } else {
    (*tail)->next = p;
    *tail = p;
  }
}
void dequeue(struct Node **head, struct Node **tail) {
  struct Node *p = *head;
  if (p == NULL) return;
  *head = (*head)->next;
  if (*head == NULL) *tail = NULL;
}
int main() {
  struct Node *head = NULL;
  struct Node *tail = NULL;
  enqueue(&head, &tail, 5);
  enqueue(&head, &tail, 9);
  enqueue(&head, &tail, 2);
  dequeue(&head, &tail);
  return 0;
}
"""

LIST_OK_ASSERT = """
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
if (res.mode !== "list") throw new Error("含 struct 的代码应为链表模式: " + res.mode);
if (res.steps.length < 6) throw new Error("步骤太少: " + res.steps.length);
const last = res.steps[res.steps.length - 1];
if (last.line !== -1) throw new Error("最后一步行号应为 -1");
if (last.list.ids.length !== FINAL_NODES) {
  throw new Error("最终节点数不符: 期望 " + FINAL_NODES + " 实际 " + last.list.ids.length + "（" + last.list.ids.join(",") + "）");
}
let hasWrite = false, hasCur = false, hasMalloc = false;
for (const s of res.steps) {
  if (s.line !== -1 && (s.line < 1 || s.line > res.lines.length)) {
    throw new Error("非法行号 " + s.line + "（共 " + res.lines.length + " 行）");
  }
  if (!s.list || !Array.isArray(s.list.ids) || !s.list.data || !Array.isArray(s.list.ptrs)) {
    throw new Error("步骤缺少链表快照");
  }
  for (const p of s.list.ptrs) {
    if (!p || typeof p.name !== "string" || (p.id !== null && typeof p.id !== "number")) {
      throw new Error("指针快照非法: " + JSON.stringify(p));
    }
  }
  if (!s.msg) throw new Error("步骤缺少中文提示");
  if (s.msg.indexOf("写入") >= 0) hasWrite = true;
  if (s.msg.indexOf("malloc") >= 0 || s.msg.indexOf("节点 #") >= 0) hasMalloc = true;
  if (s.list.cur !== null && s.list.cur !== undefined) hasCur = true;
}
if (!hasWrite) throw new Error("应出现成员写入步骤（p->data / p->next）");
if (!hasMalloc) throw new Error("应出现 malloc 建节点步骤");
if (!hasCur) throw new Error("应出现当前节点高亮（cur）");
"""


TYPEDEF_REVERSE = """typedef struct ListNode {
    int val;
    struct ListNode *next;
} ListNode;

ListNode* createNode(int val) {
    ListNode* node = (ListNode*)malloc(sizeof(ListNode));
    node->val = val;
    node->next = NULL;
    return node;
}

ListNode* createList(int arr[], int n) {
    if (n == 0) return NULL;
    ListNode* head = createNode(arr[0]);
    ListNode* cur = head;
    for (int i = 1; i < n; i++) {
        cur->next = createNode(arr[i]);
        cur = cur->next;
    }
    return head;
}

ListNode* reverseList(ListNode* head) {
    ListNode* prev = NULL;
    ListNode* curr = head;
    ListNode* next = NULL;
    while (curr) {
        next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    int n = sizeof(arr) / sizeof(arr[0]);
    ListNode* head = createList(arr, n);
    head = reverseList(head);
    return 0;
}
"""


@pytest.mark.parametrize("code,name,final_nodes", [
    (INSERT_HEAD, "头插法建链+遍历", 2),
    (LINKED_STACK, "链式栈 push/pop", 1),
    (LINKED_QUEUE, "链式队列 enqueue/dequeue", 2),
    (TYPEDEF_REVERSE, "typedef 版 数组建链+反转链表", 5),
])
def test_linked_list_code_generates_valid_animation(code, name, final_nodes):
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {}, LIST_OK_ASSERT.replace("FINAL_NODES", str(final_nodes)))
          + "\nconsole.log('ok');")
    out = _run_js(js, name)
    assert "ok" in out


def test_typedef_reverse_edges_present():
    """反转链表：快照应携带 edges（next 真实指向）"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(TYPEDEF_REVERSE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let any = false;
for (const s of res.steps) {
  const l = s.list;
  if (!l) continue;
  if (l.edges && Object.keys(l.edges).length) { any = true; break; }
}
if (!any) throw new Error("快照缺少 edges");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "edges 存在")
    assert "ok" in out


def test_typedef_reverse_last_edges_correct():
    """反转完成后 edges 应与最终链一致：5->4, 4->3, 3->2, 2->1, 1->null"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(TYPEDEF_REVERSE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const last = res.steps[res.steps.length - 1].list;
if (last.ids.join(",") !== "5,4,3,2,1") throw new Error("最后应 5,4,3,2,1: " + last.ids.join(","));
const want = JSON.stringify({"5": 4, "4": 3, "3": 2, "2": 1, "1": null});
if (JSON.stringify(last.edges) !== want) throw new Error("edges 错误: " + JSON.stringify(last.edges));
""") + "\nconsole.log('ok');")
    out = _run_js(js, "最终 edges")
    assert "ok" in out


def test_typedef_reverse_chain_values_flipped():
    """typedef + 数组建链 + 反转：最后快照顺序应为 5,4,3,2,1，且出现 sizeof(arr) 长度步骤"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(TYPEDEF_REVERSE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const last = res.steps[res.steps.length - 1];
const vals = last.list.ids.map(id => last.list.data[id]);
if (vals.join(",") !== "5,4,3,2,1") throw new Error("反转后应 5,4,3,2,1: " + vals.join(","));
let n = null;
for (const s of res.steps) {
  if (s.msg.indexOf("n = 5") >= 0) n = true;
  if (s.msg.indexOf("调用函数 createList") >= 0) break;
}
if (!n) throw new Error("sizeof(arr)/sizeof(arr[0]) 应算出 n = 5");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "typedef 反转值")
    assert "ok" in out


def test_ptr_names_deduplicated_across_scopes():
    """main 的 head 与 reverseList 内同名 head 不得重复（渲染时标签互相覆盖）；
    同一快照内指针 name 必须唯一，且连续两帧同节点多指针位置应错开"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(TYPEDEF_REVERSE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const seen = {};
let dupFound = false, renamed = false;
for (const s of res.steps) {
  const names = (s.list && s.list.ptrs || []).map(p => p.name);
  const uniq = new Set(names);
  if (uniq.size !== names.length) { dupFound = true; break; }
  for (const nm of names) {
    if (nm.indexOf(".") > 0 || /_\\d+$/.test(nm)) renamed = true;
  }
}
if (dupFound) throw new Error("同帧出现重复指针名，标签会互相覆盖");
if (!renamed) throw new Error("应出现作用域限定名（如 reverseList.head）");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "指针名去重")
    assert "ok" in out


def test_typedef_code_with_printf_skipped():
    """typedef 版代码保留 printList/printf 应能正常运行（printf/puts 输出自动跳过，不参与动画）"""
    code = TYPEDEF_REVERSE.replace(
        "ListNode* reverseList(ListNode* head) {",
        "void printList(ListNode* head) {\n"
        + "    while (head) {\n"
        + "        if (head->next) printf(\" -> \");\n"
        + "        head = head->next;\n"
        + "    }\n"
        + "}\n\n"
        + "ListNode* reverseList(ListNode* head) {",
    ).replace(
        "ListNode* head = createList(arr, n);\n    head = reverseList(head);",
        "ListNode* head = createList(arr, n);\n    printf(\"原链表: \");\n    printList(head);\n"
        + "    head = reverseList(head);\n    printList(head);",
    )
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {}, """
if (!res.ok) throw new Error("printf/puts 应被跳过并成功: " + res.error.msg);
const last = res.steps[res.steps.length - 1];
const vals = last.list.ids.map(id => last.list.data[id]);
if (vals.join(",") !== "5,4,3,2,1") throw new Error("反转后应 5,4,3,2,1: " + vals.join(","));
""") + "\nconsole.log('ok');")
    out = _run_js(js, "typedef printf 跳过")
    assert "ok" in out


STRUCT_QUEUE_TRAVERSAL = """#include <stdio.h>
#include <stdlib.h>

typedef struct TreeNode {
    int val;
    struct TreeNode *lchild;
    struct TreeNode *rchild;
} TreeNode;

typedef struct QNode {
    TreeNode* data;
    struct QNode* next;
} QNode;

typedef struct {
    QNode* front;
    QNode* rear;
} Queue;

void initQueue(Queue* q) {
    q->front = q->rear = NULL;
}

void enqueue(Queue* q, TreeNode* tn) {
    QNode* node = (QNode*)malloc(sizeof(QNode));
    node->data = tn;
    node->next = NULL;
    if (q->rear) {
        q->rear->next = node;
    } else {
        q->front = node;
    }
    q->rear = node;
}

int main() {
    Queue q;
    initQueue(&q);
    TreeNode* a = (TreeNode*)malloc(sizeof(TreeNode));
    a->val = 1;
    a->lchild = NULL;
    a->rchild = NULL;
    enqueue(&q, a);
    if (q.front) {
        QNode* temp = q.front;
        q.front = q.front->next;
        free(temp);
    }
    return 0;
}
"""


MERGE_LISTS_CODE = """typedef struct Node {
    int val;
    struct Node *next;
} Node;

Node* createNode(int val) {
    Node* node = (Node*)malloc(sizeof(Node));
    node->val = val;
    node->next = NULL;
    return node;
}

Node* createList(int arr[], int n) {
    if (n == 0) return NULL;
    Node* head = createNode(arr[0]);
    Node* cur = head;
    for (int i = 1; i < n; i++) {
        cur->next = createNode(arr[i]);
        cur = cur->next;
    }
    return head;
}

Node* mergeTwoLists(Node* l1, Node* l2) {
    if (!l1) return l2;
    if (!l2) return l1;
    if (l1->val <= l2->val) {
        l1->next = mergeTwoLists(l1->next, l2);
        return l1;
    } else {
        l2->next = mergeTwoLists(l1, l2->next);
        return l2;
    }
}

int main() {
    int arr1[] = {1, 2, 4};
    int arr2[] = {1, 3, 4};
    Node* l1 = createList(arr1, 3);
    Node* l2 = createList(arr2, 3);
    Node* merged = mergeTwoLists(l1, l2);
    return 0;
}
"""


def test_merge_lists_side_and_cmp():
    """合并两个有序链表：l2 作为次链（side）同时展示，条件比较产生 cmpIds 与
    "比较 l1->val=.. 与 l2->val=.." 消息，最终合并链数据有序"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(MERGE_LISTS_CODE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let sideSeen = false, cmpSeen = false, cmpMsg = false;
for (const s of res.steps) {
  const l = s.list;
  if (!l) continue;
  if (l.side && l.side.ids.length >= 2) sideSeen = true;
  if (l.cmpIds && l.cmpIds.length === 2) cmpSeen = true;
  if (s.msg && s.msg.indexOf("比较") >= 0 && s.msg.indexOf("l1->val") >= 0 && s.msg.indexOf("l2->val") >= 0) cmpMsg = true;
}
if (!sideSeen) throw new Error("合并过程应出现次链（l2 剩余部分）");
if (!cmpSeen) throw new Error("比较步骤应带 cmpIds");
if (!cmpMsg) throw new Error("应有 '比较 l1->val 与 l2->val' 消息");
const last = res.steps[res.steps.length - 1].list;
const vals = last.ids.map(id => last.data[id]);
if (vals.join(",") !== "1,1,2,3,4,4") throw new Error("合并结果应 1,1,2,3,4,4: " + vals.join(","));
""") + "\nconsole.log('ok');")
    out = _run_js(js, "合并链表 side/cmp")
    assert "ok" in out


BST_TREE_CODE = """typedef struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

TreeNode* createNode(int val) {
    TreeNode* node = (TreeNode*)malloc(sizeof(TreeNode));
    node->val = val;
    node->left = NULL;
    node->right = NULL;
    return node;
}

TreeNode* insert(TreeNode* root, int val) {
    if (root == NULL) return createNode(val);
    if (val < root->val)
        root->left = insert(root->left, val);
    else
        root->right = insert(root->right, val);
    return root;
}

int main() {
    TreeNode* root = NULL;
    int arr[] = { 5, 3, 8, 2, 4, 7, 9 };
    for (int i = 0; i < 7; i++) {
        root = insert(root, arr[i]);
    }
    return 0;
}
"""


def test_tree_mode_snapshot_and_structure():
    """left/right 字段 → 树模式：快照 nodes/rootId 正确，最终 BST 结构正确，步骤带 cur"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(BST_TREE_CODE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
if (res.mode !== "tree") throw new Error("应进入树模式: " + res.mode);
let treeSteps = 0, curSteps = 0;
for (const s of res.steps) {
  if (s.tree) {
    treeSteps++;
    if (s.tree.cur !== null && s.tree.cur !== undefined) curSteps++;
  }
}
if (!treeSteps) throw new Error("应有树快照");
if (!curSteps) throw new Error("树快照应带 cur 高亮");
const last = res.steps[res.steps.length - 1].tree;
const n = last.nodes;
const pick = (id) => [n[id].data, n[id].left, n[id].right];
const r1 = pick(last.rootId);
if (r1[0] !== 5 || r1[1] !== 2 || r1[2] !== 3) throw new Error("根应为 5(左2 右3): " + JSON.stringify(r1));
if (n[2].data !== 3 || n[4].data !== 2 || n[5].data !== 4) throw new Error("左子树错误");
if (n[3].data !== 8 || n[6].data !== 7 || n[7].data !== 9) throw new Error("右子树错误");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "树模式")
    assert "ok" in out


GRAPH_CODE = """typedef struct GNode {
    int val;
    struct GNode *next;
} GNode;

GNode* createNode(int v) {
    GNode* n = (GNode*)malloc(sizeof(GNode));
    n->val = v;
    n->next = NULL;
    return n;
}

void addEdge(GNode* adj[], int u, int v) {
    GNode* n = createNode(v);
    n->next = adj[u];
    adj[u] = n;
}

int main() {
    GNode* adj[4];
    int visited[4];
    for (int i = 0; i < 4; i++) {
        adj[i] = NULL;
        visited[i] = 0;
    }
    addEdge(adj, 0, 1);
    addEdge(adj, 0, 2);
    addEdge(adj, 1, 3);
    visited[0] = 1;
    visited[1] = 1;
    return 0;
}
"""


def test_graph_mode_adjacency():
    """指针数组（GNode* adj[N]）→ 图模式：邻接表快照正确，visited 数组进 vars"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(GRAPH_CODE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
if (res.mode !== "graph") throw new Error("应进入图模式: " + res.mode);
const last = res.steps[res.steps.length - 1].graph;
if (!last || last.n !== 4) throw new Error("应 4 个顶点: " + JSON.stringify(last && last.n));
const a0 = last.adj["0"];
if (!a0 || a0.indexOf(2) < 0 || a0.indexOf(1) < 0) throw new Error("顶点0 邻接应含 2,1（头插）: " + JSON.stringify(a0));
const v = last.vars.visited;
if (!v || v[0] !== 1 || v[1] !== 1) throw new Error("visited 应在 vars: " + JSON.stringify(v));
""") + "\nconsole.log('ok');")
    out = _run_js(js, "图模式")
    assert "ok" in out


MINSTACK_CODE = """typedef struct {
    int data[100];
    int minData[100];
    int top;
} MinStack;

MinStack* minStackCreate() {
    MinStack* obj = (MinStack*)malloc(sizeof(MinStack));
    obj->top = -1;
    return obj;
}

void minStackPush(MinStack* obj, int val) {
    obj->top++;
    obj->data[obj->top] = val;
    if (obj->top == 0) {
        obj->minData[obj->top] = val;
    } else {
        int prevMin = obj->minData[obj->top - 1];
        obj->minData[obj->top] = (val < prevMin) ? val : prevMin;
    }
}

void minStackPop(MinStack* obj) {
    if (obj->top >= 0) {
        obj->top--;
    }
}

int main() {
    MinStack* stack = minStackCreate();
    minStackPush(stack, -2);
    minStackPush(stack, 0);
    minStackPush(stack, -3);
    minStackPop(stack);
    return 0;
}
"""


def test_minstack_array_fields():
    """结构体数组字段（MinStack.data[]）+ obj->top++ + obj->data[i] 读写：
    快照输出 minStack（data/top），pop 后 top 减一"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(MINSTACK_CODE, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let ms = null;
for (const s of res.steps) {
  if (s.list && s.list.minStack) ms = s.list.minStack;
}
if (!ms) throw new Error("应输出 minStack 快照");
if (ms.top !== 1) throw new Error("pop 后 top 应为 1: " + ms.top);
if (ms.data[0] !== -2 || ms.data[1] !== 0) throw new Error("data 应为 -2,0: " + JSON.stringify(ms.data.slice(0, 3)));
""") + "\nconsole.log('ok');")
    out = _run_js(js, "MinStack 结构体数组字段")
    assert "ok" in out


def test_struct_value_queue() -> None:
    """结构体值变量（Queue q）+ . 成员访问 + &q 传址 + free：
    应正常运行；队列链成为主链且节点显示指向的树节点（#1）；q 不显示为指针；free 产生释放步骤"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(STRUCT_QUEUE_TRAVERSAL, {}, """
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let sawRef = false, sawFree = false, qPtrBad = false;
for (const s of res.steps) {
  if (s.msg && s.msg.indexOf("释放节点") >= 0) sawFree = true;
  const l = s.list;
  if (!l) continue;
  for (const p of l.ptrs) {
    /* 结构体指针参数（Queue* q）应标注 struct（显示"→ 结构体"），不得误标 NULL */
    if (p.name === "q" && p.struct !== true) qPtrBad = true;
  }
  for (const k in l.data) if (l.data[k] === "#1" || l.data[k] === "#2") sawRef = true;
}
if (!sawRef) throw new Error("队列节点应显示指向的树节点（#1 等）");
if (!sawFree) throw new Error("应出现 free 释放步骤");
if (qPtrBad) throw new Error("结构体指针应标注 struct（不是 NULL）");
const last = res.steps[res.steps.length - 1];
if (String(last.list.data[1]) !== "1") throw new Error("树节点数据应保留: " + JSON.stringify(last.list.data));
if (last.list.ids.length !== 1) throw new Error("队空后主链应只剩树节点: " + last.list.ids.length);
""") + "\nconsole.log('ok');")
    out = _run_js(js, "结构体值变量+free")
    assert "ok" in out


LIST_ERROR_CASES = [
    # (代码, 期望错误片段, 期望行号, 名称)
    ("""struct Node { int data; struct Node *next; };
int main() {
  struct Node *p = malloc(4);
  return 0;
}
""", "sizeof", 3, "链表 malloc 缺 sizeof"),
    ("""struct Node { int data; struct Node *next; };
int main() {
  struct Node *head = NULL;
  int x = head->data;
  return 0;
}
""", "空指针", 4, "链表空指针访问"),
    ("""struct Node { int data; struct Node *next; };
void f(struct Node *p) {
  p->data = 1;
}
""", "main", 1, "链表缺 main 函数"),
    ("""struct Node { int data; struct Node *next; };
int main() {
  struct Node *head = NULL;
  int x;
  scanf("%d", &x);
  return 0;
}
""", "scanf", 5, "链表代码中 scanf 报错"),
]


@pytest.mark.parametrize("code,expect,line,name", LIST_ERROR_CASES)
def test_linked_list_error_cases_report_chinese_error(code, expect, line, name):
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {}, """
if (res.ok) throw new Error("本应报错却成功");
if (res.error.line !== LINE) throw new Error("行号错误: " + res.error.line + " 应为 " + LINE);
if (res.error.msg.indexOf("EXPECT") < 0) throw new Error("错误信息不含关键字: " + res.error.msg);
""".replace("LINE", str(line)).replace("EXPECT", expect)) + "\nconsole.log('ok');")
    out = _run_js(js, name)
    assert "ok" in out


def test_linked_list_code_with_printf_runs():
    """链表代码中 printf/puts 输出自动跳过，代码原样可运行"""
    code = """struct Node { int data; struct Node *next; };
void printList(struct Node* head) {
  while (head) {
    if (head->next) printf(" -> ");
    head = head->next;
  }
}
int main() {
  struct Node *n1 = malloc(sizeof(struct Node));
  n1->data = 1;
  n1->next = NULL;
  printf("%d", n1->data);
  printList(n1);
  puts("done");
  return 0;
}
"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {}, """
if (!res.ok) throw new Error("printf/puts 应被跳过并成功: " + res.error.msg);
""") + "\nconsole.log('ok');")
    out = _run_js(js, "链表 printf 跳过")
    assert "ok" in out


def test_call_function_with_null_ptr_arg():
    """insertHead(head, 3) 首参为 NULL（空链表头插）时不得崩溃，动画正常生成"""
    code = """struct Node { int data; struct Node *next; };
struct Node* insertHead(struct Node* head, int val) {
  struct Node* p = malloc(sizeof(struct Node));
  p->data = val;
  p->next = head;
  return p;
}
int main() {
  struct Node* head = NULL;
  head = insertHead(head, 3);
  return 0;
}
"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {}, """
if (!res.ok) throw new Error("NULL 传参应正常模拟: " + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.list || last.list.ids.length !== 1) throw new Error("应剩 1 个节点");
""") + "\nconsole.log('ok');")
    out = _run_js(js, "NULL 传参")
    assert "ok" in out


def test_main_with_empty_parens_still_works():
    """int main()（无 void）空参数表不应报"期望 ')'" """
    code = INIT_FIRST.replace("int main(void)", "int main()")
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(code, {"size": 8}, SORT_OK_ASSERT) + "\nconsole.log('ok');")
    out = _run_js(js, "main 空参数表")
    assert "ok" in out


def test_while_condition_short_circuit_no_oob():
    """insertion 式 while (j >= 0 && a[j] > key) 在 j=-1 时不得越界"""
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + _csim_case(INSERTION, {"size": 6}, """
if (!res.ok) throw new Error(res.error.line + "|" + res.error.msg);
""") + "\nconsole.log('ok');")
    out = _run_js(js, "短路求值")
    assert "ok" in out