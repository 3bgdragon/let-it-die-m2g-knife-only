import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

import bytecode
import package_patch
import tool


class BytecodeTests(unittest.TestCase):
    def test_prefix_exact_lengths_and_player_gate(self):
        code, runtime = bytecode.player_prefix()
        self.assertEqual((len(code), runtime), (71, 91))
        self.assertEqual(bytecode.inspect(code), (91, [(1, 91)]))
        self.assertIn(b'\x0f' + bytecode.instance(9325) + b'\x2c\x02', code)
        self.assertIn(bytecode.call(62614, b'\x2c\x06'), code)
        self.assertIn(b'\x2e' + struct.pack('<I', 53632) + bytecode.instance(9431), code)

    def test_relocates_existing_npc_jump_and_counts_runtime_references(self):
        original_code = b'\x07\x05\x00\x27\x0b\x04\x0b\x53'
        memory, jumps = bytecode.inspect(original_code)
        original = bytearray(0x30)
        struct.pack_into('<II', original, 0x28, memory, len(original_code))
        original += original_code + b'function-trailer'
        changed = bytecode.patch_play_shot(original)
        mem, length = struct.unpack_from('<II', changed, 0x28)
        self.assertEqual(mem, memory + 91)
        self.assertEqual(length, len(original_code) + 71)
        self.assertEqual(bytecode.inspect(changed[0x30:0x30 + length])[1], [(1, 91), (72, 96)])
        self.assertTrue(changed.endswith(b'function-trailer'))

    def test_rejects_bad_tokens_truncation_context_and_jump(self):
        for code in (b'\x02', b'\x01', b'\x07\x02\x00\x27', b'\x19\x01\x01\x00\x00\x00\x02\x00\x00\x00\x00\x00\x00\x27\x0b'):
            with self.assertRaises(ValueError):
                bytecode.inspect(code)

    def test_pack_roundtrip_and_corruption(self):
        data = bytes(range(256)) * 1600
        packed = package_patch.pack(data)
        self.assertEqual(package_patch.unpack(packed, (0, len(data), 0, len(packed))), data)
        with self.assertRaises(ValueError):
            package_patch.unpack(packed, (0, len(data) + 1, 0, len(packed)))

    def test_executable_only_manifest_entries_change(self):
        import hashlib
        old, new = b'old upk', b'new upk'
        entry = b'brggame.upk\0'
        before = b'MZ data' + (entry + hashlib.sha1(old).digest() + b'keep-native-hooks') * 2
        result = package_patch.link_executable(before, old, new)
        expected = before.replace(hashlib.sha1(old).digest(), hashlib.sha1(new).digest())
        self.assertEqual(result, expected)
        with self.assertRaises(ValueError):
            package_patch.link_executable(before, b'wrong', new)


class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='lid-m2g-unit-')
        self.addCleanup(self.tmp.cleanup)
        self.game = Path(self.tmp.name) / 'game'
        self.backups = Path(self.tmp.name) / 'backups'
        self.before = {'upk': b'original with guard/warp', 'exe': b'MZ original hooks'}
        self.after = {'upk': b'patched with guard/warp', 'exe': b'MZ linked hooks'}
        for key, relative in tool.FILES.items():
            destination = self.game / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(self.before[key])

    def test_apply_restore_exact_backup(self):
        with patch.object(tool, 'build_pair', return_value=self.after):
            folder = tool.apply(self.game, self.backups, running=lambda: False)
        self.assertEqual(tool.read_pair(self.game), self.after)
        self.assertEqual((folder / 'upk.bak').read_bytes(), self.before['upk'])
        tool.restore(self.game, self.backups, running=lambda: False)
        self.assertEqual(tool.read_pair(self.game), self.before)
        self.assertEqual(json.loads((folder / 'record.json').read_text())['state'], 'restored')

    def test_second_file_failure_rolls_back_first(self):
        count = 0
        def failing(src, dst):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError('simulated executable lock')
            tool.os.replace(src, dst)
        with self.assertRaises(OSError):
            tool.replace_pair(self.game, self.before, self.after, replace=failing, running=lambda: False)
        self.assertEqual(tool.read_pair(self.game), self.before)
        self.assertFalse(list(self.game.rglob('*.tmp')))

    def test_running_or_concurrent_change_blocks_write(self):
        with self.assertRaises(ValueError):
            tool.replace_pair(self.game, self.before, self.after, running=lambda: True)
        self.assertEqual(tool.read_pair(self.game), self.before)
        (self.game / tool.FILES['exe']).write_bytes(b'new external modification')
        with self.assertRaises(ValueError):
            tool.replace_pair(self.game, self.before, self.after, running=lambda: False)
        self.assertEqual((self.game / tool.FILES['exe']).read_bytes(), b'new external modification')

    def test_restore_refuses_new_mod_and_bad_backup(self):
        with patch.object(tool, 'build_pair', return_value=self.after):
            folder = tool.apply(self.game, self.backups, running=lambda: False)
        (self.game / tool.FILES['exe']).write_bytes(b'external mod')
        with self.assertRaises(ValueError):
            tool.restore(self.game, self.backups, running=lambda: False)
        self.assertEqual((self.game / tool.FILES['exe']).read_bytes(), b'external mod')
        (self.game / tool.FILES['exe']).write_bytes(self.after['exe'])
        (folder / 'exe.bak').write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            tool.restore(self.game, self.backups, running=lambda: False)

    def test_interrupted_pair_is_recoverable(self):
        with patch.object(tool, 'build_pair', return_value=self.after):
            folder = tool.apply(self.game, self.backups, running=lambda: False)
        record = json.loads((folder / 'record.json').read_text())
        record['state'] = 'prepared'
        tool.save_record(folder, record)
        (self.game / tool.FILES['exe']).write_bytes(self.before['exe'])
        tool.restore(self.game, self.backups, running=lambda: False)
        self.assertEqual(tool.read_pair(self.game), self.before)


if __name__ == '__main__':
    unittest.main()
