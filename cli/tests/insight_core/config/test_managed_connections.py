"""Insight: connections managed from the web app (insight_connections.yaml)."""

import json
import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock

from insight_core.config import InsightConfig
from insight_core.config.databases import BigQueryConfig, PostgresConfig

BASE_CONFIG = "project_name: test\ndatabases: []\n"


def write_project(tmp_path: Path, managed: str) -> Path:
    (tmp_path / "insight_config.yaml").write_text(BASE_CONFIG)
    (tmp_path / "insight_connections.yaml").write_text(managed)
    return tmp_path


def test_merges_connections_with_secrets_from_env(tmp_path: Path):
    tricky_password = 'p@ss:w#rd "quoted" \\ back'
    project = write_project(
        tmp_path,
        '- name: "warehouse"\n'
        '  type: "postgres"\n'
        '  host: "db.example.com"\n'
        "  port: 5432\n"
        '  database: "analytics"\n'
        '  user: "reader"\n'
        "  password: {{ env('INSIGHT_CONN_A_PASSWORD') }}\n",
    )
    config = InsightConfig.load(project, extra_env={"INSIGHT_CONN_A_PASSWORD": json.dumps(tricky_password)})
    assert [db.name for db in config.databases] == ["warehouse"]
    database = config.databases[0]
    assert isinstance(database, PostgresConfig)
    assert database.password == tricky_password


def test_skips_a_connection_whose_secrets_are_unavailable(tmp_path: Path):
    project = write_project(
        tmp_path,
        '- name: "needs-secret"\n'
        '  type: "postgres"\n'
        '  host: "h"\n'
        '  database: "d"\n'
        '  user: "u"\n'
        "  password: {{ env('INSIGHT_CONN_MISSING') }}\n"
        '- name: "local-file"\n'
        '  type: "duckdb"\n'
        '  path: ":memory:"\n',
    )
    config = InsightConfig.load(project)
    assert [db.name for db in config.databases] == ["local-file"]


def test_json_secret_becomes_an_object(tmp_path: Path):
    key = {"type": "service_account", "project_id": "demo", "private_key": "-----BEGIN-----\nabc\n-----END-----\n"}
    project = write_project(
        tmp_path,
        '- name: "bq"\n  type: "bigquery"\n  project_id: "demo"\n'
        "  credentials_json: {{ env('INSIGHT_CONN_B_CREDENTIALS_JSON') }}\n",
    )
    config = InsightConfig.load(project, extra_env={"INSIGHT_CONN_B_CREDENTIALS_JSON": json.dumps(key)})
    database = config.databases[0]
    assert isinstance(database, BigQueryConfig)
    assert database.credentials_json == key


def test_sqlite_connection_reaches_the_file(tmp_path: Path):
    db_file = tmp_path / "app.db"
    with sqlite3.connect(db_file) as conn:
        conn.execute("create table orders (id integer, total real)")
    project = write_project(tmp_path, f'- name: "app"\n  type: "sqlite"\n  path: {json.dumps(str(db_file))}\n')
    sqlite_config = InsightConfig.load(project).databases[0]
    ok, message = sqlite_config.check_connection()
    assert ok, message
    assert "orders" in sqlite_config.connect().list_tables()


def test_multiline_ca_certificate_reaches_mysql_from_env(tmp_path: Path, monkeypatch):
    pem = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----"
    project = write_project(
        tmp_path,
        '- name: "do"\n'
        '  type: "mysql"\n'
        '  host: "h"\n'
        '  database: "d"\n'
        '  user: "u"\n'
        '  password: "p"\n'
        "  ssl_ca: {{ env('INSIGHT_CONN_A_SSL_CA') }}\n",
    )
    config = InsightConfig.load(project, extra_env={"INSIGHT_CONN_A_SSL_CA": json.dumps(pem)})
    connect = MagicMock()
    monkeypatch.setitem(sys.modules, "ibis", MagicMock(mysql=MagicMock(connect=connect)))
    monkeypatch.setattr("insight_core.deps.require_database_backend", lambda _backend: None)

    config.databases[0].connect()

    kwargs = connect.call_args.kwargs
    assert kwargs["ssl_mode"] == "VERIFY_CA"
    assert Path(kwargs["ssl"]["ca"]).read_text() == pem
