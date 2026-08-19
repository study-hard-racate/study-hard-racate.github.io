# -*- coding: utf-8 -*-
"""一键部署：重新生成静态站并推送 GitHub Pages。
用法：python deploy.py ["提交信息"]（不带参数则用默认信息）"""
import datetime
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")
GIT = os.path.join(SITE, ".git")
BACKUP = os.path.join(ROOT, "_site_git_backup_" + str(os.getpid()))
MSG = sys.argv[1] if len(sys.argv) > 1 else "update " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


def main():
    if not os.path.isdir(SITE):
        sys.exit("缺少 site 目录，请先运行一次 freeze.py")
    # freeze 会删除整个 site 目录，先备份 .git（用唯一目录避免旧备份被占用）
    if os.path.isdir(GIT):
        shutil.move(GIT, BACKUP)
        print("已备份 site/.git")
    try:
        subprocess.run([sys.executable, os.path.join(ROOT, "freeze.py")], check=True)
    finally:
        if os.path.isdir(BACKUP):
            shutil.move(BACKUP, GIT)
            print("已恢复 site/.git")
    subprocess.run(["git", "add", "-A"], cwd=SITE, check=True)
    subprocess.run(["git", "commit", "-m", MSG], cwd=SITE, check=True)
    print("推送中...")
    subprocess.run(["git", "push"], cwd=SITE, check=True)
    print("部署完成：", MSG)


if __name__ == "__main__":
    main()
