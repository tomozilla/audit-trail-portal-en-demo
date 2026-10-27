#!/usr/bin/env python3
"""Plays out the shared-login case and the per-person case against the demo tables, then tries to tamper.
Uses only the publishable key and demo users. Needs these environment variables (never commit them):
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PW_SHARED, PW_SATO, PW_TANAKA
Prints status codes and counts only: no tokens, no passwords."""
import json, os, sys, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]

def call(method, path, token=None, body=None, prefer=None):
    headers = {"apikey": KEY, "Content-Type": "application/json"}
    if token: headers["Authorization"] = "Bearer " + token
    if prefer: headers["Prefer"] = prefer
    req = urllib.request.Request(URL + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def login(email, pw):
    code, data = call("POST", "/auth/v1/token?grant_type=password", body={"email": email, "password": pw})
    assert code == 200, f"login failed for {email}: {code}"
    return data["access_token"], data["user"]["id"]

shared, _ = login("shared-desk@example.com", os.environ["PW_SHARED"])
sato, sato_id = login("staff-sato@example.com", os.environ["PW_SATO"])
tanaka, tanaka_id = login("staff-tanaka@example.com", os.environ["PW_TANAKA"])

print("== Case A: one shared login, two real people ==")
c, r = call("POST", "/rest/v1/support_requests", shared, {"title": "Printer on 2F is down"}, "return=representation")
rid = r[0]["id"]; print("Sato (using the shared login) adds a request:", c)
c, _ = call("PATCH", f"/rest/v1/support_requests?id=eq.{rid}", shared, {"status": "in_progress"}); print("Tanaka (same shared login) moves it to in_progress:", c)

print("== Case B: one login per person ==")
c, r = call("POST", "/rest/v1/support_requests", sato, {"title": "Update the address form"}, "return=representation")
rid2 = r[0]["id"]; print("Sato adds a request:", c)
c, _ = call("PATCH", f"/rest/v1/support_requests?id=eq.{rid2}", tanaka, {"status": "in_progress"}); print("Tanaka moves it to in_progress:", c)
c, _ = call("PATCH", f"/rest/v1/support_requests?id=eq.{rid2}", sato, {"status": "done"}); print("Sato marks it done:", c)

print("== Tampering ==")
c, r = call("PATCH", f"/rest/v1/support_requests?id=eq.{rid2}", sato, {"updated_by": tanaka_id}, "return=representation")
print("Sato tries to write Tanaka's id into updated_by:", c, "-> stored as Sato?", r[0]["updated_by"] == sato_id)
c, r = call("PATCH", "/rest/v1/activity_log?id=gt.0", sato, {"actor_email": "nobody@example.com"}, "return=representation")
print("Sato tries to edit the log:", c, "rows changed:", len(r) if isinstance(r, list) else r)
c, r = call("DELETE", "/rest/v1/activity_log?id=gt.0", sato, None, "return=representation")
print("Sato tries to delete the log:", c, "rows deleted:", len(r) if isinstance(r, list) else r)
c, r = call("POST", "/rest/v1/activity_log", sato, {"action": "UPDATE", "actor_email": "tanaka@example.com"})
print("Sato tries to forge a log row:", c)
c, r = call("GET", "/rest/v1/support_requests?select=id")
print("Not signed in, reading requests:", c, "rows:", len(r) if isinstance(r, list) else r)
c, r = call("POST", "/rest/v1/support_requests", None, {"title": "anonymous"})
print("Not signed in, adding a request:", c)
