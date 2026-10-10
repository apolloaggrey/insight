from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def clean_env(monkeypatch):
    """Remove environment variables that interfere with chat command tests."""
    monkeypatch.delenv("BETTER_AUTH_SECRET", raising=False)
    monkeypatch.delenv("INSIGHT_DEFAULT_PROJECT_PATH", raising=False)
    monkeypatch.delenv("SERVER_PORT", raising=False)
    monkeypatch.delenv("FASTAPI_PORT", raising=False)


@pytest.fixture
def create_config(tmp_path, monkeypatch):
    """Factory fixture to create an Insight config file and chdir to tmp_path."""

    def _create(content: str = "project_name: test-project\n"):
        config_file = tmp_path / "insight_config.yaml"
        config_file.write_text(content)
        monkeypatch.chdir(tmp_path)
        return config_file

    return _create


@pytest.fixture
def mock_socket():
    mock_sock = MagicMock()
    with patch("socket.socket") as mock_socket_cls:
        mock_socket_cls.return_value.__enter__.return_value = mock_sock
        with patch("insight_core.commands.chat.sleep"):
            yield mock_sock


@pytest.fixture
def mock_chat_dependencies(tmp_path, create_config, clean_env):
    """Set up valid config and fake binary paths."""
    create_config()
    # Create fake binaries that pass the exists() check
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "insight-chat-server").touch()
    fastapi_dir = bin_dir / "fastapi"
    fastapi_dir.mkdir()
    (fastapi_dir / "main.py").touch()

    return tmp_path, bin_dir
