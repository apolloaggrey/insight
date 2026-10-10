"""Oracle Database connections (Insight addition)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import Field

from insight_core.config.exceptions import InitError
from insight_core.ui import ask_text

if TYPE_CHECKING:
    from ibis import BaseBackend

from .base import DatabaseConfig

SYSTEM_SCHEMAS = {
    "ANONYMOUS",
    "APPQOSSYS",
    "AUDSYS",
    "CTXSYS",
    "DBSFWUSER",
    "DBSNMP",
    "DIP",
    "DVSYS",
    "GGSYS",
    "GSMADMIN_INTERNAL",
    "LBACSYS",
    "MDSYS",
    "OJVMSYS",
    "OLAPSYS",
    "ORDDATA",
    "ORDSYS",
    "OUTLN",
    "REMOTE_SCHEDULER_AGENT",
    "SYS",
    "SYSTEM",
    "WMSYS",
    "XDB",
    "XS$NULL",
}


class OracleConfig(DatabaseConfig):
    """Oracle Database configuration."""

    type: Literal["oracle"] = "oracle"
    host: str = Field(description="Oracle host")
    port: int = Field(default=1521, description="Oracle listener port")
    service_name: str = Field(description="Service name, e.g. ORCLPDB1")
    user: str = Field(description="Username")
    password: str = Field(description="Password")
    schema_name: str | None = Field(default=None, description="Schema to sync (defaults to every non-system schema)")

    @classmethod
    def promptConfig(cls) -> OracleConfig:
        name = ask_text("Connection name:", default="oracle-prod") or "oracle-prod"
        host = ask_text("Host:", default="localhost") or "localhost"
        port_str = ask_text("Port:", default="1521") or "1521"
        if not port_str.isdigit():
            raise InitError("Port must be a valid integer.")
        return OracleConfig(
            name=name,
            host=host,
            port=int(port_str),
            service_name=ask_text("Service name:", required_field=True),  # type: ignore[arg-type]
            user=ask_text("Username:", required_field=True),  # type: ignore[arg-type]
            password=ask_text("Password:", password=True) or "",
            schema_name=ask_text("Schema (optional):"),
        )

    def connect(self) -> BaseBackend:
        from insight_core.deps import require_database_backend

        require_database_backend("oracle")
        import ibis

        return ibis.oracle.connect(
            user=self.user,
            password=self.password,
            host=self.host,
            port=self.port,
            service_name=self.service_name,
        )

    def get_database_name(self) -> str:
        return self.service_name

    def get_schemas(self, conn: BaseBackend) -> list[str]:
        if self.schema_name:
            return [self.schema_name]
        rows = conn.raw_sql("SELECT username FROM all_users ORDER BY username").fetchall()  # type: ignore[union-attr]
        return [row[0] for row in rows if row[0] not in SYSTEM_SCHEMAS]
