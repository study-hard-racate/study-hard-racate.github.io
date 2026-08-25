"""pytest 配置：本项目为纯静态站（GitHub Pages 部署产物，无 Flask），
提供 page fixture 从磁盘读取 HTML，替代原 Flask app.test_client()。"""

import os

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 路由 → 静态文件相对路径（与线上目录结构一致）
PAGES = {
    "/": "index.html",
    "/array": "array/index.html",
    "/linked-list": "linked-list/index.html",
    "/stack": "stack/index.html",
    "/queue": "queue/index.html",
    "/sorting": "sorting/index.html",
    "/sorting/bubble": "sorting/bubble/index.html",
    "/sorting/selection": "sorting/selection/index.html",
    "/sorting/insertion": "sorting/insertion/index.html",
    "/sorting/quick": "sorting/quick/index.html",
    "/sorting/merge": "sorting/merge/index.html",
    "/sorting/shell": "sorting/shell/index.html",
    "/sorting/heap": "sorting/heap/index.html",
    "/search": "search/index.html",
    "/search/linear": "search/linear/index.html",
    "/search/binary": "search/binary/index.html",
    "/search/hash": "search/hash/index.html",
    "/search/block": "search/block/index.html",
    "/data-structure": "data-structure/index.html",
    "/tree-graph": "tree-graph/index.html",
    "/dp": "dp/index.html",
    "/tree/binary-tree": "tree/binary-tree/index.html",
    "/tree/bst": "tree/bst/index.html",
    "/tree/traversal": "tree/traversal/index.html",
    "/tree/heap": "tree/heap/index.html",
    "/tree/rbtree": "tree/rbtree/index.html",
    "/tree/union-find": "tree/union-find/index.html",
    "/graph/bfs-dfs": "graph/bfs-dfs/index.html",
    "/graph/topological": "graph/topological/index.html",
    "/graph/dijkstra": "graph/dijkstra/index.html",
    "/dp/01-knapsack": "dp/01-knapsack/index.html",
    "/dp/complete-knapsack": "dp/complete-knapsack/index.html",
    "/dp/lcs": "dp/lcs/index.html",
    "/dp/edit-distance": "dp/edit-distance/index.html",
    "/dp/stairs": "dp/stairs/index.html",
    "/dp/lis": "dp/lis/index.html",
}

# 所有算法/模块页（含播放器与舞台），列表页/首页不在此列
ALGO_PAGES = [p for p in PAGES if p not in ("/", "/sorting", "/search", "/data-structure", "/tree-graph", "/dp")]

# 所有页面（含列表页与首页）
ALL_PAGES = list(PAGES.keys())


def page_path(route):
    return os.path.join(ROOT, PAGES[route])


@pytest.fixture()
def page():
    """读取路由对应静态 HTML 文本"""
    def _get(route):
        with open(page_path(route), encoding="utf-8") as f:
            return f.read()
    return _get
