from fastapi.testclient import TestClient

from app.main import app


def test_healthz():
    client = TestClient(app)
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_chat_rejects_empty_user_message():
    client = TestClient(app)
    resp = client.post("/chat", json={
        "conversation_id": "t", "messages": [{"role": "system", "content": "hi"}]
    })
    assert resp.status_code == 422


def test_chat_request_validation():
    client = TestClient(app)
    resp = client.post("/chat", json={"messages": []})
    assert resp.status_code == 422
