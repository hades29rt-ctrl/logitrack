from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import (
    articles,
    emplacements,
    fournisseurs,
    clients,
    expedition,
    mouvements,
)
from app.api.routes.utilisateurs import router as utilisateurs_router
from app.api.routes import (
    articles,
    emplacements,
    fournisseurs,
    clients,
    expedition,
    mouvements,
    etiquettes,
)

from app.core.security import (
    check_rate_limit,
    check_ip_whitelist,
    log_security_event,
    verify_license,
)
from fastapi import Request
import logging

app = FastAPI(
    title="LogiTrack Pro API", description="API WMS Logistique", version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router)
app.include_router(emplacements.router)
app.include_router(fournisseurs.router)
app.include_router(utilisateurs_router)
app.include_router(clients.router)
app.include_router(expedition.router)
app.include_router(mouvements.router)
app.include_router(etiquettes.router)


@app.get("/")
async def root():
    return {"status": "online", "app": "LogiTrack Pro"}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    client_ip = request.client.host
    check_ip_whitelist(client_ip)
    check_rate_limit(client_ip)
    response = await call_next(request)
    if response.status_code == 401:
        log_security_event("UNAUTHORIZED", client_ip, str(request.url))
    return response


@app.get("/license")
async def get_license():
    return verify_license()
