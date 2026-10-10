from unittest.mock import patch

from insight_core import __version__
from insight_core.version import check_for_updates


def test_check_for_updates_never_warns_insight_is_built_from_source():
    """Insight: PyPI's insight-core is a different product, so there is nothing to upgrade to."""
    with (
        patch("insight_core.version._read_cache", return_value="99.0.0"),
        patch("insight_core.version.UI.warn") as mock_warn,
        patch("insight_core.version.subprocess.Popen") as mock_popen,
    ):
        check_for_updates()

    mock_warn.assert_not_called()
    mock_popen.assert_not_called()


def test_check_for_updates_does_nothing_for_current_cached_version():
    with (
        patch("insight_core.version._read_cache", return_value=__version__),
        patch("insight_core.version.UI.warn") as mock_warn,
        patch("insight_core.version.subprocess.Popen") as mock_popen,
    ):
        check_for_updates()

    mock_warn.assert_not_called()
    mock_popen.assert_not_called()


def test_check_for_updates_never_contacts_pypi():
    """Insight: no background refresh against PyPI."""
    with (
        patch("insight_core.version._read_cache", return_value=None),
        patch("insight_core.version.subprocess.Popen") as mock_popen,
    ):
        check_for_updates()

    mock_popen.assert_not_called()
