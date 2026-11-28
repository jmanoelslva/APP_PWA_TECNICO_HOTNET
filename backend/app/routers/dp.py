import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..audit import registrar_auditoria
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/dp", tags=["dp"])


@router.get("/lista")
async def listar_dps(ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # CTOs (Distribution Points) cadastradas no sistema, para selecionar na
    # tela de detalhes do CPE (campo dp_pk) — só as ativas (dp_status=1).
    #
    # NÃO usa model_return=True aqui: Response.cast() faz
    # `[DP.model_validate(r) for r in results]` numa lista só — se UMA
    # CTO qualquer não tiver dp_lat/dp_lng/dp_limit (campos obrigatórios
    # no modelo DP, mas nem toda CTO cadastrada tem coordenada), a
    # validação de TODA a lista falha e a lista inteira vem vazia para o
    # técnico, sem erro visível (o front só ignora a falha do combo).
    # Como só precisamos de pk/nome (+ coordenada, quando existir), pega o
    # dado cru e não passa pelo modelo rígido.
    #
    # cor/limite/ativos/setor alimentam o mapa do bloco CTO (mesmos campos
    # que o "Mapa - Informações" do painel mostra com Distribuição: Sim).
    resposta = await ctx.controllr.dp_list(
        corpo(where_eq("dp_status", 1), limit=2000, sort="dp_name", dir="ASC")
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as CTOs.", resposta))
    resultado = [
        {
            "pk": dp.get("dp_pk"),
            "name": dp.get("dp_name") or dp.get("dp_id") or f"CTO {dp.get('dp_pk')}",
            "lat": _coordenada(dp.get("dp_lat")),
            "lng": _coordenada(dp.get("dp_lng")),
            "cor": dp.get("dp_color") or None,
            "limite": _inteiro(dp.get("dp_limit")),
            "ativos": _inteiro(dp.get("total_cpe_active")),
            "setor": dp.get("ds_name") or None,
            "setor_pk": _inteiro(dp.get("ds_pk")),
        }
        for dp in resposta.results
        if dp.get("dp_pk") is not None
    ]
    return {"success": True, "results": resultado}


def _coordenada(valor: Any) -> float | None:
    # dp_lat/dp_lng nem sempre existem (CTO sem coordenada cadastrada) —
    # devolve None nesse caso em vez de deixar o handler quebrar.
    # O painel trata "0"/"0" como "sem coordenada" (app_map_view.js).
    try:
        numero = float(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None
    return numero if numero else None


def _inteiro(valor: Any) -> int | None:
    try:
        return int(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------ edição e cadastro
#
# A permissão é do Controllr (ACL do técnico, liberada sob demanda pelo
# provedor): sem ela o dp/update e o dp/create devolvem 403 "Access Denied",
# repassado como 403 com mensagem clara (mesmo jeito do financeiro).

# Padrão de nome da CTO nova, próprio de cada provedor (lido no cadastro
# real do Controllr). {sigla} vem do setor: SIGLAS_SETOR pelo nome exato ou,
# senão, o fim do nome "FTTH-VSJ" → "VSJ". Setor sem sigla não aparece.
FORMATO_NOME_CTO = "{sigla}-CTO-{hub}.{numero}"  # VSJ-CTO-1.3
SIGLAS_SETOR: dict[str, str] = {}
# Preencher dp_id/dp_code/dp_num (VSJ-H01-03 / VSJ-H01 / 3) como no cadastro.
PREENCHER_IDS_CTO = True

# As 12 cores de fibra (código de cores ABNT, 12 fibras por tubo), no hex
# que a paleta do painel do Controllr usa.
CORES_ABNT: dict[str, str] = {
    "#00FF00": "Verde",
    "#FFFF00": "Amarelo",
    "#FFFFFF": "Branco",
    "#0000FF": "Azul",
    "#FF0000": "Vermelho",
    "#AA00FF": "Violeta",
    "#AA5500": "Marrom",
    "#FF55FF": "Rosa",
    "#000000": "Preto",
    "#808080": "Cinza",
    "#FF8000": "Laranja",
    "#00FFFF": "Aqua",
}

# Capacidades usadas na rede (dp_limit). Fora disso, recusa.
CAPACIDADES = {8, 16}

# Campos do formulário da CTO no painel: o dp/update grava o formulário
# inteiro, então toda edição relê o registro e reenvia tudo, trocando só o
# que mudou (senão o que faltar fica vazio).
CAMPOS_FORMULARIO = (
    "dp_pk", "dp_status", "dp_type", "dp_color", "dp_limit", "dp_name", "dp_desc",
    "dp_id", "dp_code", "dp_num", "dp_lat", "dp_lng", "ds_pk",
)

DP_TIPO_FTTH = 4


def _cor_valida(cor: str | None) -> str | None:
    if cor is None:
        return None
    hexa = cor.strip().upper()
    if hexa not in CORES_ABNT:
        raise HTTPException(status_code=400, detail="Escolha uma das 12 cores padrão de fibra.")
    return hexa


def _capacidade_valida(limite: int | None) -> int | None:
    if limite is not None and limite not in CAPACIDADES:
        raise HTTPException(status_code=400, detail="Capacidade deve ser 8 ou 16 portas.")
    return limite


def _sem_permissao(resposta: Any) -> bool:
    texto = str(getattr(resposta, "errors", "") or "").lower()
    return getattr(resposta, "status", None) == 403 or "access denied" in texto


SEM_ACL = "Seu usuário não tem liberação no Controllr para cadastrar ou editar CTO. Peça ao escritório."


class EdicaoDp(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    # Precisão do GPS na hora de gravar a posição (só vai para a auditoria).
    precisao_m: float | None = Field(default=None, ge=0, le=100_000)
    cor: str | None = Field(default=None, max_length=9)
    limite: int | None = None


class NovaDp(BaseModel):
    setor_pk: int
    hub: int = Field(ge=1, le=99)
    numero: int = Field(ge=1, le=99)
    limite: int
    cor: str = Field(max_length=9)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    precisao_m: float | None = Field(default=None, ge=0, le=100_000)


@router.get("/setores")
async def listar_setores(ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    """Setores de distribuição (ds) ativos, para o cadastro de CTO nova."""
    resposta = await ctx.controllr.call_api_post("/controllrctl/ds/list", corpo(where_eq("ds_status", 1), limit=200, sort="ds_name", dir="ASC"))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar os setores.", resposta))
    return {
        "success": True,
        "results": [
            {"pk": d.get("ds_pk"), "nome": d.get("ds_name") or f"Setor {d.get('ds_pk')}", "sigla": sigla_do_setor(d.get("ds_name"))}
            for d in resposta.results
            if d.get("ds_pk") is not None
        ],
        "cores": [{"hex": h, "nome": n} for h, n in CORES_ABNT.items()],
        "capacidades": sorted(CAPACIDADES),
        # Para o app mostrar o nome antes de cadastrar.
        "formato_nome": FORMATO_NOME_CTO,
    }


def sigla_do_setor(nome: Any) -> str | None:
    """"FTTH-VSJ" → "VSJ" (ou a de SIGLAS_SETOR); None sem padrão."""
    if not nome:
        return None
    if str(nome).strip() in SIGLAS_SETOR:
        return SIGLAS_SETOR[str(nome).strip()]
    parte = str(nome).strip().split("-")[-1].strip().upper()
    return parte if re.fullmatch(r"[A-Z0-9]{2,6}", parte) else None


def nomes_da_cto(sigla: str, hub: int, numero: int) -> dict[str, str]:
    """Campos de nome no padrão do provedor (FORMATO_NOME_CTO, PREENCHER_IDS_CTO)."""
    nomes = {"dp_name": FORMATO_NOME_CTO.format(sigla=sigla, hub=hub, numero=numero)}
    if PREENCHER_IDS_CTO:
        nomes.update({"dp_id": f"{sigla}-H{hub:02d}-{numero:02d}", "dp_code": f"{sigla}-H{hub:02d}", "dp_num": str(numero)})
    else:
        nomes.update({"dp_id": "", "dp_code": "", "dp_num": ""})
    return nomes


async def _registro_cru(ctx: AuthContext, dp_pk: int) -> dict[str, Any]:
    resposta = await ctx.controllr.dp_list(corpo(where_eq("dp_pk", dp_pk), limit=1))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível ler a CTO.", resposta))
    for registro in resposta.results:
        if _inteiro(registro.get("dp_pk")) == dp_pk:
            return registro
    raise HTTPException(status_code=404, detail="CTO não encontrada.")


@router.post("/{dp_pk}/editar")
async def editar_dp(
    dp_pk: int, payload: EdicaoDp, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    """Posição (GPS do técnico), cor (12 cores ABNT) e capacidade da CTO."""
    if (payload.lat is None) != (payload.lng is None):
        raise HTTPException(status_code=400, detail="Informe latitude e longitude juntas.")
    cor = _cor_valida(payload.cor)
    limite = _capacidade_valida(payload.limite)
    if payload.lat is None and cor is None and limite is None:
        raise HTTPException(status_code=400, detail="Nada para alterar.")

    atual = await _registro_cru(ctx, dp_pk)
    formulario = {campo: ("" if atual.get(campo) is None else atual.get(campo)) for campo in CAMPOS_FORMULARIO}
    alvo: dict[str, Any] = {"dp_pk": dp_pk, "cto": atual.get("dp_name")}
    alteracoes: list[dict[str, Any]] = []
    if payload.lat is not None:
        formulario["dp_lat"] = f"{payload.lat:.8f}"
        formulario["dp_lng"] = f"{payload.lng:.8f}"
        anterior = f"{atual.get('dp_lat')}, {atual.get('dp_lng')}" if _coordenada(atual.get("dp_lat")) else None
        precisao = f" (±{round(payload.precisao_m)} m)" if payload.precisao_m is not None else ""
        alteracoes.append({"rotulo": "Posição", "antes": anterior, "depois": f"{payload.lat:.6f}, {payload.lng:.6f}{precisao}"})
    if cor is not None:
        anterior = str(atual.get("dp_color") or "").upper() or None
        formulario["dp_color"] = cor
        alteracoes.append({"rotulo": "Cor", "antes": CORES_ABNT.get(anterior or "", anterior), "depois": CORES_ABNT[cor]})
    if limite is not None:
        formulario["dp_limit"] = limite
        alteracoes.append({"rotulo": "Capacidade", "antes": atual.get("dp_limit"), "depois": f"{limite} portas"})

    resposta = await ctx.controllr.dp_update(corpo(None, **formulario))
    if _sem_permissao(resposta):
        raise HTTPException(status_code=403, detail=SEM_ACL)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível salvar a CTO.", resposta))
    alvo["alteracoes"] = alteracoes
    registrar_auditoria(request, ctx.session, "cto.editar", alvo)
    return {"success": True}


@router.post("/criar")
async def criar_dp(payload: NovaDp, request: Request, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    """CTO nova (FTTH, ativa) na posição do técnico, com o nome no padrão do setor."""
    cor = _cor_valida(payload.cor)
    limite = _capacidade_valida(payload.limite)
    setores = (await listar_setores(ctx))["results"]
    setor = next((s for s in setores if s["pk"] == payload.setor_pk), None)
    if not setor:
        raise HTTPException(status_code=400, detail="Setor não encontrado.")
    if not setor["sigla"]:
        raise HTTPException(status_code=400, detail=f"O setor {setor['nome']} não tem sigla no nome (ex.: FTTH-VSJ).")
    nomes = nomes_da_cto(setor["sigla"], payload.hub, payload.numero)

    # Nome repetido (inclusive CTO desativada) não entra.
    existentes = await ctx.controllr.dp_list(corpo(where_eq("dp_name", nomes["dp_name"]), limit=5))
    if existentes.success and any(str(r.get("dp_name") or "").upper() == nomes["dp_name"] for r in existentes.results):
        raise HTTPException(status_code=409, detail=f"Já existe a {nomes['dp_name']}.")

    formulario = {
        "dp_pk": 0,
        "dp_status": 1,
        "dp_type": DP_TIPO_FTTH,
        "dp_color": cor,
        "dp_limit": limite,
        "dp_desc": "*",
        "dp_lat": f"{payload.lat:.8f}",
        "dp_lng": f"{payload.lng:.8f}",
        "ds_pk": payload.setor_pk,
        **nomes,
    }
    resposta = await ctx.controllr.dp_create(corpo(None, **formulario))
    if _sem_permissao(resposta):
        raise HTTPException(status_code=403, detail=SEM_ACL)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível cadastrar a CTO.", resposta))
    precisao = f" (±{round(payload.precisao_m)} m)" if payload.precisao_m is not None else ""
    registrar_auditoria(request, ctx.session, "cto.criar", {
        "cto": nomes["dp_name"],
        "alteracoes": [
            {"rotulo": "Setor", "depois": setor["nome"]},
            {"rotulo": "Capacidade", "depois": f"{limite} portas"},
            {"rotulo": "Cor", "depois": CORES_ABNT[cor]},
            {"rotulo": "Posição", "depois": f"{payload.lat:.6f}, {payload.lng:.6f}{precisao}"},
        ],
    })
    return {"success": True, "nome": nomes["dp_name"]}
