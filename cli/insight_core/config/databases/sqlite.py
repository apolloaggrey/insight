"""SQLite file connections (Insight addition)."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Literal

from pydantic import Field

from insight_core.ui import ask_text

if TYPE_CHECKING:
    from ibis import BaseBackend

from .base import DatabaseConfig


class SqliteConfig(DatabaseConfig):
    """SQLite configuration: a database file on the server, opened read-only."""

    type: Literal["sqlite"] = "sqlite"
    path: str = Field(description="Path to the SQLite database file")

    @classmethod
    def promptConfig(cls) -> SqliteConfig:
        name = ask_text("Connection name:", default="sqlite") or "sqlite"
        path = ask_text("Path to database file:", required_field=True) or ""
        return SqliteConfig(name=name, path=path)

    def connect(self) -> BaseBackend:
        from insight_core.deps import require_database_backend

        require_database_backend("sqlite")
        import ibis

        path = Path(self.path).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"SQLite file not found: {path}")
        return ibis.sqlite.connect(path)

    def get_database_name(self) -> str:
        return Path(self.path).stem

    def get_schemas(self, conn: BaseBackend) -> list[str]:
        return ["main"]
