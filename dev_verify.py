"""Read-only comparison against an installed game; analysis outputs are local."""
import argparse
import json
import struct
from pathlib import Path
from package_patch import entries, unpack, EXPORT_SLOT, PLAY_OFFSET, PLAY_SIZE, read_at, link_executable, sha
from bytecode import patch_play_shot, inspect

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('patched', type=Path)
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--patched-exe', type=Path, required=True)
parser.add_argument('--normalized', type=Path)
args = parser.parse_args()
a, b = args.source.read_bytes(), args.patched.read_bytes()
old, new = entries(a), entries(b)
_, _, original = read_at(a, old, PLAY_OFFSET, PLAY_SIZE)
expected = patch_play_shot(original)
_, _, pointer = read_at(b, new, EXPORT_SLOT + 32, 8)
size, offset = struct.unpack('<II', pointer)
assert size == len(expected)
memory = None
for index, (left, right) in enumerate(zip(old, new)):
    before, after = unpack(a, left), unpack(b, right)
    if index == 0:
        desired = bytearray(before)
        struct.pack_into('<II', desired, EXPORT_SLOT + 32 - left[0], size, offset)
        assert after == desired
    elif index == len(old) - 1:
        assert after == before + expected
    else:
        assert after == before, f'Unrelated chunk {index} changed'
    if args.normalized:
        if memory is None:
            memory = bytearray(new[-1][0] + new[-1][1])
            memory[:new[0][0]] = b[:new[0][0]]
        memory[right[0]:right[0] + len(after)] = after
script_memory, script_size = struct.unpack_from('<II', expected, 0x28)
assert inspect(expected[0x30:0x30 + script_size])[0] == script_memory
assert link_executable(args.exe.read_bytes(), a, b) == args.patched_exe.read_bytes()
if args.normalized:
    # Removing the compression directory also moves the remaining summary
    # fields (PackageSource, additional-package list). Keep absolute tables.
    summary_tail = bytes(memory[0x75 + 16 * len(new):new[0][0]])
    memory[0x75:new[0][0]] = summary_tail + bytes(16 * len(new))
    struct.pack_into('<II', memory, 0x6D, 0, 0)
    args.normalized.write_bytes(memory)
print(json.dumps({'sourceSHA256': sha(a), 'patchedSHA256': sha(b), 'chunksCompared': len(old),
                  'changedExistingLogicalBytes': 8, 'appendedFunctionBytes': size,
                  'scriptDiskBytes': script_size, 'scriptRuntimeBytes': script_memory,
                  'unrelatedCodePreserved': True, 'executableOnlyTwoManifestDigestsChanged': True}, indent=2))
