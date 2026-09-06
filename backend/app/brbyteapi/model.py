from pydantic import BaseModel, GetCoreSchemaHandler, field_validator, ValidationInfo
from pydantic.fields import FieldInfo
from pydantic_core import core_schema
from types import UnionType
from typing import Any, Literal, Union, get_origin, get_args
from urllib.parse import urlencode

class Empty:
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        return core_schema.is_instance_schema(cls)

    ##################################### Outros
    def __contains__(self, item: Any):      # Any in Empty é False, None in Empty é True
        return False or item is None
    def __len__(self):                      # Length de Empty é 0
        return 0
    def __repr__(self):                     # Representation de Empty é "Empty"
        return "Empty"
    
    ##################################### Conversões
    def __bool__(self) -> Literal[False]:   # Boolean de Empty é False
        return False    
    def __int__(self):                      # Integer de Empty é 0
        return 0
    def __str__(self):                      # String de Empty é ""
        return ""
    
    # ##################################### Multiplicação
    def __mul__(self, other: Any):          # Empty * Any é Any * 0
        return other * 0
    def __rmul__(self, other: Any):         # Any * Empty é Any * 0
        return other * 0
    
    ##################################### Comparação
    def __eq__(self, other: Any):           # Empty é igual a Empty, Empty é igual a None
        return isinstance(other, Empty) or other is None
    def __lt__(self, other: Any):           # Empty é < que Any, exceto Empty
        return not isinstance(other, Empty)
    def __le__(self, other: Any):           # Empty é <= que Any
        return True
    def __gt__(self, other: Any):           # Empty não é > que Any
        return False
    def __ge__(self, other: Any):           # Empty não é >= que Any, excetp Empty
        return isinstance(other, Empty)

def diff_models(a: BaseModel, b: BaseModel, exclude_fields: list[str] | None = None) -> dict[str, tuple[Any, Any]]:
    if type(a) != type(b):
        raise TypeError(f"Cannot compare different model types: {type(a).__name__} vs {type(b).__name__}")

    exclude_fields_set = set(exclude_fields or [])

    a_data = a.model_dump()
    b_data = b.model_dump()

    diffs: dict[str, tuple[Any, Any]] = {}

    for key in type(a).model_fields.keys():
        if key in exclude_fields_set:
            continue

        a_value = a_data.get(key)
        b_value = b_data.get(key)

        if a_value != b_value:
            diffs[key] = (a_value, b_value)

    return diffs

# T = TypeVar("T")
# def is_truthy(value: T | None | Empty) -> TypeGuard[T]:
#     return bool(value)

class WSBaseModel(BaseModel):
    pass

    @field_validator('*', mode='before')
    @classmethod
    def replace_falsy_str(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return Empty()
        return value
    
    @field_validator('*', mode='before')
    @classmethod
    def replace_none_with_empty(cls, value: Any, info: ValidationInfo) -> Any:
        if value is None:
            if not info.field_name:
                return None
                
            field_info = cls.model_fields.get(info.field_name)
        
            if field_info and not cls.__field_accepts_none(field_info):
                return Empty()
        return value
    
    @classmethod
    def __field_accepts_none(cls, field_info: FieldInfo) -> bool:
        """Verifica se o field aceita None como valor válido"""
        annotation = field_info.annotation
        
        if annotation is None or annotation is type(None):
            return True
            
        # Verifica Union/Optional (Union[X, None] ou X | None)
        origin = get_origin(annotation)
        if origin is UnionType or origin is Union:
            args = get_args(annotation)
            return type(None) in args
            
        return False
    
    def model_dump(self, exclude: set[str] | None = None, exclude_empty: bool = True, **kwargs: Any) -> dict[str, Any]:
        if exclude is None:
            exclude = set()

        if exclude_empty:
            for field_name, field_value in self.__dict__.items():
                if isinstance(field_value, Empty):
                    exclude.add(field_name)

        if exclude:
            kwargs["exclude"] = exclude

        return super().model_dump(**kwargs)
    
    def model_url_encode(self, **kwargs: Any):
        kwargs.setdefault("by_alias", True)
        return urlencode({
            key: (int(value) if isinstance(value, bool) else value)
            for key, value in self.model_dump(mode="json", **kwargs).items()
        })