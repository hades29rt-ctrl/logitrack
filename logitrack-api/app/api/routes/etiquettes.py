import asyncpg
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import random

router = APIRouter(prefix="/etiquettes", tags=["Etiquettes"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

def generer_sscc() -> str:
    now = datetime.now()
    seq = str(random.randint(0, 99)).zfill(2)
    sscc_base = f"00{now.strftime('%Y%m%d%H%M%S')}{seq}"
    sscc = sscc_base[:17]
    total = 0
    for i, c in enumerate(reversed(sscc)):
        if i % 2 == 0:
            total += int(c) * 3
        else:
            total += int(c)
    check = (10 - (total % 10)) % 10
    return sscc + str(check)

def calcul_check_digit(code: str) -> int:
    total = 0
    for i, c in enumerate(reversed(code)):
        if i % 2 == 0:
            total += int(c) * 3
        else:
            total += int(c)
    return (10 - (total % 10)) % 10

class EtiquetteReceptionSchema(BaseModel):
    article_ref: str
    designation: str
    numero_lot: str
    quantite: int
    unite: str = "piece"
    emplacement: str = ""
    modele: str = "ZT410"

class EtiquetteExpeditionSchema(BaseModel):
    article_ref: str
    designation: str
    numero_lot: str
    quantite: int
    unite: str = "piece"
    emplacement: str = ""
    client_nom: str = ""
    client_adresse: str = ""
    client_cp: str = ""
    client_ville: str = ""
    numero_cmd: str = ""
    modele: str = "ZT410"

def zpl_reception_ZT410(data: EtiquetteReceptionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:35]
    return f"""^XA
^MMT
^PW812
^LL0609
^LS0
^FO20,20^GB772,3,3^FS
^FO20,30^FDLogiTrack Pro^FS^CF0,40
^FO20,30^FDLogiTrack Pro^FS
^CF0,40^FO20,30^FDLogiTrack Pro^FS
^CFA,40^FO20,30^FDLogiTrack Pro^FS
^FO20,20
^FX -- En-tete --
^CF0,45^FO20,30^FDLogiTrack Pro - WMS^FS
^FO20,80^GB772,3,3^FS
^FX -- Code-barres SSCC GS1-128 --
^FO20,90^BY3^BCN,100,Y,N,N^FD>:00{sscc}^FS
^FX -- Infos article --
^CF0,35^FO20,210^FDRef : {data.article_ref}^FS
^CF0,30^FO20,255^FDLib : {designation}^FS
^CF0,35^FO20,295^FDLot : {data.numero_lot}^FS
^CF0,35^FO400,295^FDQte : {data.quantite} {data.unite}^FS
^CF0,35^FO20,340^FDEmp : {data.emplacement or 'A DEFINIR'}^FS
^CF0,30^FO20,385^FDDate: {date_str}^FS
^FO20,420^GB772,3,3^FS
^CF0,25^FO20,430^FDSSCC: (00){sscc}^FS
^FO20,470^GB772,3,3^FS
^PQ1,0,1,Y
^XZ"""

def zpl_reception_ZD420(data: EtiquetteReceptionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:30]
    return f"""^XA
^MMT
^PW609
^LL0406
^LS0
^CF0,35^FO15,15^FDLogiTrack Pro^FS
^FO15,55^GB579,2,2^FS
^FO15,65^BY2^BCN,80,Y,N,N^FD>:00{sscc}^FS
^CF0,28^FO15,160^FDRef : {data.article_ref}^FS
^CF0,25^FO15,195^FDLib : {designation}^FS
^CF0,28^FO15,228^FDLot : {data.numero_lot}^FS
^CF0,28^FO320,228^FDQte: {data.quantite}^FS
^CF0,28^FO15,265^FDEmp : {data.emplacement or 'A DEFINIR'}^FS
^CF0,25^FO15,300^FDDate: {date_str}^FS
^FO15,330^GB579,2,2^FS
^CF0,20^FO15,338^FDSSCC:(00){sscc}^FS
^PQ1,0,1,Y
^XZ"""

def zpl_reception_GK420(data: EtiquetteReceptionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:28]
    return f"""^XA
^MMT
^PW609
^LL0406
^LS0
^CF0,30^FO10,10^FDLogiTrack Pro^FS
^FO10,45^GB589,2,2^FS
^FO10,52^BY2^BCN,75,Y,N,N^FD>:00{sscc}^FS
^CF0,25^FO10,142^FD{data.article_ref} - {designation}^FS
^CF0,25^FO10,175^FDLot:{data.numero_lot} Qte:{data.quantite} {data.unite}^FS
^CF0,25^FO10,208^FDEmp:{data.emplacement or 'A DEFINIR'} Date:{date_str}^FS
^FO10,240^GB589,2,2^FS
^CF0,18^FO10,248^FD(00){sscc}^FS
^PQ1,0,1,Y
^XZ"""

def zpl_expedition_ZT410(data: EtiquetteExpeditionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:35]
    return f"""^XA
^MMT
^PW812
^LL0812
^LS0
^CF0,45^FO20,20^FDLogiTrack Pro - WMS^FS
^FO20,70^GB772,3,3^FS
^FX -- Destinataire --
^CF0,30^FO20,80^FDDESTINATAIRE :^FS
^CF0,40^FO20,115^FD{data.client_nom}^FS
^CF0,30^FO20,165^FD{data.client_adresse}^FS
^CF0,30^FO20,200^FD{data.client_cp} {data.client_ville}^FS
^FO20,240^GB772,3,3^FS
^FX -- Code-barres SSCC --
^FO20,250^BY3^BCN,100,Y,N,N^FD>:00{sscc}^FS
^FX -- Infos article --
^CF0,35^FO20,370^FDRef : {data.article_ref}^FS
^CF0,30^FO20,415^FDLib : {designation}^FS
^CF0,35^FO20,455^FDLot : {data.numero_lot}^FS
^CF0,35^FO420,455^FDQte : {data.quantite} {data.unite}^FS
^CF0,35^FO20,500^FDCMD : {data.numero_cmd}^FS
^CF0,30^FO20,545^FDDate: {date_str}^FS
^FO20,580^GB772,3,3^FS
^CF0,25^FO20,590^FDSSCC: (00){sscc}^FS
^FO20,625^GB772,3,3^FS
^PQ1,0,1,Y
^XZ"""

def zpl_expedition_ZD420(data: EtiquetteExpeditionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:28]
    return f"""^XA
^MMT
^PW609
^LL0609
^LS0
^CF0,30^FO15,10^FDLogiTrack Pro^FS
^FO15,45^GB579,2,2^FS
^CF0,25^FO15,55^FDDESTINATAIRE :^FS
^CF0,32^FO15,82^FD{data.client_nom}^FS
^CF0,25^FO15,120^FD{data.client_adresse}^FS
^CF0,25^FO15,150^FD{data.client_cp} {data.client_ville}^FS
^FO15,182^GB579,2,2^FS
^FO15,192^BY2^BCN,75,Y,N,N^FD>:00{sscc}^FS
^CF0,25^FO15,282^FDRef:{data.article_ref}^FS
^CF0,22^FO15,312^FDLib:{designation}^FS
^CF0,25^FO15,340^FDLot:{data.numero_lot}^FS
^CF0,25^FO330,340^FDQte:{data.quantite}^FS
^CF0,25^FO15,370^FDCMD:{data.numero_cmd} {date_str}^FS
^FO15,400^GB579,2,2^FS
^CF0,18^FO15,408^FD(00){sscc}^FS
^PQ1,0,1,Y
^XZ"""

def zpl_expedition_GK420(data: EtiquetteExpeditionSchema, sscc: str) -> str:
    date_str = datetime.now().strftime('%d/%m/%Y')
    designation = data.designation[:25]
    return f"""^XA
^MMT
^PW609
^LL0609
^LS0
^CF0,28^FO10,10^FDLogiTrack Pro^FS
^FO10,42^GB589,2,2^FS
^CF0,22^FO10,50^FD{data.client_nom}^FS
^CF0,20^FO10,78^FD{data.client_adresse} {data.client_cp} {data.client_ville}^FS
^FO10,105^GB589,2,2^FS
^FO10,112^BY2^BCN,70,Y,N,N^FD>:00{sscc}^FS
^CF0,22^FO10,197^FD{data.article_ref} - {designation}^FS
^CF0,22^FO10,225^FDLot:{data.numero_lot} Qte:{data.quantite}^FS
^CF0,22^FO10,253^FDCMD:{data.numero_cmd} {date_str}^FS
^FO10,282^GB589,2,2^FS
^CF0,18^FO10,290^FD(00){sscc}^FS
^PQ1,0,1,Y
^XZ"""

@router.post("/reception", response_class=PlainTextResponse)
async def generer_etiquette_reception(data: EtiquetteReceptionSchema):
    sscc = generer_sscc()
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        await conn.execute("""
            UPDATE logitrack.lots SET sscc = $1
            WHERE numero_lot = $2 AND (sscc IS NULL OR sscc = '')
        """, sscc, data.numero_lot)
    except Exception:
        pass
    finally:
        await conn.close()

    if data.modele == "ZD420":
        zpl = zpl_reception_ZD420(data, sscc)
    elif data.modele == "GK420":
        zpl = zpl_reception_GK420(data, sscc)
    else:
        zpl = zpl_reception_ZT410(data, sscc)

    return PlainTextResponse(content=zpl, media_type="text/plain")

@router.post("/expedition", response_class=PlainTextResponse)
async def generer_etiquette_expedition(data: EtiquetteExpeditionSchema):
    sscc = generer_sscc()

    if data.modele == "ZD420":
        zpl = zpl_expedition_ZD420(data, sscc)
    elif data.modele == "GK420":
        zpl = zpl_expedition_GK420(data, sscc)
    else:
        zpl = zpl_expedition_ZT410(data, sscc)

    return PlainTextResponse(content=zpl, media_type="text/plain")

@router.get("/preview/{type_etiquette}")
async def preview_etiquette(type_etiquette: str, modele: str = "ZT410"):
    data_reception = EtiquetteReceptionSchema(
        article_ref="ART-0055",
        designation="Cable USB-C 2m",
        numero_lot="LOT-20260606-01",
        quantite=480,
        unite="piece",
        emplacement="A-01-00",
        modele=modele
    )
    data_expedition = EtiquetteExpeditionSchema(
        article_ref="ART-0055",
        designation="Cable USB-C 2m",
        numero_lot="LOT-20260606-01",
        quantite=50,
        unite="piece",
        emplacement="A-01-00",
        client_nom="Aubert SA",
        client_adresse="12 rue du Commerce",
        client_cp="69001",
        client_ville="Lyon",
        numero_cmd="CMD-20260606-81",
        modele=modele
    )
    sscc = generer_sscc()
    if type_etiquette == "expedition":
        if modele == "ZD420":
            return PlainTextResponse(zpl_expedition_ZD420(data_expedition, sscc))
        elif modele == "GK420":
            return PlainTextResponse(zpl_expedition_GK420(data_expedition, sscc))
        return PlainTextResponse(zpl_expedition_ZT410(data_expedition, sscc))
    else:
        if modele == "ZD420":
            return PlainTextResponse(zpl_reception_ZD420(data_reception, sscc))
        elif modele == "GK420":
            return PlainTextResponse(zpl_reception_GK420(data_reception, sscc))
        return PlainTextResponse(zpl_reception_ZT410(data_reception, sscc))
