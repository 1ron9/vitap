"""Kiểm thử FD-01 với project/volume riêng; luôn dọn dữ liệu thử khi kết thúc."""

import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
PROJECT = "vitap-fd01-smoke"
ENV = {**os.environ, "BACKEND_PORT": "0"}
COMPOSE = ["docker", "compose", "--project-name", PROJECT, "--project-directory", str(ROOT)]


def compose(*args, capture=False):
    return subprocess.run(
        [*COMPOSE, *args], cwd=ROOT, env=ENV, check=True,
        text=True, capture_output=capture, timeout=900,
    ).stdout


def sql(statement):
    return compose(
        "exec", "-T", "db", "sh", "-c",
        'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"',
        "--", statement, capture=True,
    ).strip()


def api_url():
    address = compose("port", "backend", "8000", capture=True).strip()
    return f"http://{address}"


def request(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def wait_ready(base_url):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            status, body = request(base_url + "/ready")
            if status == 200 and json.loads(body).get("pgvector") == "ok":
                return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise AssertionError("Backend did not become ready with PostgreSQL + pgvector")


def main():
    if not (ROOT / ".env").exists():
        raise SystemExit("Create .env from .env.example before running this check")
    # Tránh xóa nhầm một project thử đang được người khác sử dụng.
    if compose("ps", "--all", "--quiet", capture=True).strip():
        raise SystemExit(f"Project {PROJECT} already has containers; stop it before retrying")
    try:
        compose("up", "--build", "--wait", "--wait-timeout", "180")
        base_url = api_url()
        wait_ready(base_url)
        assert request(base_url + "/health")[0] == 200
        assert request(base_url + "/docs")[0] == 200
        assert sql("SELECT '[1,2,3]'::vector <-> '[1,2,3]'::vector") == "0"
        sql("CREATE TABLE fd01_smoke (id integer PRIMARY KEY); INSERT INTO fd01_smoke VALUES (1)")

        # Tạo lại container, giữ nguyên volume để kiểm tra dữ liệu bền vững.
        compose("down")
        compose("up", "--wait", "--wait-timeout", "180")
        base_url = api_url()
        wait_ready(base_url)
        assert sql("SELECT count(*) FROM fd01_smoke WHERE id = 1") == "1"

        compose("stop", "db")
        assert request(base_url + "/ready")[0] == 503
        assert request(base_url + "/health")[0] == 200
        compose("start", "db")
        wait_ready(base_url)
        print("PASS: API, pgvector, persistent volume, outage and recovery")
    except Exception:
        compose("logs", "--no-color", "--tail", "100")
        raise
    finally:
        compose("down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
