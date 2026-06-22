from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import articles, emplacements, fournisseurs, clients, expedition, mouvements
from app.api.routes.utilisateurs import router as utilisateurs_router

app = FastAPI(
    title="LogiTrack Pro API",
    description="API WMS Logistique",
    version="1.0.0"
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

@app.get("/")
async def root():
    return {"status": "online", "app": "LogiTrack Pro"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}