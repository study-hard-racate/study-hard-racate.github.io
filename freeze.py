"""把 Flask 应用预渲染为纯静态站点（GitHub Pages 部署用）。

用法：python freeze.py
生成 site/ 目录：每个路由 → 对应的 index.html（绝对路径链接直接命中），
static/ 原样复制，404.html 作为 GitHub Pages 的自定义 404 页。
"""

import os
import shutil
import sys

from app import app

ROUTES = [
    ("/", "index.html"),
    ("/array", "array/index.html"),
    ("/linked-list", "linked-list/index.html"),
    ("/stack", "stack/index.html"),
    ("/queue", "queue/index.html"),
    ("/sorting", "sorting/index.html"),
    ("/search", "search/index.html"),
    ("/search/linear", "search/linear/index.html"),
    ("/search/binary", "search/binary/index.html"),
    ("/search/hash", "search/hash/index.html"),
    ("/search/block", "search/block/index.html"),
    ("/sorting/bubble", "sorting/bubble/index.html"),
    ("/sorting/selection", "sorting/selection/index.html"),
    ("/sorting/insertion", "sorting/insertion/index.html"),
    ("/sorting/quick", "sorting/quick/index.html"),
    ("/sorting/merge", "sorting/merge/index.html"),
    ("/sorting/shell", "sorting/shell/index.html"),
    ("/tree/binary-tree", "tree/binary-tree/index.html"),
    ("/tree/bst", "tree/bst/index.html"),
    ("/tree/traversal", "tree/traversal/index.html"),
    ("/tree/heap", "tree/heap/index.html"),
    ("/graph/bfs-dfs", "graph/bfs-dfs/index.html"),
    ("/tree/union-find", "tree/union-find/index.html"),
    ("/data-structure", "data-structure/index.html"),
    ("/tree-graph", "tree-graph/index.html"),
    ("/dp", "dp/index.html"),
    ("/dp/01-knapsack", "dp/01-knapsack/index.html"),
    ("/dp/complete-knapsack", "dp/complete-knapsack/index.html"),
    ("/dp/lcs", "dp/lcs/index.html"),
    ("/dp/edit-distance", "dp/edit-distance/index.html"),
]

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")


def main():
    if os.path.isdir(BASE):
        shutil.rmtree(BASE)
    os.makedirs(BASE)
    with app.test_client() as client:
        for route, out in ROUTES:
            r = client.get(route)
            if r.status_code != 200:
                sys.exit(f"预渲染失败: {route} → {r.status_code}")
            path = os.path.join(BASE, out)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(r.get_data(as_text=True))
            print(f"OK  {route} -> {out}")
        r404 = client.get("/no-such-page-xyz")
        if r404.status_code == 404:
            with open(os.path.join(BASE, "404.html"), "w", encoding="utf-8") as f:
                f.write(r404.get_data(as_text=True))
            print("OK  /404 -> 404.html")
        else:
            sys.exit("404 预渲染失败")
    shutil.copytree(
        os.path.join(os.path.dirname(BASE), "static"),
        os.path.join(BASE, "static"),
        dirs_exist_ok=True,
    )
    print("静态站点已生成:", BASE)


if __name__ == "__main__":
    main()