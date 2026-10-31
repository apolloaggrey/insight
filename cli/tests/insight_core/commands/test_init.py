"""Unit tests for the init command."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from insight_core.commands.init import (
    CreatedFile,
    EmptyProjectNameError,
    ProjectExistsError,
    _build_no_tty_config,
    create_empty_structure,
    setup_project_name,
)
from insight_core.config import InsightConfigError
from insight_core.config.exceptions import InitError


class TestExceptions:
    """Tests for init command exceptions."""

    def test_empty_project_name_error_message(self):
        """EmptyProjectNameError has correct message."""
        error = EmptyProjectNameError()
        assert str(error) == "Project name cannot be empty."

    def test_project_exists_error_message(self):
        """ProjectExistsError includes project name in message."""
        error = ProjectExistsError("my-project")
        assert error.project_name == "my-project"
        assert "my-project" in str(error)
        assert "already exists" in str(error)

    def test_exceptions_inherit_from_init_error(self):
        """All custom exceptions inherit from InitError."""
        assert isinstance(EmptyProjectNameError(), InitError)
        assert isinstance(ProjectExistsError("test"), InitError)


class TestCreatedFile:
    """Tests for CreatedFile dataclass."""

    def test_created_file_with_content(self):
        """CreatedFile stores path and content."""
        file = CreatedFile(path=Path("test.md"), content="# Test")
        assert file.path == Path("test.md")
        assert file.content == "# Test"

    def test_created_file_without_content(self):
        """CreatedFile can have None content."""
        file = CreatedFile(path=Path("empty.txt"), content=None)
        assert file.path == Path("empty.txt")
        assert file.content is None


class TestCreateEmptyStructure:
    """Tests for create_empty_structure function."""

    def test_creates_expected_folders(self, tmp_path: Path):
        """Creates all expected project folders."""
        folders, files = create_empty_structure(tmp_path)

        expected_folders = [
            "databases",
            "docs",
            "semantics",
            "repos",
            "agent/tools",
            "agent/mcps",
            "agent/skills",
            "agent/prompts",
            "tests",
        ]

        for folder in expected_folders:
            assert (tmp_path / folder).exists()
            assert (tmp_path / folder).is_dir()

        assert set(folders) == set(expected_folders)

    def test_creates_rules_md_file(self, tmp_path: Path):
        """Creates RULES.md file."""
        folders, files = create_empty_structure(tmp_path)

        rules_file = tmp_path / "RULES.md"
        assert rules_file.exists()
        assert rules_file.is_file()

    def test_creates_prompts_readme_file(self, tmp_path: Path):
        """Creates agent/prompts/README.md documenting per-surface prompt overrides."""
        folders, files = create_empty_structure(tmp_path)

        readme = tmp_path / "agent" / "prompts" / "README.md"
        assert readme.exists()
        content = readme.read_text()
        assert "system.md" in content
        assert "slack.md" in content
        assert "mattermost.md" in content
        assert "{{ insight_prompt }}" in content

    def test_creates_example_slack_prompt_file(self, tmp_path: Path):
        """Creates an example agent/prompts/slack.md showcasing the {{ insight_prompt }} placeholder."""
        folders, files = create_empty_structure(tmp_path)

        slack_prompt = tmp_path / "agent" / "prompts" / "slack.md"
        assert slack_prompt.exists()
        assert "{{ insight_prompt }}" in slack_prompt.read_text()

    def test_does_not_create_example_mattermost_prompt_file(self, tmp_path: Path):
        """Does not create an example agent/prompts/mattermost.md."""
        create_empty_structure(tmp_path)

        mattermost_prompt = tmp_path / "agent" / "prompts" / "mattermost.md"
        assert not mattermost_prompt.exists()

    def test_creates_insightignore_file(self, tmp_path: Path):
        """Creates .insightignore file with ignored generated paths."""
        folders, files = create_empty_structure(tmp_path)

        insightignore_file = tmp_path / ".insightignore"
        assert insightignore_file.exists()
        content = insightignore_file.read_text()
        assert "templates/" in content
        assert "tests/" in content

    def test_creates_sample_test_file(self, tmp_path: Path):
        """Creates a sample test users can run as a starting point."""
        folders, files = create_empty_structure(tmp_path)

        sample_test = tmp_path / "tests" / "test_example.yml"
        assert sample_test.exists()
        content = sample_test.read_text()
        assert "name: test_example" in content
        assert "prompt: What is the result of 1+1?" in content
        assert "SELECT 2 AS answer_integer" in content

    def test_returns_created_files_list(self, tmp_path: Path):
        """Returns list of created files."""
        folders, files = create_empty_structure(tmp_path)

        assert len(files) >= 3
        file_paths = [f.path for f in files]
        assert Path("RULES.md") in file_paths
        assert Path(".insightignore") in file_paths
        assert Path("tests/test_example.yml") in file_paths

    def test_creates_nested_folders(self, tmp_path: Path):
        """Creates nested folder structures like agent/tools."""
        create_empty_structure(tmp_path)

        assert (tmp_path / "agent").exists()
        assert (tmp_path / "agent" / "tools").exists()
        assert (tmp_path / "agent" / "mcps").exists()

    def test_idempotent_on_existing_folders(self, tmp_path: Path):
        """Does not fail if folders already exist."""
        # Create structure once
        create_empty_structure(tmp_path)
        # Create again - should not raise
        folders, files = create_empty_structure(tmp_path)

        assert len(folders) > 0


class TestSetupProjectName:
    """Tests for setup_project_name function."""

    @patch("insight_core.commands.init.ask_text")
    def test_creates_new_project_folder(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """Creates project folder when it doesn't exist."""
        monkeypatch.chdir(tmp_path)
        mock_ask_text.return_value = "new-project"

        name, path, existing, created = setup_project_name()

        assert name == "new-project"
        assert path.name == "new-project"
        assert path.exists()
        assert existing is None
        assert created is True
        mock_ask_text.assert_called_once_with(
            "Enter your project name:",
            placeholder=tmp_path.name,
            submit_default=tmp_path.name,
        )

    @pytest.mark.parametrize("submitted_name", [None, ""])
    @patch("insight_core.commands.init.ask_text")
    def test_empty_project_name_creates_default_subfolder(
        self,
        mock_ask_text,
        tmp_path: Path,
        monkeypatch,
        submitted_name,
    ):
        monkeypatch.chdir(tmp_path)
        mock_ask_text.return_value = submitted_name

        name, path, existing, created = setup_project_name()

        assert name == tmp_path.name
        assert path == Path(tmp_path.name)
        assert path.resolve() == tmp_path / tmp_path.name
        assert path.exists()
        assert existing is None
        assert created is True
        mock_ask_text.assert_called_once_with(
            "Enter your project name:",
            placeholder=tmp_path.name,
            submit_default=tmp_path.name,
        )

    @patch("insight_core.commands.init.ask_text")
    def test_raises_on_existing_folder_without_force(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """Raises ProjectExistsError when folder exists and force=False."""
        monkeypatch.chdir(tmp_path)
        (tmp_path / "existing-project").mkdir()
        mock_ask_text.return_value = "existing-project"

        with pytest.raises(ProjectExistsError) as exc_info:
            setup_project_name(force=False)

        assert exc_info.value.project_name == "existing-project"

    @patch("insight_core.commands.init.ask_text")
    def test_allows_existing_folder_with_force(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """Allows existing folder when force=True."""
        monkeypatch.chdir(tmp_path)
        (tmp_path / "existing-project").mkdir()
        mock_ask_text.return_value = "existing-project"

        name, path, existing, created = setup_project_name(force=True)

        assert name == "existing-project"
        assert path.exists()
        assert existing is None
        assert created is False

    @patch("insight_core.commands.init.ask_confirm")
    @patch("insight_core.commands.init.InsightConfig.try_load")
    def test_reinitializes_existing_project(self, mock_try_load, mock_confirm, tmp_path: Path, monkeypatch):
        """Can re-initialize an existing project with config."""
        monkeypatch.chdir(tmp_path)

        # Create existing config file
        (tmp_path / "insight_config.yaml").write_text("project_name: existing\n")

        mock_config = MagicMock()
        mock_config.project_name = "existing"
        mock_try_load.return_value = mock_config
        mock_confirm.return_value = True

        name, path, existing, created = setup_project_name()

        assert name == "existing"
        assert path == tmp_path
        assert existing == mock_config
        assert created is False

    @patch("insight_core.commands.init.ask_confirm")
    @patch("insight_core.commands.init.InsightConfig.try_load")
    def test_cancels_when_user_declines_reinit(self, mock_try_load, mock_confirm, tmp_path: Path, monkeypatch):
        """Raises InitError when user declines re-initialization."""
        monkeypatch.chdir(tmp_path)

        (tmp_path / "insight_config.yaml").write_text("project_name: existing\n")

        mock_config = MagicMock()
        mock_config.project_name = "existing"
        mock_try_load.return_value = mock_config
        mock_confirm.return_value = False

        with pytest.raises(InitError) as exc_info:
            setup_project_name()

        assert "cancelled" in str(exc_info.value).lower()

    @patch("insight_core.commands.init.ask_confirm")
    @patch("insight_core.commands.init.InsightConfig.try_load")
    def test_fails_fast_on_invalid_config_file(self, mock_try_load, mock_confirm, tmp_path: Path, monkeypatch):
        """Raises InitError when existing config is invalid."""
        monkeypatch.chdir(tmp_path)

        # Create invalid config file (missing required fields)
        (tmp_path / "insight_config.yaml").write_text("invalid: yaml\nwithout: project_name\n")

        mock_try_load.side_effect = InsightConfigError("Failed to load insight_config.yaml: validation error")

        with pytest.raises(InitError) as exc_info:
            setup_project_name()

        assert "invalid insight_config.yaml" in str(exc_info.value)
        mock_confirm.assert_not_called()


class TestInsightConfigPromptDatabases:
    """Tests for InsightConfig._prompt_databases method."""

    @patch("insight_core.config.base.ask_confirm")
    def test_returns_empty_list_when_user_skips(self, mock_confirm):
        """Returns empty list when user chooses not to set up databases."""
        from insight_core.config import InsightConfig

        mock_confirm.return_value = False

        result = InsightConfig._prompt_databases()

        assert result == []

    @patch("insight_core.config.base.ask_confirm")
    @patch("insight_core.config.base.ask_select")
    @patch("insight_core.config.databases.duckdb.DuckDBConfig.promptConfig")
    def test_adds_duckdb_database(self, mock_prompt_config, mock_select, mock_confirm):
        """Adds DuckDB database when selected."""
        from insight_core.config import InsightConfig

        mock_config = MagicMock()
        mock_config.name = "test-db"
        mock_prompt_config.return_value = mock_config

        mock_confirm.return_value = True
        mock_select.return_value = "duckdb"

        result = InsightConfig._prompt_databases()

        assert len(result) == 1
        assert result[0] == mock_config
        mock_prompt_config.assert_called_once()
        mock_confirm.assert_called_once_with("Set up database connections?", default=True)

    @patch("insight_core.config.base.ask_confirm")
    @patch("insight_core.config.base.ask_select")
    @patch("insight_core.config.databases.motherduck.MotherDuckConfig.promptConfig")
    def test_adds_motherduck_database(self, mock_prompt_config, mock_select, mock_confirm):
        """Adds MotherDuck database when selected."""
        from insight_core.config import InsightConfig
        from insight_core.config.databases.motherduck import MotherDuckConfig

        mock_config = MotherDuckConfig(name="md-analytics", database="my_db", token="tok")
        mock_prompt_config.return_value = mock_config

        mock_confirm.return_value = True
        mock_select.return_value = "motherduck"

        result = InsightConfig._prompt_databases()

        assert len(result) == 1
        assert result[0] == mock_config
        assert result[0].type == "motherduck"
        mock_prompt_config.assert_called_once()
        mock_confirm.assert_called_once_with("Set up database connections?", default=True)
        # MotherDuck appears as a first-class choice in the warehouse picker.
        choices = mock_select.call_args.kwargs["choices"]
        labels = [c.title for c in choices]
        assert "MotherDuck" in labels
        assert "DuckDB" in labels


class TestInsightConfigPromptRepos:
    """Tests for InsightConfig._prompt_repos method."""

    @patch("insight_core.config.base.ask_confirm")
    def test_returns_empty_list_when_user_skips(self, mock_confirm):
        """Returns empty list when user chooses not to set up repos."""
        from insight_core.config import InsightConfig

        mock_confirm.return_value = False

        result = InsightConfig._prompt_repos()

        assert result == []

    @patch("insight_core.config.base.ask_confirm")
    @patch("insight_core.config.repos.base.RepoConfig.promptConfig")
    def test_adds_repository(self, mock_prompt_config, mock_confirm):
        """Adds repository when configured."""
        from insight_core.config import InsightConfig
        from insight_core.config.repos import RepoConfig

        mock_repo = RepoConfig(name="my-repo", url="https://github.com/org/repo.git")
        mock_prompt_config.return_value = mock_repo

        mock_confirm.return_value = True

        result = InsightConfig._prompt_repos()

        assert len(result) == 1
        assert result[0].name == "my-repo"
        assert result[0].url == "https://github.com/org/repo.git"
        mock_prompt_config.assert_called_once()
        mock_confirm.assert_called_once_with("Set up git repositories?", default=True)


class TestInsightConfigPromptLLM:
    """Tests for InsightConfig._prompt_llm method."""

    @patch("insight_core.config.base.ask_confirm")
    def test_returns_none_when_user_skips(self, mock_confirm):
        """Returns None when user chooses not to set up LLM."""
        from insight_core.config import InsightConfig

        mock_confirm.return_value = False

        llm = InsightConfig._prompt_llm()

        assert llm is None

    @patch("insight_core.config.base.ask_confirm")
    @patch("insight_core.config.llm.LLMConfig.promptConfig")
    def test_creates_llm_config(self, mock_prompt_config, mock_confirm):
        """Creates LLM config when configured."""
        from insight_core.config import InsightConfig, LLMConfig, LLMProvider, ProviderConfig

        mock_llm = LLMConfig(providers=[ProviderConfig(provider=LLMProvider.OPENAI, api_key="sk-test-key")])
        mock_prompt_config.return_value = mock_llm
        mock_confirm.return_value = True

        result_llm = InsightConfig._prompt_llm()

        assert result_llm is not None
        assert result_llm.providers[0].api_key == "sk-test-key"
        mock_prompt_config.assert_called_once_with(prompt_annotation_model=False)

    @patch("insight_core.config.llm.ask_text")
    @patch("insight_core.config.llm.ask_select")
    def test_raises_on_empty_api_key(self, mock_select, mock_text):
        """Raises error when API key is empty (handled by required_field)."""
        from insight_core.config import LLMConfig

        mock_select.return_value = "openai"
        # ask_text with required_field=True will loop until non-empty,
        # but if it returns empty, it means the validation failed.
        # Since required_field loops, let's test with None (cancelled)
        mock_text.side_effect = KeyboardInterrupt

        with pytest.raises(KeyboardInterrupt):
            LLMConfig.promptConfig()


class TestSlackConfig:
    @patch("insight_core.config.slack.ask_text")
    def test_raises_on_cancelled_bot_token(self, mock_text):
        """Raises KeyboardInterrupt when user cancels bot token input."""
        from insight_core.config import SlackConfig

        mock_text.side_effect = KeyboardInterrupt

        with pytest.raises(KeyboardInterrupt):
            SlackConfig.promptConfig()

    @patch("insight_core.config.slack.ask_text")
    def test_raises_on_cancelled_signing_secret(self, mock_text):
        """Raises KeyboardInterrupt when user cancels signing secret input."""
        from insight_core.config import SlackConfig

        mock_text.side_effect = ["xoxb-bot-token", KeyboardInterrupt]

        with pytest.raises(KeyboardInterrupt):
            SlackConfig.promptConfig()


class TestInitCommand:
    """Tests for the main init command."""

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_creates_config_file(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Init command creates insight_config.yaml file."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig

        project_path = tmp_path / "test-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("test-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(
            project_name="test-project",
            databases=[],
            repos=[],
            llm=None,
            slack=None,
        )

        init()

        config_file = project_path / "insight_config.yaml"
        assert config_file.exists()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_shows_updated_message_for_existing_config(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Init command shows 'Updated project' when updating existing config."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig

        project_path = tmp_path / "existing-project"
        project_path.mkdir()

        existing_config = InsightConfig(project_name="existing-project")
        mock_setup_project_name.return_value = ("existing-project", project_path, existing_config, False)
        mock_prompt_config.return_value = InsightConfig(
            project_name="existing-project",
            databases=[],
            repos=[],
            llm=None,
            slack=None,
        )

        init()

        # Should print "Updated project" for existing config
        calls = [str(c) for c in mock_ui.success.call_args_list]
        assert any("Updated project" in c for c in calls)

    @patch("insight_core.commands.debug.debug")
    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_runs_debug_when_config_has_databases(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        mock_debug,
        tmp_path: Path,
    ):
        """Init command runs debug when config has databases."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig
        from insight_core.config.databases.duckdb import DuckDBConfig

        project_path = tmp_path / "test-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("test-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(
            project_name="test-project",
            databases=[DuckDBConfig(name="test-db", path=":memory:")],
            repos=[],
            llm=None,
            slack=None,
        )

        with patch("insight_core.deps.get_missing_extras", return_value=[]):
            init()

        mock_debug.assert_called_once()

    @patch("insight_core.commands.init._install_with_progress")
    @patch("insight_core.deps.get_missing_extras")
    @patch("insight_core.commands.init.ask_confirm")
    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_always_installs_missing_dependencies(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        mock_confirm,
        mock_get_missing_extras,
        mock_install,
        tmp_path: Path,
    ):
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig

        project_path = tmp_path / "test-project"
        project_path.mkdir()
        mock_setup_project_name.return_value = ("test-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(project_name="test-project")
        mock_get_missing_extras.return_value = ["openai"]
        mock_install.return_value = True

        init()

        mock_install.assert_called_once_with(["openai"])
        mock_confirm.assert_not_called()

    @patch("insight_core.commands.debug.debug")
    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_runs_debug_when_config_has_llm(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        mock_debug,
        tmp_path: Path,
    ):
        """Init command runs debug when config has LLM."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig, LLMConfig, LLMProvider, ProviderConfig

        project_path = tmp_path / "test-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("test-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(
            project_name="test-project",
            databases=[],
            repos=[],
            llm=LLMConfig(providers=[ProviderConfig(provider=LLMProvider.OPENAI, api_key="sk-test")]),
            slack=None,
        )

        with patch("insight_core.deps.get_missing_extras", return_value=[]):
            init()

        mock_debug.assert_called_once()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_creates_folder_structure(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Init command creates project folder structure."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig

        project_path = tmp_path / "test-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("test-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(
            project_name="test-project",
            databases=[],
            repos=[],
            llm=None,
            slack=None,
        )

        init()

        assert (project_path / "databases").exists()
        assert not (project_path / "queries").exists()
        assert (project_path / "RULES.md").exists()

    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_handles_init_error(self, mock_ui, mock_setup_project_name):
        """Init command prints error and exits non-zero on InitError."""
        from insight_core.commands.init import init

        mock_setup_project_name.side_effect = EmptyProjectNameError()

        with pytest.raises(SystemExit) as exc_info:
            init()

        assert exc_info.value.code == 1
        mock_ui.error.assert_called()
        calls = [str(c) for c in mock_ui.error.call_args_list]
        assert any("cannot be empty" in c for c in calls)

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_cleans_up_folder_on_keyboard_interrupt(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Empty folder is removed when prompts are interrupted with Ctrl+C."""
        from insight_core.commands.init import init

        project_path = tmp_path / "interrupted-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("interrupted-project", project_path, None, True)
        mock_prompt_config.side_effect = KeyboardInterrupt

        with pytest.raises(KeyboardInterrupt):
            init()

        assert not project_path.exists()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_cleans_up_folder_on_unexpected_error(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Empty folder is removed when an unexpected exception aborts init."""
        from insight_core.commands.init import init

        project_path = tmp_path / "broken-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("broken-project", project_path, None, True)
        mock_prompt_config.side_effect = RuntimeError("boom")

        with pytest.raises(RuntimeError):
            init()

        assert not project_path.exists()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_cleans_up_folder_on_init_error_after_creation(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Empty folder is removed when an InitError is raised after creation."""
        from insight_core.commands.init import init
        from insight_core.config.exceptions import InitError

        project_path = tmp_path / "init-error-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("init-error-project", project_path, None, True)
        mock_prompt_config.side_effect = InitError("config prompts failed")

        with pytest.raises(SystemExit):
            init()

        assert not project_path.exists()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_preserves_existing_folder_on_abort(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """A pre-existing folder (force=True / reinit) is not deleted on abort."""
        from insight_core.commands.init import init

        project_path = tmp_path / "preexisting-project"
        project_path.mkdir()
        sentinel_file = project_path / "keep-me.txt"
        sentinel_file.write_text("important user data")

        mock_setup_project_name.return_value = (
            "preexisting-project",
            project_path,
            None,
            False,
        )
        mock_prompt_config.side_effect = KeyboardInterrupt

        with pytest.raises(KeyboardInterrupt):
            init()

        assert project_path.exists()
        assert sentinel_file.read_text() == "important user data"

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.setup_project_name")
    @patch("insight_core.commands.init.UI")
    def test_init_does_not_clean_up_after_structure_created(
        self,
        mock_ui,
        mock_setup_project_name,
        mock_prompt_config,
        tmp_path: Path,
    ):
        """Folder is preserved when failure happens after create_empty_structure.

        Anything that fails post-setup (e.g. dep install, debug) must not blow
        away a successfully initialized project.
        """
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig

        project_path = tmp_path / "done-project"
        project_path.mkdir()

        mock_setup_project_name.return_value = ("done-project", project_path, None, True)
        mock_prompt_config.return_value = InsightConfig(
            project_name="done-project",
            databases=[],
            repos=[],
            llm=None,
            slack=None,
        )

        with patch("insight_core.deps.get_missing_extras", side_effect=RuntimeError("late failure")):
            with pytest.raises(RuntimeError):
                init()

        assert project_path.exists()
        assert (project_path / "insight_config.yaml").exists()
        assert (project_path / "databases").exists()


class TestSetupProjectNameNoTty:
    """Tests for setup_project_name in non-interactive (no_tty) mode."""

    @patch("insight_core.commands.init.ask_text")
    def test_no_tty_uses_current_dir_name_when_no_name_given(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """In no-tty mode without --name, uses current directory name and inits in place."""
        project_dir = tmp_path / "my-agent-project"
        project_dir.mkdir()
        monkeypatch.chdir(project_dir)

        name, path, existing, created = setup_project_name(no_tty=True)

        assert name == "my-agent-project"
        assert path == project_dir
        assert existing is None
        assert created is False
        mock_ask_text.assert_not_called()

    @patch("insight_core.commands.init.ask_text")
    def test_no_tty_uses_explicit_name_and_creates_subfolder(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """In no-tty mode with --name, creates a subfolder for the project."""
        monkeypatch.chdir(tmp_path)

        name, path, existing, created = setup_project_name(no_tty=True, name="explicit-name")

        assert name == "explicit-name"
        assert path == Path("explicit-name")
        assert path.exists()
        assert existing is None
        assert created is True
        mock_ask_text.assert_not_called()

    @patch("insight_core.commands.init.ask_confirm")
    @patch("insight_core.commands.init.InsightConfig.try_load")
    def test_no_tty_skips_update_confirmation_for_existing_config(
        self, mock_try_load, mock_confirm, tmp_path: Path, monkeypatch
    ):
        """In no-tty mode with existing config, skips the update confirmation prompt."""
        monkeypatch.chdir(tmp_path)
        (tmp_path / "insight_config.yaml").write_text("project_name: existing\n")

        mock_config = MagicMock()
        mock_config.project_name = "existing"
        mock_try_load.return_value = mock_config

        name, path, existing, created = setup_project_name(no_tty=True)

        assert name == "existing"
        assert path == tmp_path
        assert existing == mock_config
        assert created is False
        mock_confirm.assert_not_called()

    @patch("insight_core.commands.init.ask_text")
    def test_explicit_name_skips_text_prompt(self, mock_ask_text, tmp_path: Path, monkeypatch):
        """Passing --name without --yes still skips the project name prompt."""
        monkeypatch.chdir(tmp_path)

        name, path, existing, created = setup_project_name(name="cli-named-project")

        assert name == "cli-named-project"
        assert path == Path("cli-named-project")
        assert path.exists()
        assert existing is None
        assert created is True
        mock_ask_text.assert_not_called()


class TestBuildNoTtyConfig:
    """Tests for _build_no_tty_config helper."""

    def test_returns_existing_config_when_present(self):
        """Reuses existing config without modification."""
        from insight_core.config import InsightConfig

        existing = InsightConfig(project_name="kept-as-is")
        result = _build_no_tty_config("ignored-name", existing)

        assert result is existing
        assert result.project_name == "kept-as-is"

    def test_creates_minimal_config_when_no_existing(self):
        """Builds a minimal config with just the project name."""
        result = _build_no_tty_config("brand-new", None)

        assert result.project_name == "brand-new"
        assert result.databases == []
        assert result.repos == []
        assert result.llm is None
        assert result.slack is None
        assert result.notion is None
        assert result.obsidian is None
        assert result.mcp is None
        assert result.skills is None


class TestInitCommandNoTty:
    """Tests for the init command in non-interactive (--yes / --no-tty) mode."""

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.UI")
    def test_yes_does_not_prompt_for_config(
        self,
        mock_ui,
        mock_prompt_config,
        tmp_path: Path,
        monkeypatch,
    ):
        """`--yes` skips the interactive promptConfig flow entirely."""
        from insight_core.commands.init import init

        project_dir = tmp_path / "no-tty-project"
        project_dir.mkdir()
        monkeypatch.chdir(project_dir)

        init(yes=True)

        mock_prompt_config.assert_not_called()
        config_file = project_dir / "insight_config.yaml"
        assert config_file.exists()
        content = config_file.read_text()
        assert "project_name: no-tty-project" in content

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.UI")
    def test_yes_with_explicit_name_creates_subfolder(
        self,
        mock_ui,
        mock_prompt_config,
        tmp_path: Path,
        monkeypatch,
    ):
        """`--yes --name foo` creates a subfolder named foo with a minimal config."""
        from insight_core.commands.init import init

        monkeypatch.chdir(tmp_path)

        init(yes=True, name="my-agent")

        project_path = tmp_path / "my-agent"
        assert project_path.exists()
        assert (project_path / "insight_config.yaml").exists()
        assert (project_path / "RULES.md").exists()
        assert (project_path / "databases").is_dir()
        mock_prompt_config.assert_not_called()

    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.UI")
    def test_yes_preserves_pre_written_config(
        self,
        mock_ui,
        mock_prompt_config,
        tmp_path: Path,
        monkeypatch,
    ):
        """`--yes` reuses an existing insight_config.yaml without prompting to update."""
        from insight_core.commands.init import init

        project_dir = tmp_path / "pre-written"
        project_dir.mkdir()
        monkeypatch.chdir(project_dir)

        config_yaml = project_dir / "insight_config.yaml"
        config_yaml.write_text("project_name: pre-written\n")

        init(yes=True)

        mock_prompt_config.assert_not_called()
        # Folder structure is still scaffolded
        assert (project_dir / "RULES.md").exists()
        assert (project_dir / "databases").is_dir()
        # The config still names the existing project
        assert "project_name: pre-written" in config_yaml.read_text()

    @patch("insight_core.commands.debug.debug")
    @patch("insight_core.commands.init.InsightConfig.promptConfig")
    @patch("insight_core.commands.init.UI")
    def test_yes_preserves_pre_written_motherduck_config(
        self,
        mock_ui,
        mock_prompt_config,
        mock_debug,
        tmp_path: Path,
        monkeypatch,
    ):
        """`--yes` keeps a pre-written MotherDuck database entry loadable."""
        from insight_core.commands.init import init
        from insight_core.config import InsightConfig
        from insight_core.config.databases.motherduck import MotherDuckConfig

        project_dir = tmp_path / "pre-written-md"
        project_dir.mkdir()
        monkeypatch.chdir(project_dir)
        monkeypatch.setenv("MOTHERDUCK_TOKEN", "init-token")

        config_yaml = project_dir / "insight_config.yaml"
        config_yaml.write_text(
            """
project_name: pre-written-md
databases:
  - type: motherduck
    name: md-analytics
    database: my_db
    token: "{{ env('MOTHERDUCK_TOKEN') }}"
""".lstrip()
        )

        with patch("insight_core.deps.get_missing_extras", return_value=[]):
            init(yes=True)

        mock_prompt_config.assert_not_called()
        assert (project_dir / "RULES.md").exists()

        loaded = InsightConfig.load(project_dir)
        assert len(loaded.databases) == 1
        db = loaded.databases[0]
        assert isinstance(db, MotherDuckConfig)
        assert db.name == "md-analytics"
        assert db.database == "my_db"
        assert db.token == "init-token"
        assert db.connection_path() == "md:my_db?motherduck_token=init-token"
