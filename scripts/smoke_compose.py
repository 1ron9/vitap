"""Kiểm thử FD-01 với project/volume riêng; luôn dọn dữ liệu thử khi kết thúc."""

import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
PROJECT = "vitap-fd01-smoke"
ENV = {
    **os.environ,
    "BACKEND_PORT": "0",
    "POSTGRES_PUBLISH_PORT": "0",
    "USE_MOCK_AI": "true",
    "GEMINI_API_KEY": "",
    "OLLAMA_BASE_URL": "",
    "RERANKER_URL": "",
    "KAGGLE_MEDGEMMA_NGROK_URL": "",
}
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


def request(url, payload=None, *, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
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


def check_m3_fixture():
    assert sql("""
        SELECT count(*) || ':' || count(c.embedding) || ':' || min(vector_dims(c.embedding))
        FROM knowledge_chunks c JOIN knowledge_documents d ON d.id = c.document_id
        WHERE d.source_name = 'VitaP dev fixture' AND d.external_id = 'sprint4-m3-pgvector'
          AND d.status = 'DEV_FIXTURE'
    """) == "2:2:768"
    assert sql("""
        SELECT c.chunk_index
        FROM knowledge_chunks c JOIN knowledge_documents d ON d.id = c.document_id
        WHERE d.source_name = 'VitaP dev fixture' AND d.external_id = 'sprint4-m3-pgvector'
        ORDER BY c.embedding <=> ('[1' || repeat(',0',767) || ']')::vector
        LIMIT 1
    """) == "0"


def send_m3_message(base_url):
    sessions_url = base_url + "/api/v1/ai/chat/sessions"
    assert request(sessions_url)[0] == 401
    credentials = {"email": f"smoke-{uuid4()}@example.test", "password": "offline-m3-password"}
    consent = {"version": "health-ai-v1", "scope": "HEALTH_DATA_AND_AI_PROCESSING", "is_accepted": True}
    assert request(base_url + "/api/v1/auth/register", {**credentials, "consent": consent})[0] == 201
    status, body = request(base_url + "/api/v1/auth/login", credentials)
    assert status == 200, body
    token = json.loads(body)["access_token"]
    status, body = request(sessions_url, {"context_mode": "GENERAL"}, token=token)
    assert status == 201, body
    session_id = json.loads(body)["id"]
    messages_path = f"/api/v1/ai/chat/sessions/{session_id}/messages"
    status, body = request(base_url + messages_path, {"content": "Thông tin tổng quan về chỉ số A1C"}, token=token)
    assert status == 200, body
    message = json.loads(body)["assistant_message"]
    assert message["answer"]["answer_status"] == "INSUFFICIENT_EVIDENCE"
    assert message["answer"]["citations"] == []
    return token, messages_path, message["id"]


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
        check_m3_fixture()
        token, messages_path, message_id = send_m3_message(base_url)
        sql("CREATE TABLE fd01_smoke (id integer PRIMARY KEY); INSERT INTO fd01_smoke VALUES (1)")

        # Tạo lại container, giữ nguyên volume để kiểm tra dữ liệu bền vững.
        compose("down")
        compose("up", "--wait", "--wait-timeout", "180")
        base_url = api_url()
        wait_ready(base_url)
        assert sql("SELECT count(*) FROM fd01_smoke WHERE id = 1") == "1"
        check_m3_fixture()
        status, body = request(base_url + messages_path, token=token)
        assert status == 200, body
        assert json.loads(body)["items"][1]["id"] == message_id

        compose("stop", "db")
        assert request(base_url + "/ready")[0] == 503
        assert request(base_url + "/health")[0] == 200
        compose("start", "db")
        wait_ready(base_url)
        print("PASS: API, offline M3 migrations/seed/chat, persistent volume, outage and recovery")
    except Exception:
        compose("logs", "--no-color", "--tail", "100")
        raise
    finally:
        compose("down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
