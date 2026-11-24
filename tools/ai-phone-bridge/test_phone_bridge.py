import importlib.util
import json
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('phone_bridge', str(Path(__file__).with_name('phone_bridge.py')))
pb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pb)

class BridgeTests(TestCase):
    def test_metadata_allowed(self):
        self.assertEqual(pb.validate_job({"id":"ping1","steps":[{"op":"status"}]}),'ping1')
    def test_no_input_without_package(self):
        with self.assertRaises(ValueError):
            pb.validate_job({"id":"tap1","steps":[{"op":"tap","x":.5,"y":.8}]})
    def test_no_arbitrary_execution(self):
        for op in ('shell','install','unlock','text','grant_permission','adb','eval'):
            with self.assertRaises(ValueError):
                pb.validate_job({"id":"bad1","target_package":"org.blender.test","steps":[{"op":op}]})
    def test_untrusted_coordinates(self):
        for x in ('0.5', -0.1, 1.1, None, True, []):
            with self.assertRaises(ValueError):
                pb.validate_job({"id":"bad1","target_package":"org.blender.test","steps":[{"op":"tap","x":x,"y":.5}]})
    def test_action_limit(self):
        with self.assertRaises(ValueError):
            pb.validate_job({"id":"bad1","target_package":"org.blender.test","steps":[{"op":"back"}]*9})
    def test_allowlist(self):
        with patch.object(pb,'config',return_value={"allowed_packages":["org.blender.test"]}), patch.object(pb,'foreground_package',return_value='com.android.settings'):
            with self.assertRaises(PermissionError):
                pb.authorized_foreground('org.blender.test')
    def test_not_armed(self):
        with patch.object(pb,'consent_active',return_value=False):
            with self.assertRaises(PermissionError):
                pb.step_execute({"op":"tap","x":.5,"y":.5},'org.blender.test')
    def test_safe_adb_argv(self):
        class R:
            stdout=b''
        with patch.object(pb.subprocess,'run',return_value=R()) as mock:
            pb.adb('shell','input','tap',123,45)
            args=mock.call_args.args[0]
            self.assertEqual(args,['adb','shell','input','tap','123','45'])
    def test_private_report_denies_public(self):
        with patch.object(pb,'private_repo_request',return_value={'private':False}):
            with self.assertRaises(PermissionError):
                pb.upload_private('owner/public','latest.png',Path(__file__),'fake')
    def test_fail_after_partial_input_does_not_repeat(self):
        job={"id":"half-done","target_package":"org.blender.test","steps":[{"op":"tap","x":.5,"y":.5},{"op":"back"}]}
        fake_st={"armed_until":10000000000,"completed":[],"last_result":None}
        with patch.object(pb,'state',return_value=fake_st),patch.object(pb,'json_load',return_value={"completed":[]}),patch.object(pb,'config',return_value={"allowed_packages":["org.blender.test"]}),patch.object(pb,'authorized_foreground'),patch.object(pb,'step_execute',side_effect=[{'tap':[100,100]},RuntimeError('lost focus')]),patch.object(pb,'json_save') as save:
            r=pb.run_job(job,capture=False)
            self.assertFalse(r['ok'])
            self.assertIn('half-done',save.call_args.args[1]['completed'])
            self.assertEqual(save.call_count,1)

if __name__ == '__main__':
    main()