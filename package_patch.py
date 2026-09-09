"""Build-specific, logical UPK patch. Contains no shipped game payload."""
import hashlib
import math
import struct
import lzokay
from bytecode import patch_play_shot

TAG = 0x9E2A83C1
PLAY_OFFSET, PLAY_SIZE = 0xFFC020, 0xF4
PLAY_HASH = 'd1700b21bef4f3b9933e5f5f7382209775d086219defaa44dc9d7d0e510a859d'
CHECK_OFFSET, CHECK_SIZE = 0x12CC5D2, 0x94
CHECK_HASH = '46f89feed0c8bd0577bcca550071a590a29abcf5407ee178a37f600c27ebc7a2'
EXPORT_SLOT = 0x3CF64B


def sha(data):
    return hashlib.sha256(data).hexdigest()


def entries(data):
    if len(data) < 0x75 or struct.unpack_from('<I', data)[0] != TAG:
        raise ValueError('Not a UE3 package')
    if struct.unpack_from('<I', data, 0x6D)[0] != 2:
        raise ValueError('Expected LZO package')
    count = struct.unpack_from('<I', data, 0x71)[0]
    if count != 286 or struct.unpack_from('<I', data, 0x21)[0] != 173666:
        raise ValueError('Unsupported game build (expected 25136512 layout)')
    result = [struct.unpack_from('<IIII', data, 0x75 + i * 16) for i in range(count)]
    last_end = None
    for logical, size, physical, packed in result:
        if size <= 0 or physical + packed > len(data) or packed < 16:
            raise ValueError('Invalid compressed chunk range')
        if last_end is not None and logical != last_end:
            raise ValueError('Non-contiguous logical package')
        last_end = logical + size
    return result


def unpack(data, entry):
    _, expected, offset, packed_size = entry
    tag, block, _, total = struct.unpack_from('<IIII', data, offset)
    if tag != TAG or total != expected or block < 1 or block > 1048576:
        raise ValueError('Invalid LZO header')
    count = math.ceil(total / block)
    cursor = offset + 16 + count * 8
    out = bytearray()
    for index in range(count):
        length, raw_size = struct.unpack_from('<II', data, offset + 16 + index * 8)
        if raw_size != min(block, total - len(out)) or cursor + length > offset + packed_size:
            raise ValueError('Invalid LZO block size')
        payload = data[cursor:cursor + length]
        decoded = payload if length == raw_size else lzokay.decompress(payload, raw_size)
        if len(decoded) != raw_size:
            raise ValueError('Invalid decompressed size')
        out.extend(decoded)
        cursor += length
    if cursor != offset + packed_size:
        raise ValueError('Unexpected compressed trailing data')
    return bytes(out)


def pack(raw, block=131072):
    blocks = []
    for offset in range(0, len(raw), block):
        piece = bytes(raw[offset:offset + block])
        compressed = lzokay.compress(piece)
        blocks.append((compressed if len(compressed) < len(piece) else piece, len(piece)))
    return (struct.pack('<IIII', TAG, block, sum(len(x) for x, _ in blocks), len(raw))
            + b''.join(struct.pack('<II', len(x), n) for x, n in blocks)
            + b''.join(x for x, _ in blocks))


def read_at(data, table, offset, size):
    for index, entry in enumerate(table):
        logical, length, _, _ = entry
        if logical <= offset and offset + size <= logical + length:
            raw = unpack(data, entry)
            return index, raw, raw[offset - logical:offset - logical + size]
    raise ValueError('Requested object crosses chunk boundary')


def build(source):
    table = entries(source)
    _, _, original = read_at(source, table, PLAY_OFFSET, PLAY_SIZE)
    _, _, check = read_at(source, table, CHECK_OFFSET, CHECK_SIZE)
    if sha(original) != PLAY_HASH or sha(check) != CHECK_HASH:
        raise ValueError('Unsupported or modified M2G functions; no files changed')
    first, export_chunk, slot = read_at(source, table, EXPORT_SLOT + 32, 8)
    if slot != struct.pack('<II', PLAY_SIZE, PLAY_OFFSET):
        raise ValueError('PlayShot export already relocated or unsupported')
    replacement = patch_play_shot(original)
    final_index = len(table) - 1
    logical, size, _, _ = table[final_index]
    new_offset = logical + size
    final = unpack(source, table[final_index]) + replacement
    export_chunk = bytearray(export_chunk)
    struct.pack_into('<II', export_chunk, EXPORT_SLOT + 32 - table[first][0], len(replacement), new_offset)
    out = bytearray(source)
    # Append replacement chunks. Existing source bytes, including old PlayShot,
    # remain intact. Only these two directory records point to new chunks.
    for index, raw in [(first, export_chunk), (final_index, final)]:
        compressed = pack(raw)
        physical = len(out)
        out.extend(compressed)
        struct.pack_into('<IIII', out, 0x75 + index * 16, table[index][0], len(raw), physical, len(compressed))
    out = bytes(out)
    updated = entries(out)
    _, _, actual = read_at(out, updated, new_offset, len(replacement))
    if actual != replacement:
        raise ValueError('Patched package verification failed')
    return out


def link_executable(source, before, after):
    if source[:2] != b'MZ':
        raise ValueError('Not a Windows executable')
    needle = b'brggame.upk\0'
    locations = []
    cursor = 0
    while True:
        position = source.find(needle, cursor)
        if position < 0:
            break
        locations.append(position + len(needle))
        cursor = position + len(needle)
    if len(locations) != 2:
        raise ValueError('Unexpected executable manifest entry count')
    old_hash, new_hash = hashlib.sha1(before).digest(), hashlib.sha1(after).digest()
    result = bytearray(source)
    for offset in locations:
        if source[offset:offset + 20] != old_hash:
            raise ValueError('Executable package hash does not match')
        result[offset:offset + 20] = new_hash
    return bytes(result)
