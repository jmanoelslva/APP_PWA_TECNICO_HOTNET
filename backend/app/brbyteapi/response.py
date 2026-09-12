from pydantic import BaseModel, Field, computed_field
from typing import Any, Generic, Type, TypeVar

T = TypeVar('T')
M = TypeVar("M", bound=BaseModel)

class Response(BaseModel, Generic[T]):
    errors  : list[dict[str, Any]]  = Field(default_factory=lambda:[])
    results : list[T]               = Field(default_factory=lambda:[])
    status  : int
    success : bool
    # Total de registros no SERVIDOR (contando todas as páginas), quando o
    # Controllr informa isso no próprio corpo (chave "total" do JSON —
    # confirmado ao vivo: é o que alimenta o rodapé "1 à 15 de 74" das
    # grades reais do painel, não o tamanho da página atual). None quando
    # o endpoint não manda esse campo. Antes esse valor era descartado e
    # "total" virava sempre len(results) — quebrava paginação de verdade
    # ("carregar mais" nunca aparecia depois da primeira página, porque
    # total == tamanho da página == len(results) sempre).
    total_servidor: int | None = None

    @computed_field
    @property
    def total(self) -> int:
        return self.total_servidor if self.total_servidor is not None else len(self.results)

    def cast(self, model: Type[M]) -> "Response[M]":
        """
        Converte os elementos de results para o modelo especificado.
        Mantém errors, status, success e total_servidor.
        """
        return Response[M](
            errors=self.errors,
            results=[model.model_validate(result) for result in self.results],
            status=self.status,
            success=self.success,
            total_servidor=self.total_servidor,
        )