from pydantic import BaseModel, Field, computed_field
from typing import Any, Generic, Type, TypeVar

T = TypeVar('T')
M = TypeVar("M", bound=BaseModel)

class Response(BaseModel, Generic[T]):
    errors  : list[dict[str, Any]]  = Field(default_factory=lambda:[])
    results : list[T]               = Field(default_factory=lambda:[])
    status  : int
    success : bool

    @computed_field
    @property
    def total(self) -> int:
        return len(self.results)

    def cast(self, model: Type[M]) -> "Response[M]":
        """
        Converte os elementos de results para o modelo especificado.
        Mantém errors, status e success.
        """
        return Response[M](
            errors=self.errors,
            results=[model.model_validate(result) for result in self.results],
            status=self.status,
            success=self.success
        )