import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location("studio_watch", str(Path(__file__).with_name("studio_watch.py")))
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)

class ObserverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        before = watch.STATE
        watch.STATE = Path(self.tmp.name) / "state.json"
        self.addCleanup(setattr, watch, "STATE", before)
        self.phone = Mock()
        self.phone.config.return_value = {"allowed_packages": ["org.blender.android"]}
        self.phone.foreground_package.return_value = "org.blender.android"
        self.phone.consent_active.return_value = True
        self.phone.screenshot.return_value = "/private/latest.png"

    def payload(self, jid="old", ok=True):
        return {"status": {"last_result": {"id": jid, "ok": ok}}}

    def test_no_capture_on_first_start(self):
        self.assertIn("initialized", watch.observe_once(self.phone, self.payload()))
        self.phone.screenshot.assert_not_called()

    def test_capture_only_once(self):
        watch.observe_once(self.phone, self.payload())
        self.assertIn("captured", watch.observe_once(self.phone, self.payload("new")))
        self.assertIn("No new", watch.observe_once(self.phone, self.payload("new")))
        self.assertEqual(self.phone.screenshot.call_count, 1)

    def test_disarmed(self):
        watch.observe_once(self.phone, self.payload())
        self.phone.consent_active.return_value = False
        self.assertIn("consent required", watch.observe_once(self.phone, self.payload("new")))
        self.phone.screenshot.assert_not_called()

    def test_disallowed_app(self):
        watch.observe_once(self.phone, self.payload())
        self.phone.foreground_package.return_value = "com.example.private"
        self.assertIn("not allowlisted", watch.observe_once(self.phone, self.payload("new")))
        self.phone.screenshot.assert_not_called()

    def test_failed_job(self):
        watch.observe_once(self.phone, self.payload())
        self.assertIn("No successful", watch.observe_once(self.phone, self.payload("new", False)))
        self.phone.screenshot.assert_not_called()

if __name__ == "__main__":
    unittest.main()
