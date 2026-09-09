"""LET IT DIE M2G player knife-only mode; local offline game only."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

from package_patch import build, link_executable, sha

ROOT = Path(__file__).resolve().parent
VERSION = '1.0.0'
FILES = {'upk': 'BrgGame/CookedPCConsole/BrgGame.upk', 'exe': 'Binaries/Win64/BrgGame-Steam.exe'}


def game_running():
    result = subprocess.run(['tasklist.exe', '/FO', 'CSV', '/NH'], capture_output=True, check=True)
    return b'brggame-steam.exe' in result.stdout.lower()


def read_pair(game):
    return {key: (game / relative).read_bytes() for key, relative in FILES.items()}


def hashes(pair):
    return {key: sha(data) for key, data in pair.items()}


def build_pair(pair):
    upk = build(pair['upk'])
    return {'upk': upk, 'exe': link_executable(pair['exe'], pair['upk'], upk)}


def save_record(folder, record):
    pending = folder / ('record-' + uuid.uuid4().hex + '.pending')
    with pending.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, ensure_ascii=False, indent=2)
    pending.replace(folder / 'record.json')


def replace_pair(game, before, after, replace=os.replace, running=game_running):
    if running():
        raise ValueError('게임을 완전히 종료하세요.')
    if hashes(read_pair(game)) != hashes(before):
        raise ValueError('작업 중 게임 파일이 변경됐습니다.')
    suffix = '.m2g-' + uuid.uuid4().hex + '.tmp'
    staged = {}
    installed = []
    try:
        for key, relative in FILES.items():
            temporary = Path(str(game / relative) + suffix)
            with temporary.open('xb') as stream:
                stream.write(after[key])
                stream.flush()
                os.fsync(stream.fileno())
            staged[key] = temporary
            if sha(temporary.read_bytes()) != sha(after[key]):
                raise ValueError('임시 파일 검증 실패')
        if running() or hashes(read_pair(game)) != hashes(before):
            raise ValueError('설치 직전 게임 실행/파일 변경 감지')
        for key, relative in FILES.items():
            replace(staged[key], game / relative)
            installed.append(key)
        if hashes(read_pair(game)) != hashes(after):
            raise ValueError('설치 후 검증 실패')
    except Exception:
        # Roll back only files replaced by this transaction. Unknown externally
        # modified data is never silently overwritten.
        for key in reversed(installed):
            destination = game / FILES[key]
            if sha(destination.read_bytes()) != sha(after[key]):
                raise RuntimeError('외부 파일 변경: 자동 복원 중단. 전용 백업을 보존했습니다.')
            rollback = Path(str(destination) + suffix + '.rollback')
            with rollback.open('xb') as stream:
                stream.write(before[key])
            os.replace(rollback, destination)
        raise
    finally:
        for temporary in staged.values():
            if temporary.exists():
                temporary.unlink()


def apply(game, backup_root, running=game_running):
    if running():
        raise ValueError('게임을 완전히 종료하세요.')
    before = read_pair(game)
    after = build_pair(before)
    folder = backup_root / (time.strftime('%Y%m%d-%H%M%S-') + str(time.time_ns()) + '-' + uuid.uuid4().hex[:8])
    folder.mkdir(parents=True, exist_ok=False)
    for key, data in before.items():
        with (folder / (key + '.bak')).open('xb') as stream:
            stream.write(data)
        if sha((folder / (key + '.bak')).read_bytes()) != sha(data):
            raise ValueError('백업 검증 실패')
    record = {'version': 1, 'game': str(game.resolve()), 'state': 'prepared', 'before': hashes(before), 'after': hashes(after)}
    save_record(folder, record)
    replace_pair(game, before, after, running=running)
    record['state'] = 'applied'
    save_record(folder, record)
    return folder


def records(game, backup_root):
    result = []
    for file in sorted(backup_root.glob('*/record.json'), reverse=True):
        record = json.loads(file.read_text(encoding='utf-8'))
        if record.get('version') == 1 and os.path.normcase(record.get('game', '')) == os.path.normcase(str(game.resolve())):
            result.append((file.parent, record))
    return result


def restore(game, backup_root, running=game_running):
    if running():
        raise ValueError('게임을 완전히 종료하세요.')
    current = read_pair(game)
    candidates = records(game, backup_root)
    for folder, record in candidates:
        if record['state'] == 'restored':
            continue
        # A prepared record can recover an interrupted two-file installation.
        current_hashes = hashes(current)
        if not all(current_hashes[k] in (record['before'][k], record['after'][k]) for k in FILES):
            raise ValueError('패치 이후 다른 도구/업데이트가 파일을 변경했습니다. 전체 백업으로 덮어쓰지 않고 중단합니다.')
        original = {key: (folder / (key + '.bak')).read_bytes() for key in FILES}
        if hashes(original) != record['before']:
            raise ValueError('백업이 손상됐습니다.')
        replace_pair(game, current, original, running=running)
        record['state'] = 'restored'
        save_record(folder, record)
        return folder
    raise ValueError('이 게임 경로의 복원 가능한 전용 백업이 없습니다.')


def detect_game():
    steam_roots = [Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'Steam']
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Valve\Steam') as key:
            steam_roots.insert(0, Path(winreg.QueryValueEx(key, 'SteamPath')[0]))
    except (ImportError, OSError):
        pass
    roots = list(steam_roots)
    for steam in steam_roots:
        library = steam / 'steamapps/libraryfolders.vdf'
        if library.exists():
            roots.extend(Path(x.replace('\\\\', '\\')) for x in re.findall(r'"path"\s+"([^"]+)"', library.read_text(encoding='utf-8')))
    for root in roots:
        game = root / 'steamapps/common/LET IT DIE'
        if all((game / relative).is_file() for relative in FILES.values()):
            return game.resolve()
    return None


def main():
    parser = argparse.ArgumentParser(description=f'M2G 플레이어 나이프 전용 모드 {VERSION} 정식 버전')
    parser.add_argument('--version', action='version', version=VERSION)
    parser.add_argument('command', nargs='?', choices=['status', 'trial', 'apply', 'restore'])
    parser.add_argument('--game', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--yes', action='store_true')
    args = parser.parse_args()
    game = args.game or detect_game()
    if game is None and args.command is None:
        game = Path(input('LET IT DIE 설치 폴더: ').strip().strip('"'))
    if game is None:
        parser.error('--game 설치폴더를 지정하세요.')
    game = game.resolve()
    command = args.command
    backup_root = ROOT / 'backups'
    if command is None:
        print(f'\nM2G 나이프 전용 모드 {VERSION}\n게임: {game}')
        print('플레이어 일반 사격만 나이프로 변경. 레이지·AI·피해 배율·비용 유지.')
        print('조준 룰렛 그림은 그대로지만 실제 사격은 나이프입니다. 사용자 실게임 정상 작동 확인.')
        print('다른 UPK 패치 도구는 이 모드를 먼저 복원한 뒤 사용하세요.')
        print('1. 상태 확인\n2. 적용\n3. 전용 백업으로 복원\n0. 종료')
        choice = input('선택: ').strip()
        if choice == '0':
            return
        command = {'1': 'status', '2': 'apply', '3': 'restore'}.get(choice)
        if command is None:
            raise ValueError('잘못된 선택')
    if command == 'status':
        current = hashes(read_pair(game))
        active = any(record['after'] == current for _, record in records(game, backup_root))
        if active:
            print('나이프 전용 적용됨. 사용자 실게임 정상 작동 확인 버전입니다.')
        else:
            build_pair(read_pair(game))
            print('지원되는 M2G 함수/실행 파일 해시 연결 확인. 현재 미적용.')
    elif command == 'trial':
        if args.output is None:
            parser.error('trial은 --output 새 출력폴더가 필요합니다.')
        before = read_pair(game)
        after = build_pair(before)
        output = args.output.resolve()
        output.mkdir(parents=True, exist_ok=False)
        for key, data in after.items():
            (output / Path(FILES[key]).name).write_bytes(data)
        if hashes(read_pair(game)) != hashes(before):
            raise ValueError('검증 중 원본이 변경됐습니다.')
        print(f'복사본 생성 완료: {output}\n원본 게임은 변경하지 않았습니다.')
    else:
        if not args.yes and input('게임 종료 후 실행하세요. '+command+' 진행? (y/N): ').lower() not in ('y', 'yes'):
            return
        folder = apply(game, backup_root) if command == 'apply' else restore(game, backup_root)
        print(f'{command} 완료. 백업: {folder}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'오류: {error}\n파일 접근이 거부되면 터미널을 관리자 권한으로 실행하세요.')
        raise SystemExit(1)
