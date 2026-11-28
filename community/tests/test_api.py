"""JSON API used by the AccessForge web app. Run from community/: python -m pytest tests"""
import io
import os
import sys
import tempfile

DB_DIR = tempfile.mkdtemp()
os.environ["SECRET_KEY"] = "test-secret-key-0123456789"
os.environ["PUBLIC_BASE_URL"] = "https://watch.example"
os.environ["COMMUNITY_DATABASE_URL"] = "sqlite:///" + os.path.join(DB_DIR, "test.db")
# Keep alerts on the console: no real email, SMS or Telegram during tests.
for key in ("MAIL_USERNAME", "MAIL_PASSWORD", "TWILIO_ACCOUNT_SID", "TELEGRAM_BOT_TOKEN"):
    os.environ.pop(key, None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import flask_sqlalchemy.query  # noqa: E402
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
    community.report_limiter.hits.clear()
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


def guess(client, email, password="wrong", ip=None):
    extra = {"environ_base": {"REMOTE_ADDR": ip}} if ip else {}
    return client.post("/api/login", json={"email": email, "password": password}, headers=FETCH, **extra)


def test_proxy_loopback_failures_do_not_lock_everyone_out(client):
    sign_up(client)
    client.post("/api/logout", headers=FETCH)
    for n in range(25):
        guess(client, f"stranger{n}@example.com")
    assert guess(client, "ana@example.com", "longpass1").status_code == 200


def test_real_addresses_are_still_limited_per_ip(client):
    sign_up(client)
    client.post("/api/logout", headers=FETCH)
    for n in range(20):
        guess(client, f"stranger{n}@example.com", ip="203.0.113.7")
    assert guess(client, "ana@example.com", "longpass1", ip="203.0.113.7").status_code == 429
    assert guess(client, "ana@example.com", "longpass1", ip="198.51.100.2").status_code == 200


def post_report(client, **extra):
    data = {"type": "fire", "description": "Smoke on 24th St", "zip": "94110", "lat": "37.75", "lng": "-122.41"}
    return client.post("/api/reports", data={**data, **extra}, headers=FETCH)


def test_only_members_post_reports_and_contact_comes_from_the_account(client):
    assert post_report(client).status_code == 401
    sign_up(client, phone="415 555 0123")
    r = post_report(client, email="someone-else@example.com")
    assert r.status_code == 201
    with community.app.app_context():
        report = community.db.session.get(community.Report, r.get_json()["id"])
        assert (report.email, report.phone) == ("ana@example.com", "+14155550123")


def test_strangers_cannot_resolve_someone_elses_report(client):
    sign_up(client)
    report_id = post_report(client).get_json()["id"]
    client.post("/api/logout", headers=FETCH)
    sign_up(client, email="mallory@example.com")
    # The old hole: claiming the victim's email on a report of your own.
    post_report(client, email="ana@example.com")
    assert client.post(f"/api/resolve/{report_id}").status_code == 403
    client.post("/api/logout", headers=FETCH)
    client.post("/api/login", json={"email": "ana@example.com", "password": "longpass1"}, headers=FETCH)
    assert client.post(f"/api/resolve/{report_id}").status_code == 200


def test_alert_links_ignore_a_forged_host(client, monkeypatch):
    sign_up(client)
    client.post("/api/logout", headers=FETCH)
    sign_up(client, email="ben@example.com")
    sent = []
    monkeypatch.setattr(community.notifications, "dispatch", lambda app, mail, jobs: sent.extend(jobs))
    client.post("/api/reports", data={"type": "fire", "description": "y", "zip": "94110"},
                headers={**FETCH, "X-Forwarded-Host": "evil.example"})
    bodies = " ".join(job[3] for job in sent)
    assert "https://watch.example/reports" in bodies and "evil.example" not in bodies


def test_reports_are_rate_limited_and_uploads_capped(client):
    sign_up(client)
    for _ in range(10):
        assert post_report(client).status_code == 201
    assert post_report(client).status_code == 429
    big = {"image": (io.BytesIO(b"0" * (11 * 1024 * 1024)), "big.jpg")}
    r = client.post("/api/lost-found", data={"kind": "lost", **big}, headers=FETCH,
                    content_type="multipart/form-data")
    assert r.status_code == 413


def test_signup_race_returns_a_message_not_a_crash(client, monkeypatch):
    sign_up(client)
    client.post("/api/logout", headers=FETCH)
    # Simulate the other request winning between the "email taken?" check and the insert.
    monkeypatch.setattr(flask_sqlalchemy.query.Query, "first", lambda self: None)
    r = sign_up(client)
    assert r.status_code == 400 and "already exists" in r.get_json()["error"]
