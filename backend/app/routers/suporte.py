"""
Ticket / Suporte Técnico — o CASO/chamado aberto pelo cliente (título,
descrição, categoria, chat). Diferente de Ordem de Serviço (ver
ordens_servico.py): um ticket pode ter uma ou mais OS vinculadas
(trabalho de campo agendado), mas o ticket em si nunca é "fechado" pelo
técnico neste app — quem se fecha é a OS (support_ctl/os/close).
"""

from typing import Any
from urllib.parse import urlencode

import aiohttp
from aiohttp import FormData
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response as FastAPIResponse
from pydantic import BaseModel

from ..config import CONTROLLR_URL
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo as montar_corpo
from ..where import where_eq, where_in

router = APIRouter(prefix="/suporte", tags=["suporte"])


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
        # Usado pela tela de detalhe do cliente, pra mostrar o histórico
        # de chamados junto com cadastro/contratos/endereços — client_pk
        # é campo confirmado na resposta de ticket_list (doc oficial).
        where = where_eq("client_pk", client_pk)
    elif minhas and ctx.session.user_pk is not None:
        # oper 21 = "IN" (confirmado no README do brbyteapi, exemplo de
        # ticket_list) — precisa ser esse, não "=" (oper 5), já que o
        # valor é uma LISTA de um item, não um escalar. Se user_pk ainda
        # não foi resolvido (ver auth.py::_find_user_pk), cai pra "todos"
        # em vez de mostrar uma lista vazia enganosa.
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
    # support_ctl/op/list não tem wrapper no brbyteapi (só op/create) —
    # mesmo endpoint que o app cliente usa via listarOperacoesChamado.
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


@router.post("/tickets/{ticket_pk}/anexos")
async def enviar_anexo_ticket(
    ticket_pk: int, file: UploadFile, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    conteudo = await file.read()
    form = FormData()
    form.add_field("file", conteudo, filename=file.filename, content_type=file.content_type)
    form.add_field("ticket_pk", str(ticket_pk))

    resposta = await ctx.controllr.support_annex_upload(form)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível enviar o anexo.", resposta))
    return {"success": True, "results": resposta.results}


@router.get("/tickets/{ticket_pk}/anexos/{arquivo}")
async def visualizar_anexo_ticket(
    ticket_pk: int, arquivo: str, ctx: AuthContext = Depends(get_auth_context)
) -> FastAPIResponse:
    # support_ctl/annex/view não tem wrapper no brbyteapi — proxy simples
    # com o Basic Auth do técnico, mesmo padrão usado pelo app cliente via
    # urlAnexoChamado (lá é cookie de sessão; aqui é o header Authorization
    # que o resto deste backend já usa para toda chamada ao Controllr).
    url = f"{CONTROLLR_URL}/support_ctl/annex/view/{ticket_pk}/{arquivo}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers={"Authorization": ctx.session.basic_auth}) as resposta:
            conteudo = await resposta.read()
            if resposta.status >= 400:
                raise HTTPException(status_code=resposta.status, detail="Não foi possível carregar o anexo.")
            tipo = resposta.headers.get("Content-Type", "application/octet-stream")
            return FastAPIResponse(content=conteudo, media_type=tipo)
