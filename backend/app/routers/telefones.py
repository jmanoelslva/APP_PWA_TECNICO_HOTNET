from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro

router = APIRouter(tags=["telefones"])


class TelefonePayload(BaseModel):
    # Telefone é recurso PRÓPRIO do Controllr (/controllrctl/phone/*), não
    # um campo solto do cliente — client_phones (client/list) é só um
    # resumo "Rótulo#-#número" montado a partir desses registros. Todos os
    # campos abaixo são reenviados no update mesmo quando só o número
    # muda (confirmado ao vivo, capturando um "Salvar" sem alteração
    # nenhuma no painel real: o formulário sempre reenvia o registro
    # inteiro) — o técnico só edita o número na tela, os demais valores já
    # carregados são reenviados como estavam.
    client_pk: int | None = None
    phone_identification: str | None = None
    phone_number: str | None = None
    phone_operator: str | None = None
    phone_type: int | None = None
    phone_sva: int | None = None
    phone_status: int | None = None
    phone_valid: int | None = None
    phone_code: str | None = None


def _corpo(payload: TelefonePayload, extras: dict[str, Any] | None = None) -> str:
    campos = {k: v for k, v in payload.model_dump().items() if v is not None}
    if extras:
        campos.update(extras)
    return urlencode(campos)


@router.put("/telefones/{phone_pk}")
async def atualizar_telefone(
    phone_pk: int, payload: TelefonePayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    resposta = await ctx.controllr.phone_update(_corpo(payload, {"phone_pk": phone_pk}))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o telefone.", resposta))
    return {"success": True, "results": resposta.results}
