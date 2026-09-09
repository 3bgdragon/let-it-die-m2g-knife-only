"""Small fail-closed UE3 decoder for the exact instructions used by this patch.

Serialized object references are 4 bytes, runtime references are 8 bytes.
Jump targets use runtime positions, not serialized byte offsets.
"""
import struct


def inspect(code):
    cursor = 0
    memory = 0
    jumps = []
    boundaries = set()

    def take(count, runtime=None):
        nonlocal cursor, memory
        if cursor + count > len(code):
            raise ValueError('Truncated bytecode')
        data = code[cursor:cursor + count]
        cursor += count
        memory += count if runtime is None else runtime
        return data

    def expression():
        boundaries.add(memory)
        token = take(1)[0]
        if token in (0x00, 0x01, 0x3A):
            take(4, 8)
        elif token in (0x06, 0x07):
            at = cursor
            destination = struct.unpack('<H', take(2))[0]
            jumps.append((at, destination))
            if token == 0x07:
                expression()
        elif token in (0x0F, 0x14):
            expression()
            expression()
        elif token in (0x04, 0x2D):
            expression()
        elif token == 0x19:
            expression()
            skip = struct.unpack('<H', take(2))[0]
            take(4, 8)
            take(1)
            start = memory
            expression()
            if memory - start != skip:
                raise ValueError('Context skip-size mismatch')
        elif token == 0x18:
            take(2)  # UE boolean short-circuit skip, not an absolute jump.
            expression()
        elif token == 0x2E:
            take(4, 8)
            expression()
        elif token == 0x2C:
            take(1)
        elif token in (0x1B, 0x77, 0x82, 0x9A, 0xF2):
            if token == 0x1B:
                take(8)  # FName stays eight bytes in both layouts.
            while cursor < len(code) and code[cursor] != 0x16:
                expression()
            if take(1) != b'\x16':
                raise ValueError('Missing call terminator')
        elif token not in (0x0B, 0x25, 0x26, 0x27, 0x28, 0x2A, 0x53):
            raise ValueError(f'Unsupported bytecode token {token:02x}')

    while cursor < len(code):
        expression()
    boundaries.add(memory)
    for _, destination in jumps:
        if destination not in boundaries:
            raise ValueError(f'Jump to non-instruction boundary {destination}')
    return memory, jumps


def instance(ref):
    return b'\x01' + struct.pack('<I', ref)


def call(name, arguments=b''):
    return b'\x1b' + struct.pack('<II', name, 0) + arguments + b'\x16'


def context(ref, body):
    memory, _ = inspect(body)
    return b'\x19' + instance(ref) + struct.pack('<HIB', memory, 0, 0) + body


def player_prefix():
    # if (BrgPawn_CustomCharaPlayer(mPawn) != None) { ...; return; }
    condition = b'\x77\x2e' + struct.pack('<I', 53632) + instance(9431) + b'\x2a\x16'
    statements = b'\x0f' + instance(9325) + b'\x2c\x02'  # attack type = knife
    # Existing no-aim code uses 6 as "no previously fired bullet". Preserve
    # IsCanFireRedNapalmGun itself; the player branch simply leaves no lock.
    statements += context(9428, call(62614, b'\x2c\x06'))
    statements += call(57693)  # PlayAnimShot: knife animation / projectile notify
    statements += call(59818)  # ReflectAtkUpSkill, same as original
    statements += b'\x04\x0b'
    # Decode with a temporary jump to script start, then use the exact length.
    prefix = b'\x07\x00\x00' + condition + statements
    memory, _ = inspect(prefix)
    return prefix[:1] + struct.pack('<H', memory) + prefix[3:], memory


def patch_play_shot(original):
    memory, size = struct.unpack_from('<II', original, 0x28)
    code = original[0x30:0x30 + size]
    measured, jumps = inspect(code)
    if measured != memory or code[-1:] != b'\x53':
        raise ValueError('Original script serialization mismatch')
    prefix, extra_memory = player_prefix()
    relocated = bytearray(code)
    for offset, target in jumps:
        struct.pack_into('<H', relocated, offset, target + extra_memory)
    new_code = prefix + relocated
    result_memory, _ = inspect(new_code)
    if result_memory != memory + extra_memory:
        raise ValueError('Patched script serialization mismatch')
    header = bytearray(original[:0x30])
    struct.pack_into('<II', header, 0x28, result_memory, len(new_code))
    return bytes(header) + new_code + original[0x30 + size:]
