from __future__ import annotations

from typing import Any


class DefaultEnum:
    @classmethod
    def _missing_(cls, value: Any):
        default_member = getattr(cls, "DEFAULT", None)
        if default_member is not None:
            return default_member
        raise ValueError(f"{value!r} is not a valid {cls.__name__} and no DEFAULT is set")
