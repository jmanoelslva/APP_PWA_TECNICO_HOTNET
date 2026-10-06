"""
Ticket / Suporte Técnico — o CASO/chamado aberto pelo cliente (título,
descrição, categoria, chat). Diferente de Ordem de Serviço (ver
ordens_servico.py): um ticket pode ter uma ou mais OS vinculadas
(trabalho de campo agendado), mas o ticket em si nunca é "fechado" pelo
técnico neste app — quem se fecha é a OS (support_ctl/os/close).
"""

import logging
from typing import Any
from urllib.parse import quote, urlencode

import aiohttp
from aiohttp import FormData
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response as FastAPIResponse
from pydantic import BaseModel

from ..config import ANEXO_MAX_MB, CONTROLLR_URL
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo as montar_corpo
from ..where import where_eq, where_in

router = APIRouter(prefix="/suporte", tags=["suporte"])
logger = logging.getLogger(__name__)


@router.get("/tickets")
async def listar_tickets(
    minhas: bool = Query(default=True),
    client_pk: int | None = Query(default=None, description="Filtra pelos chamados de um cliente específico"),
    start: int = Query(default=0),
    limit: int = Query(default=20),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    where = None
    if client_pk is not None:
        # Usado pela tela de detalhe do cliente, para mostrar o histórico
        # de chamados junto com cadastro/contratos/endereços. "ticket.
        # client_pk" (com prefixo) — ticket_list traz campos via join
        # (client_complete_name, category_name etc.), o que torna
        # "client_pk" sozinho ambíguo.
        where = where_eq("ticket.client_pk", client_pk)
    elif minhas and ctx.session.user_pk is not None:
        # oper 21 = IN — necessário porque o valor é uma lista de um item,
        # não um escalar (oper 5 = "="). Se user_pk ainda não foi
        # resolvido (ver auth.py::_find_user_pk), cai para "todos" em vez
        # de mostrar uma lista vazia enganosa.
        where = where_in("user_pk", [ctx.session.user_pk])

    resposta = await ctx.controllr.ticket_list(montar_corpo(where, action="list", start=start, limit=limit))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar os chamados.", resposta))
    return {"success": True, "results": resposta.results, "total": resposta.total}


@router.get("/tickets/{ticket_pk}")
async def detalhe_ticket(ticket_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    resposta = await ctx.controllr.ticket_list(montar_corpo(where_eq("ticket_pk", ticket_pk), limit=1))
    if not resposta.success or not resposta.results:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")
    return {"success": True, "ticket": resposta.results[0]}


@router.get("/tickets/{ticket_pk}/mensagens")
async def listar_mensagens_ticket(ticket_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # support_ctl/op/list não tem wrapper no brbyteapi (só op/create).
    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/op/list", montar_corpo(where_eq("ticket_pk", ticket_pk))
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as mensagens do chamado.", resposta))
    return {"success": True, "results": resposta.results}


class MensagemPayload(BaseModel):
    op_desc: str


@router.post("/tickets/{ticket_pk}/mensagens")
async def criar_mensagem_ticket(
    ticket_pk: int, payload: MensagemPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo = urlencode({"ticket_pk": ticket_pk, "op_type": 0, "op_code": 0, "op_desc": payload.op_desc})
    resposta = await ctx.controllr.support_op_create(corpo)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível enviar a mensagem.", resposta))
    return {"success": True, "results": resposta.results}


async def _ler_anexo(file: UploadFile) -> bytes:
    """Lê o anexo em pedaços e recusa (413) o que passar de ANEXO_MAX_MB."""
    limite = ANEXO_MAX_MB * 1024 * 1024
    partes: list[bytes] = []
    total = 0
    while pedaco := await file.read(1024 * 1024):
        total += len(pedaco)
        if total > limite:
            raise HTTPException(status_code=413, detail=f"Anexo maior que {ANEXO_MAX_MB} MB.")
        partes.append(pedaco)
    return b"".join(partes)


@router.post("/tickets/{ticket_pk}/anexos")
async def enviar_anexo_ticket(
    ticket_pk: int, file: UploadFile, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    conteudo = await _ler_anexo(file)
    form = FormData()
    form.add_field("file", conteudo, filename=file.filename, content_type=file.content_type)
    form.add_field("ticket_pk", str(ticket_pk))

    resposta = await ctx.controllr.support_annex_upload(form)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível enviar o anexo.", resposta))
    return {"success": True, "results": resposta.results}


# Anexo é arquivo enviado por qualquer um (técnico, escritório, cliente) e é
# servido no MESMO domínio do app: um .html ou .svg aberto aqui rodaria
# script com a sessão de quem clicou. Só abre na tela o que não executa nada
# (imagem que não seja SVG, vídeo, áudio, PDF); o resto vai como download.
def _abre_na_tela(tipo: str) -> bool:
    if tipo.startswith("image/"):
        return not tipo.startswith("image/svg")
    return tipo.startswith(("video/", "audio/")) or tipo == "application/pdf"


def _tipo_pela_assinatura(inicio: bytes) -> str | None:
    """
    O Controllr às vezes manda a foto sem o tipo certo (octet-stream): confere
    pelos primeiros bytes se é mesmo imagem/vídeo/PDF. HTML, SVG e HEIC não.
    """
    if inicio.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if inicio.startswith(b"\x89PNG"):
        return "image/png"
    if inicio.startswith(b"GIF8"):
        return "image/gif"
    if inicio[:4] == b"RIFF" and inicio[8:12] == b"WEBP":
        return "image/webp"
    if inicio.startswith(b"BM"):
        return "image/bmp"
    if inicio.startswith(b"%PDF"):
        return "application/pdf"
    # MP4/MOV/3GP: "ftyp" na posição 4 (HEIC também usa ftyp, mas não é vídeo).
    if inicio[4:8] == b"ftyp" and inicio[8:12] not in (b"heic", b"heix", b"mif1", b"msf1"):
        return "video/quicktime" if inicio[8:12] == b"qt  " else "video/mp4"
    if inicio.startswith(b"\x1aE\xdf\xa3"):
        return "video/webm"
    return None


@router.get("/tickets/{ticket_pk}/anexos/{arquivo}")
async def visualizar_anexo_ticket(
    ticket_pk: int, arquivo: str, ctx: AuthContext = Depends(get_auth_context)
) -> FastAPIResponse:
    if arquivo in (".", "..") or "\\" in arquivo:
        raise HTTPException(status_code=400, detail="Nome de anexo inválido.")
    # support_ctl/annex/view não tem wrapper no brbyteapi — proxy simples
    # com o cookie de sessão do técnico, o mesmo usado em toda chamada
    # deste backend ao Controllr (ver deps.py::get_auth_context).
    url = f"{CONTROLLR_URL}/support_ctl/annex/view/{ticket_pk}/{quote(arquivo, safe='')}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers={"Cookie": ctx.session.controllr_cookie}) as resposta:
            conteudo = await resposta.read()
            if resposta.status >= 400:
                # Não repassa o código do Controllr: um 401 dele aqui faria o
                # app achar que a sessão do técnico caiu e mandar para o login.
                logger.warning("Anexo %s/%s: Controllr respondeu HTTP %s", ticket_pk, arquivo, resposta.status)
                raise HTTPException(
                    status_code=404 if resposta.status == 404 else 502,
                    detail="Não foi possível carregar o anexo.",
                )
            tipo = resposta.headers.get("Content-Type", "application/octet-stream")

    base = tipo.split(";")[0].strip().lower()
    cabecalhos = {"X-Content-Type-Options": "nosniff"}
    if _abre_na_tela(base):
        return FastAPIResponse(content=conteudo, media_type=tipo, headers=cabecalhos)
    tipo_real = _tipo_pela_assinatura(conteudo[:16])
    if tipo_real:
        return FastAPIResponse(content=conteudo, media_type=tipo_real, headers=cabecalhos)
    cabecalhos["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(arquivo, safe='')}"
    # Se mesmo assim o navegador abrir, a página fica isolada e sem script.
    cabecalhos["Content-Security-Policy"] = "sandbox; default-src 'none'"
    return FastAPIResponse(content=conteudo, media_type="application/octet-stream", headers=cabecalhos)
