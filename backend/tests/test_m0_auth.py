"""AU-01 contract checks for registration, token rotation, and principals."""
from uuid import uuid4

from fastapi import Depends
from app.main import app
from app.routers.m0_auth import Principal, get_principal, require_user


def registration(email=None):
    return {
        "email": email or f"u-{uuid4()}@example.test",
        "password": "long-password-123",
        "full_name": "Nguyễn Bảo Trọng",
        "consent": {"version": "health-ai-v1", "scope": "HEALTH_DATA_AND_AI_PROCESSING", "is_accepted": True},
    }


def test_register_login_refresh_me_and_logout(client):
    payload = registration()
    result = client.post("/api/v1/auth/register", json=payload)
    assert result.status_code == 201, result.text
    user_id = result.json()["id"]
    assert result.json()["email"] == payload["email"]
    assert "password_hash" not in result.json()
    login = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login.status_code == 200, login.text
    first = login.json()
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {first['access_token']}"})
    assert me.status_code == 200 and me.json()["id"] == user_id
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert rotated.status_code == 200, rotated.text
    assert rotated.json()["refresh_token"] != first["refresh_token"]
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    new_token = rotated.json()["refresh_token"]
    assert client.post("/api/v1/auth/logout", json={"refresh_token": new_token}, headers={"Authorization": f"Bearer {first['access_token']}"}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": new_token}).status_code == 401


def test_register_validation_and_consent(client):
    payload = registration()
    payload["consent"]["is_accepted"] = False
    assert client.post("/api/v1/auth/register", json=payload).status_code == 403
    payload["consent"]["is_accepted"] = True
    payload["role"] = "ADMIN"
    assert client.post("/api/v1/auth/register", json=payload).status_code == 422
    del payload["role"]
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409
    bad_login = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": "wrong"})
    assert bad_login.status_code == 401


def test_long_utf8_password_round_trip(client):
    payload = registration()
    payload["password"] = "mật-khẩu-đủ-dài-" * 6
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/login", json={
        "email": payload["email"], "password": payload["password"]
    }).status_code == 200


def test_guest_and_user_principals(client):
    @app.get("/__test_principal")
    def principal_route(principal: Principal = Depends(get_principal)):
        return {"kind": principal.kind}

    @app.get("/__test_user_only")
    def user_only_route(user=Depends(require_user)):
        return {"id": str(user.id)}

    try:
        guest = client.post("/api/v1/guest-sessions", json={"consent_accepted": True, "consent_version": "guest-processing-v1"})
        assert guest.status_code == 201, guest.text
        guest_token = guest.json()["guest_token"]
        assert client.get("/__test_principal").json()["kind"] == "PUBLIC"
        assert client.get("/__test_principal", headers={"X-Guest-Token": guest_token}).json()["kind"] == "GUEST"
        assert client.get("/__test_user_only", headers={"X-Guest-Token": guest_token}).status_code == 403
        assert client.get("/__test_user_only").status_code == 401
        assert client.get("/__test_principal", headers={"X-Guest-Token": "invalid"}).status_code == 401
        assert client.get("/__test_principal", headers={"X-Guest-Token": ""}).status_code == 401
        assert client.get("/__test_principal", headers={"Authorization": ""}).status_code == 401
        assert client.get("/__test_principal", headers={"X-Guest-Token": guest_token, "Authorization": "Bearer invalid"}).status_code == 400
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") not in ("/__test_principal", "/__test_user_only")]
