#!/usr/bin/env python3
"""
Script kiểm tra tính độc lập của Commit (Commit Scope Guard).
Học tập từ mô hình AI Bloxorz: Đảm bảo thành viên chỉ commit các file thuộc quyền phụ trách.
Cách chạy:
  python scripts/check_commit_scope.py --module m4
  python scripts/check_commit_scope.py --staged --module m0
"""

import sys
import subprocess
import argparse

MODULE_OWNERSHIP = {
    "m0": [
        "backend/app/routers/m0_auth.py", 
        "backend/app/models/", 
        "backend/data_seed/", 
        "backend/tests/test_m0_auth.py",
        "backend/app/services/fuzzy_matcher.py",
        "backend/tests/test_fuzzy_matcher.py"
    ],
    "m3": ["backend/app/routers/m3_chatbot.py", "backend/app/services/rag/", "backend/tests/test_m3_chatbot.py"],
    "m4": ["backend/app/routers/m4_ddi.py", "backend/tests/test_m4_ddi.py"],
    "frontend": ["frontend/"],
    "devops": [
        ".github/", "Dockerfile", ".dockerignore", "compose.yaml", ".env.example",
        "docker/postgres/init/", "backend/.env.example", "backend/app/main.py",
        "backend/app/core/", "backend/requirements.txt", "backend/requirements-runtime.txt",
        "backend/pytest.ini", "backend/tests/conftest.py", "backend/tests/test_main.py",
        "scripts/check_commit_scope.py", "scripts/smoke_compose.py",
    ]
}

def get_changed_files(staged_only=False):
    cmd = ["git", "diff", "--name-only", "--cached"] if staged_only else ["git", "diff", "--name-only", "origin/main...HEAD"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return [f.strip() for f in res.stdout.splitlines() if f.strip()]
    except Exception:
        # Fallback to unstaged / staged combined
        res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        files = []
        for line in res.stdout.splitlines():
            if len(line) > 3:
                files.append(line[3:].strip())
        return files

def main():
    parser = argparse.ArgumentParser(description="Kiểm tra phạm vi commit độc lập của task")
    parser.add_argument("--module", choices=list(MODULE_OWNERSHIP.keys()), required=True, help="Module đang thực hiện")
    parser.add_argument("--staged", action="store_true", help="Chỉ kiểm tra các file đã git add (staged)")
    args = parser.parse_args()

    changed_files = get_changed_files(args.staged)
    if not changed_files:
        print("✅ Không có file nào thay đổi. Sạch sẽ!")
        return 0

    allowed_prefixes = MODULE_OWNERSHIP[args.module]
    violations = []

    for f in changed_files:
        # Cho phép sửa tài liệu chung hoặc README nếu cần
        if f in ["CONTRIBUTING.md", "README.md"]:
            continue
        # Kiểm tra file có thuộc quyền phụ trách của module không
        is_allowed = any(f.startswith(prefix) for prefix in allowed_prefixes)
        if not is_allowed:
            violations.append(f)

    if violations:
        print(f"❌ [CẢNH BÁO VI PHẠM SANDBOX / FILE OWNERSHIP]")
        print(f"Bạn đang khai báo làm module: '{args.module}', nhưng đã sửa các file sau ngoài quyền phụ trách:")
        for v in violations:
            print(f"  - {v}")
        print("\n👉 Nguyên tắc Bloxorz: 'Chỉ sửa file của mình. Cần sửa file người khác thì nhắn người đó.'")
        print("Vui lòng bỏ chọn các file trên trước khi commit (git restore --staged <file>).")
        return 1

    print(f"✅ Hợp lệ! Tất cả {len(changed_files)} file thay đổi đều nằm trong Sandbox của module '{args.module}'.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
