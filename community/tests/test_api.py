"""JSON API used by the AccessForge web app. Run from community/: python -m pytest tests"""
import os
import sys
import tempfile

DB_DIR = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(DB_DIR, "test.db")
# Keep alerts on the console: no real email, SMS or Telegram during tests.
for key in ("MAIL_USERNAME", "MAIL_PASSWORD", "TWILIO_ACCOUNT_SID", "TELEGRAM_BOT_TOKEN"):
    os.environ.pop(key, None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

import app as community  # noqa: E402

FETCH = {"X-Requested-With": "fetch"}
MEMBER = {"name": "Ana Ruiz", "email": "ana@example.com", "zip": "94110", "password": "longpass1",
          "confirm": "longpass1", "notify_email": True}


@pytest.fixture
def client():
    with community.app.app_context():
        community.db.drop_all()
        community.ensure_schema()
    community.login_limiter.hits.clear()
    community.ip_limiter.hits.clear()
    return community.app.test_client()


def sign_up(client, **overrides):
    return client.post("/api/signup", json={**MEMBER, **overrides}, headers=FETCH)


def test_writes_need_the_fetch_header(client):
    assert client.post("/api/signup", json=MEMBER).status_code == 400
    assert client.post("/api/login", json=MEMBER).status_code == 400


def test_signup_login_logout_and_me(client):
    assert client.get("/api/me").get_json()["user"] is None
    assert sign_up(client).status_code == 201
    me = client.get("/api/me").get_json()
    assert me["user"]["email"] == "ana@example.com"
    assert "Pet" in me["item_categories"] and "fire" in me["categories"]

    assert sign_up(client).get_json()["error"].startswith("An account with that email")
    client.post("/api/logout", headers=FETCH)
    assert client.get("/api/me").get_json()["user"] is None

    bad = client.post("/api/login", json={"email": "ana@example.com", "password": "nope"}, headers=FETCH)
    assert bad.status_code == 401
    ok = client.post("/api/login", json={"email": "ANA@example.com", "password": "longpass1"}, headers=FETCH)
    assert ok.status_code == 200 and ok.get_json()["user"]["zip"] == "94110"


def test_signup_validation(client):
    assert sign_up(client, password="short", confirm="short").status_code == 400
    assert sign_up(client, notify_sms=True).get_json()["error"].startswith("Add a phone number")
    assert sign_up(client, email="not-an-email").status_code == 400


def test_login_is_rate_limited(client):
    sign_up(client)
    for _ in range(5):
        client.post("/api/login", json={"email": "ana@example.com", "password": "x"}, headers=FETCH)
    r = client.post("/api/login", json={"email": "ana@example.com", "password": "longpass1"}, headers=FETCH)
    assert r.status_code == 429


def test_account_update_and_members_only(client):
    assert client.put("/api/account", json={}, headers=FETCH).status_code == 401
    sign_up(client)
    r = client.put("/api/account", json={"name": "Ana R", "zip": "94103", "phone": "+1 415 555 0123",
                                         "notify_sms": True}, headers=FETCH)
    assert r.status_code == 200
    assert r.get_json()["user"]["notify_sms"] is True and r.get_json()["user"]["zip"] == "94103"
    assert client.put("/api/account", json={"name": "", "zip": ""}, headers=FETCH).status_code == 400


def test_lost_found_flow_and_alerts(client):
    sign_up(client)
    post = client.post("/api/lost-found", headers=FETCH, data={
        "kind": "lost", "title": "Brown dog", "category": "Pet", "description": "Answers to Max",
        "zip": "94110", "lat": "37.75", "lng": "-122.41"})
    assert post.status_code == 201
    item = post.get_json()
    assert item["poster"] == "Ana" and item["is_mine"] and "email" not in item

    # A second neighbor signs up and answers the post.
    client.post("/api/logout", headers=FETCH)
    sign_up(client, name="Ben Lee", email="ben@example.com")
    assert client.get(f"/api/lost-found/{item['id']}").get_json()["is_mine"] is False
    r = client.post(f"/api/lost-found/{item['id']}/contact", json={"message": "I saw him"}, headers=FETCH)
    assert r.status_code == 200
    assert client.post(f"/api/lost-found/{item['id']}/close", headers=FETCH).status_code == 403

    client.post("/api/logout", headers=FETCH)
    client.post("/api/login", json={"email": "ana@example.com", "password": "longpass1"}, headers=FETCH)
    inbox = client.get("/api/notifications").get_json()
    assert any("ben@example.com" in (n["body"] or "") for n in inbox)
    assert client.get("/api/me").get_json()["unread"] == 0
    assert client.post(f"/api/lost-found/{item['id']}/close", headers=FETCH).get_json()["status"] == "closed"
    assert client.get("/api/lost-found").get_json() == []
    assert len(client.get("/api/lost-found?closed=1").get_json()) == 1


def test_lost_found_validation_and_missing(client):
    sign_up(client)
    assert client.post("/api/lost-found", headers=FETCH, data={"kind": "lost"}).status_code == 400
    assert client.get("/api/lost-found/999").status_code == 404


def test_updates_list(client):
    with community.app.app_context():
        community.db.session.add(community.Announcement(title="Water main", body="Closed on 24th"))
        community.db.session.commit()
    assert client.get("/api/updates").get_json()[0]["title"] == "Water main"


def test_html_forms_still_work(client):
    """The Flask pages share the helpers the JSON API uses."""
    form = {**MEMBER, "notify_email": "on"}
    assert client.post("/signup", data=form).status_code == 302
    r = client.post("/lost-found/new", data={"kind": "found", "title": "Keys", "category": "Keys",
                                             "description": "Blue keyring", "zip": "94110",
                                             "lat": "37.7", "lng": "-122.4"})
    assert r.status_code == 302 and "/lost-found/" in r.headers["Location"]
    assert client.post("/account", data={"name": "Ana", "zip": "94110"}).status_code == 302
    client.get("/logout")
    assert client.post("/login", data={"email": "ana@example.com", "password": "bad"}).status_code == 200
    assert client.post("/login", data={"email": "ana@example.com", "password": "longpass1"}).status_code == 302
