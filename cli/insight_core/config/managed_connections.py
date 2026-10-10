"""Insight: database connections managed from the web app.

The app writes them to insight_connections.yaml next to insight_config.yaml, one `- ` entry per
connection, with secrets as {{ env('…') }} references supplied at query time. An entry whose
secrets are not available here is left out instead of failing the whole configuration.
"""

from pathlib import Path
from typing import Any

import yaml

from .secrets import process_secrets

MANAGED_CONNECTIONS_FILE = "insight_connections.yaml"


def merge_managed_connections(path: Path, data: Any, extra_env: dict[str, str] | None) -> Any:
    managed = load_managed_connections(path, extra_env)
    if not managed or not isinstance(data, dict):
        return data
    configured = data.get("databases") or []
    taken = {entry.get("name") for entry in configured if isinstance(entry, dict)}
    return {**data, "databases": [*configured, *(entry for entry in managed if entry.get("name") not in taken)]}


def load_managed_connections(path: Path, extra_env: dict[str, str] | None) -> list[dict[str, Any]]:
    file = path / MANAGED_CONNECTIONS_FILE
    if not file.is_file():
        return []
    entries: list[dict[str, Any]] = []
    for chunk in _split_entries(file.read_text()):
        rendered, missing = process_secrets(chunk, extra_env=extra_env)
        if missing:
            continue
        parsed = yaml.safe_load(rendered)
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            entries.append(parsed[0])
    return entries


def _split_entries(content: str) -> list[str]:
    chunks: list[list[str]] = []
    for line in content.splitlines():
        if line.startswith("- "):
            chunks.append([line])
        elif chunks and line.strip() and not line.lstrip().startswith("#"):
            chunks[-1].append(line)
    return ["\n".join(chunk) for chunk in chunks]
