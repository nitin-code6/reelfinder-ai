from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "healthy"


def test_shows_crud_flow():
    with TestClient(app) as client:
        # 1. Create show
        payload = {
            "title": "Integration Test Microdrama",
            "language": "English",
            "description": "Test series description"
        }
        create_resp = client.post("/api/shows/", json=payload)
        assert create_resp.status_code == 201
        show = create_resp.json()
        show_id = show["id"]
        assert show["title"] == payload["title"]

        # 2. Get show
        get_resp = client.get(f"/api/shows/{show_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == show_id

        # 3. List shows
        list_resp = client.get("/api/shows/")
        assert list_resp.status_code == 200
        shows = list_resp.json()
        assert any(s["id"] == show_id for s in shows)
