#!/usr/bin/env bash
# Read-only smoke test of a running AccessForge deployment. Writes nothing.
# Usage: scripts/verify-deployment.sh https://web.example.org [http://127.0.0.1:8000]
#   arg 1: public web origin (required). arg 2: private API origin, checked from the API host.
set -euo pipefail

WEB="${1:?usage: verify-deployment.sh WEB_ORIGIN [API_ORIGIN]}"
API="${2:-}"
failures=0

check() { # name, command...
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; failures=$((failures + 1)); fi
}
body_has() { curl -fsS --max-time 15 "$1" | grep -q "$2"; }
header_has() { curl -fsSI --max-time 15 "$1" | grep -qi "$2"; }

check "web home page loads"                 body_has "$WEB/" "AccessForge"
check "pilot page says it is not official"  body_has "$WEB/pilot" "not an official dashboard"
check "web -> API -> database (summary)"    body_has "$WEB/api/reports/summary" '"total"'
check "planner labels synthetic networks"   body_has "$WEB/api/planning/plans?dataset=corridor&budget=20" '"synthetic":true'
check "security headers set"                header_has "$WEB/" "x-content-type-options: nosniff"
check "framing denied"                      header_has "$WEB/" "x-frame-options: DENY"
check "feedback has no public read route"   test "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$WEB/api/feedback")" = 405
check "anonymous reads hide pending text"   bash -c "! curl -fsS --max-time 15 '$WEB/api/reports?state=unverified&limit=100' | grep -q '\"description\":\"'"
case "$WEB" in https://*) check "HTTPS enforced (HSTS)" header_has "$WEB/" "strict-transport-security" ;;
  *) echo "SKIP  HTTPS checks (web origin is not https)" ;; esac

if [ -n "$API" ]; then
  check "API liveness"                       body_has "$API/health/live" '"ok"'
  check "API readiness (database reachable)" body_has "$API/health/ready" '"ready"'
fi

if [ "$failures" -gt 0 ]; then echo "$failures check(s) failed"; exit 1; fi
echo "All checks passed"
