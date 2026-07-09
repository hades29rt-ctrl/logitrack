import time
from collections import defaultdict
from datetime import datetime
from fastapi import HTTPException, status

# ============================================================
# RATE LIMITING
# ============================================================
_request_counts: dict = defaultdict(list)
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW   = 60

def check_rate_limit(ip: str):
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    _request_counts[ip] = [t for t in _request_counts[ip] if t > window_start]
    if len(_request_counts[ip]) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de requetes — limite {RATE_LIMIT_REQUESTS}/min"
        )
    _request_counts[ip].append(now)

# ============================================================
# IP WHITELIST
# ============================================================
ALLOWED_NETWORKS = [
    "127.0.0.1", "::1",
    "192.168.", "10.", "172.16.", "172.17.", "172.18.",
    "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
    "172.29.", "172.30.", "172.31.",
]

IP_WHITELIST_ENABLED = False  # Mettre True en production reseau local

def check_ip_whitelist(ip: str):
    if not IP_WHITELIST_ENABLED:
        return
    for allowed in ALLOWED_NETWORKS:
        if ip.startswith(allowed):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Acces refuse depuis {ip} — reseau non autorise"
    )

# ============================================================
# LICENCE
# ============================================================
LICENSE_KEY        = "LOGI-TRACK-2026-XXXX-XXXX"
LICENSE_VALID_UNTIL = "2027-12-31"
LICENSE_MAX_USERS  = 50
COMPANY_NAME       = "LogiTrack Pro"

def verify_license() -> dict:
    try:
        expiry = datetime.strptime(LICENSE_VALID_UNTIL, "%Y-%m-%d")
        if datetime.now() > expiry:
            return {
                "valid": False,
                "reason": f"Licence expiree le {LICENSE_VALID_UNTIL}"
            }
        days_remaining = (expiry - datetime.now()).days
        return {
            "valid": True,
            "company": COMPANY_NAME,
            "key": LICENSE_KEY,
            "valid_until": LICENSE_VALID_UNTIL,
            "days_remaining": days_remaining,
            "max_users": LICENSE_MAX_USERS
        }
    except Exception as e:
        return {"valid": False, "reason": str(e)}

# ============================================================
# LOGS SECURITE
# ============================================================
_security_logs: list = []
MAX_LOGS = 1000

def log_security_event(event_type: str, ip: str, details: str = ""):
    _security_logs.append({
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "ip": ip,
        "details": details
    })
    if len(_security_logs) > MAX_LOGS:
        _security_logs.pop(0)

def get_security_logs(limit: int = 100) -> list:
    return _security_logs[-limit:]
