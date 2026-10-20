"""Projeto da rede (KMZ/KML) do mapa do bloco CTO."""

import io
import zipfile

from fastapi.testclient import TestClient

from app import config
from app.deps import get_current_session
from app.main import app
from app.routers import mapa

KML = b"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Style id="azul"><LineStyle><color>ffff0000</color></LineStyle></Style>
  <Style id="verm"><IconStyle><color>ff0000ff</color></IconStyle></Style>
  <StyleMap id="cabo"><Pair><key>normal</key><styleUrl>#azul</styleUrl></Pair>
    <Pair><key>highlight</key><styleUrl>#verm</styleUrl></Pair></StyleMap>
  <Folder><name>Cabos</name>
    <Placemark><name>Cabo 12F</name><styleUrl>#cabo</styleUrl>
      <LineString><coordinates>-36.60,-9.66,0 -36.61,-9.67,0</coordinates></LineString></Placemark>
  </Folder>
  <Folder><name>CTOs</name>
    <Placemark><name>CTO-1</name><styleUrl>#verm</styleUrl>
      <Point><coordinates>-36.6001,-9.6601,0</coordinates></Point></Placemark>
    <Placemark><name>Longe</name><Point><coordinates>-35.0,-8.0</coordinates></Point></Placemark>
  </Folder>
</Document></kml>"""


def kmz(conteudo: bytes = KML) -> bytes:
    saida = io.BytesIO()
    with zipfile.ZipFile(saida, "w") as arquivo:
        arquivo.writestr("doc.kml", conteudo)
    return saida.getvalue()


def test_cor_kml_aabbggrr_para_rrggbb():
    assert mapa.cor_kml("ff0000ff") == "#ff0000"
    assert mapa.cor_kml("80ff8800") == "#0088ff"
    assert mapa.cor_kml("xyz") is None


def test_le_kmz_com_pasta_e_cor_do_stylemap():
    itens = mapa.ler_projeto(kmz())
    cabo = next(i for i in itens if i["nome"] == "Cabo 12F")
    assert cabo["tipo"] == "linha"
    assert cabo["pasta"] == "Cabos"
    assert cabo["cor"] == "#0000ff"
    assert cabo["coords"][0] == [-9.66, -36.6]
    cto = next(i for i in itens if i["nome"] == "CTO-1")
    assert cto["tipo"] == "ponto"
    assert cto["cor"] == "#ff0000"


def test_kml_sem_namespace_e_kml_puro():
    itens = mapa.ler_projeto(KML.replace(b' xmlns="http://www.opengis.net/kml/2.2"', b""))
    assert {i["nome"] for i in itens} == {"Cabo 12F", "CTO-1", "Longe"}


def test_filtra_pelo_raio_inclusive_cabo_que_so_atravessa():
    itens = mapa.ler_projeto(kmz())
    perto = {i["nome"] for i in mapa.filtrar_por_raio(itens, -9.6601, -36.6001, 300)}
    assert perto == {"Cabo 12F", "CTO-1"}
    # Meio do cabo, sem nenhum vértice a menos de 300 m.
    meio = {i["nome"] for i in mapa.filtrar_por_raio(itens, -9.665, -36.605, 100)}
    assert "Cabo 12F" in meio


def test_rota_sem_arquivo_responde_404(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MAPA_PROJETO_PATH", str(tmp_path / "nao-existe.kmz"))
    app.dependency_overrides[get_current_session] = lambda: object()
    try:
        resposta = TestClient(app).get("/mapa/projeto", params={"lat": -9.66, "lng": -36.6})
    finally:
        app.dependency_overrides.clear()
    assert resposta.status_code == 404


def test_rota_devolve_so_o_entorno(tmp_path, monkeypatch):
    arquivo = tmp_path / "projeto.kmz"
    arquivo.write_bytes(kmz())
    monkeypatch.setattr(config, "MAPA_PROJETO_PATH", str(arquivo))
    app.dependency_overrides[get_current_session] = lambda: object()
    try:
        resposta = TestClient(app).get("/mapa/projeto", params={"lat": -9.6601, "lng": -36.6001, "raio": 300})
    finally:
        app.dependency_overrides.clear()
    assert resposta.status_code == 200
    assert {i["nome"] for i in resposta.json()["results"]} == {"Cabo 12F", "CTO-1"}
