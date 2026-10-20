"""
Projeto da rede (KMZ/KML do Google Earth) para o mapa do bloco CTO.

O arquivo fica no servidor (MAPA_PROJETO_PATH em config.py), trocado à mão
quando o projeto muda. É lido uma vez e guardado em memória até a data de
modificação mudar. O app só pede o pedaço em volta da CTO (lat/lng/raio),
para não mandar o projeto inteiro ao celular a cada consulta.

Só o necessário para desenhar: pontos, linhas e polígonos (borda externa),
com nome, pasta e cor. Ícones, descrições HTML, NetworkLink e GroundOverlay
são ignorados.
"""

import io
import math
import os
import zipfile
from typing import Any
from xml.etree import ElementTree

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config
from ..deps import get_current_session
from ..sessions import TechnicianSession

router = APIRouter(prefix="/mapa", tags=["mapa"])

_KML = "{http://www.opengis.net/kml/2.2}"
_cache: dict[str, Any] = {"chave": None, "itens": []}


@router.get("/projeto")
async def projeto(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    raio: int = Query(default=1500, ge=50, le=10000),
    _sessao: TechnicianSession = Depends(get_current_session),
) -> dict[str, Any]:
    caminho = config.MAPA_PROJETO_PATH
    if not caminho or not os.path.isfile(caminho):
        raise HTTPException(status_code=404, detail="Projeto da rede não configurado neste servidor.")
    try:
        itens = _itens_do_projeto(caminho)
    except (OSError, zipfile.BadZipFile, ElementTree.ParseError, ValueError):
        raise HTTPException(status_code=500, detail="Não foi possível ler o projeto da rede.")
    return {"success": True, "results": filtrar_por_raio(itens, lat, lng, raio)}


def _itens_do_projeto(caminho: str) -> list[dict[str, Any]]:
    chave = (caminho, os.path.getmtime(caminho))
    if _cache["chave"] != chave:
        with open(caminho, "rb") as arquivo:
            _cache["itens"] = ler_projeto(arquivo.read())
        _cache["chave"] = chave
    return _cache["itens"]


def ler_projeto(conteudo: bytes) -> list[dict[str, Any]]:
    """KMZ (zip com um .kml dentro) ou KML puro."""
    if conteudo[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(conteudo)) as kmz:
            nomes = [n for n in kmz.namelist() if n.lower().endswith(".kml")]
            if not nomes:
                raise ValueError("KMZ sem arquivo .kml")
            # doc.kml é o principal por convenção; senão, o primeiro.
            principal = next((n for n in nomes if n.lower().endswith("doc.kml")), nomes[0])
            conteudo = kmz.read(principal)
    return ler_kml(conteudo)


def ler_kml(conteudo: bytes) -> list[dict[str, Any]]:
    raiz = ElementTree.fromstring(conteudo)
    # Alguns exportadores não usam namespace — tira de todas as tags.
    for elemento in raiz.iter():
        if isinstance(elemento.tag, str) and elemento.tag.startswith(_KML):
            elemento.tag = elemento.tag[len(_KML):]
    cores = _cores_dos_estilos(raiz)
    itens: list[dict[str, Any]] = []
    _percorrer(raiz, "", cores, itens)
    return itens


def _cores_dos_estilos(raiz: ElementTree.Element) -> dict[str, str]:
    cores: dict[str, str] = {}
    for estilo in raiz.iter("Style"):
        cor = _cor_do_estilo(estilo)
        if estilo.get("id") and cor:
            cores[estilo.get("id", "")] = cor
    # StyleMap: usa o estilo "normal" (o "highlight" é só ao passar o mouse).
    for mapa in raiz.iter("StyleMap"):
        for par in mapa.iter("Pair"):
            if (par.findtext("key") or "").strip() == "normal":
                alvo = (par.findtext("styleUrl") or "").strip().lstrip("#")
                if mapa.get("id") and alvo in cores:
                    cores[mapa.get("id", "")] = cores[alvo]
    return cores


def _cor_do_estilo(estilo: ElementTree.Element) -> str | None:
    for caminho in ("LineStyle/color", "PolyStyle/color", "IconStyle/color"):
        cor = cor_kml(estilo.findtext(caminho))
        if cor:
            return cor
    return None


def cor_kml(valor: str | None) -> str | None:
    """KML guarda a cor como aabbggrr; o navegador quer #rrggbb."""
    texto = (valor or "").strip().lstrip("#")
    if len(texto) != 8:
        return None
    try:
        int(texto, 16)
    except ValueError:
        return None
    return f"#{texto[6:8]}{texto[4:6]}{texto[2:4]}".lower()


def _percorrer(elemento: ElementTree.Element, pasta: str, cores: dict[str, str], itens: list[dict[str, Any]]) -> None:
    for filho in elemento:
        if filho.tag in ("Document", "Folder"):
            nome = (filho.findtext("name") or "").strip()
            _percorrer(filho, nome or pasta, cores, itens)
        elif filho.tag == "Placemark":
            itens.extend(_itens_do_placemark(filho, pasta, cores))


def _itens_do_placemark(placemark: ElementTree.Element, pasta: str, cores: dict[str, str]) -> list[dict[str, Any]]:
    nome = (placemark.findtext("name") or "").strip()
    estilo = placemark.find("Style")
    cor = _cor_do_estilo(estilo) if estilo is not None else None
    if not cor:
        cor = cores.get((placemark.findtext("styleUrl") or "").strip().lstrip("#"))
    base = {"nome": nome, "pasta": pasta, "cor": cor}
    itens = []
    for geometria in placemark.iter():
        if geometria.tag == "Point":
            coords = coordenadas(geometria.findtext("coordinates"))
            if coords:
                itens.append({**base, "tipo": "ponto", "coords": coords[:1]})
        elif geometria.tag == "LineString":
            coords = coordenadas(geometria.findtext("coordinates"))
            if len(coords) >= 2:
                itens.append({**base, "tipo": "linha", "coords": coords})
        elif geometria.tag == "Polygon":
            coords = coordenadas(geometria.findtext("outerBoundaryIs/LinearRing/coordinates"))
            if len(coords) >= 3:
                itens.append({**base, "tipo": "poligono", "coords": coords})
    return itens


def coordenadas(texto: str | None) -> list[list[float]]:
    """ "lng,lat[,alt] lng,lat[,alt] ..." do KML -> [[lat, lng], ...]."""
    pontos = []
    for trecho in (texto or "").split():
        partes = trecho.split(",")
        if len(partes) < 2:
            continue
        try:
            lng, lat = float(partes[0]), float(partes[1])
        except ValueError:
            continue
        pontos.append([round(lat, 7), round(lng, 7)])
    return pontos


def filtrar_por_raio(itens: list[dict[str, Any]], lat: float, lng: float, raio_m: int) -> list[dict[str, Any]]:
    """
    Itens cujo retângulo envolvente cruza o quadrado de lado 2*raio em volta
    de lat/lng — pega também o cabo longo que só passa pela área, sem
    nenhum vértice dentro dela.
    """
    dlat = raio_m / 111_320
    dlng = raio_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    resultado = []
    for item in itens:
        lats = [p[0] for p in item["coords"]]
        lngs = [p[1] for p in item["coords"]]
        if min(lats) <= lat + dlat and max(lats) >= lat - dlat and min(lngs) <= lng + dlng and max(lngs) >= lng - dlng:
            resultado.append(item)
    return resultado
