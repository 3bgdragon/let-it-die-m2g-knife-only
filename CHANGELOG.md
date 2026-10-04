# 변경 기록

## 1.5.2-rc.1 / TFC 1.2.0-rc.1 — 2026-10-04

- Preserve reviewed independent UPK instruction edits and Nico file-check OFF entries; reject owned-byte/native conflicts before writes.
- Add game-specific TFC preparation, all-function post-install proofs, explicit backed-up block-layout repair and interruption recovery.
- Add selected recorded guard/M2G recovery and prevent preparation/detach with pending recovery journals or mixed installation modes.
- Publish standalone and TFC ZIPs separately; exclude experimental manager prototypes and game/save binaries.
- Actual Nico/TFC engine and disposable-copy tests passed. GUI/live gameplay retesting remains pending; prerelease, not universal compatibility.


## 1.5.1-dev — 2026-10-02

- 자동 탐색 실패 시 설치 폴더 또는 EXE 경로를 직접 입력하고 재시도할 수 있습니다.
- 검증된 Steam 빌드 25386710에서 전체 EXE 해시만으로 거부하지 않고 PE 구조와 패치 의존 구간을 확인합니다. 무관한 변경은 보존하며 실제 충돌은 차단합니다.
- 외부 EXE 변경 보존, 경로 입력 및 공통 처리부 회귀 테스트를 추가했습니다.

## 1.5.0-dev — 2026-09-30

- 빌드 25386710의 공통 합성 처리: 검증된 자판기 레이어를 임시 분리하고 M2G만 변경 후 재합성. 워프·가드·자판기 보존.
- 다른 저장소나 Python 없이 ZIP에 동일한 Node.js 처리부 포함. 네 도구를 함께 업데이트.
- 게임 폴더 `LID-Mod-State`의 공통 백업·복원 지원, 활성 레이어를 덮어쓰는 구형 전체 복원 차단.
- 이미 검증된 M2G 적용본 재적용을 파일 변경·새 백업 없이 생략. 동일 상태 확인 중 실행/외부 변경도 감지.
- 개발 시험판: 복사본 적용·선택 제거 및 안전성 시험. 새 경로의 실게임 검증은 별도 필요.

## 1.4.0 — 2026-09-19

- Steam 빌드 25386710 대응 추가: 새 패키지 레이아웃(Export 개수 173671, 함수/오브젝트 인덱스 변경) 지원.
- 25386710의 BrgGame 순정 및 워프·저스트가드 조합 8종 프로필을 추가하여 상태 인식, 적용, 선택 제거(4번) 지원.
- 기존 빌드(25136512, 25244463)와의 하위 호환성 유지.

## 1.2.0 — 2026-09-11

- 메뉴 4번 / `remove`: 현재 워프·가드를 유지하면서 M2G만 제거. 제거 직전 자동 백업 및 트랜잭션 검증 유지.
- 구 M2G v1.0.0 파일 8종을 추가해 신·구 16개 조합의 상태 인식과 선택 제거 지원.
- 워프 제거 후 전체 백업 복원이 차단되는 경우 선택 제거 기능을 안내. 전체 복원 안전장치는 유지.
- 권한 오류가 아닌 경우 불필요한 관리자 권한 안내를 표시하지 않도록 수정.

## 1.1.1 — 2026-09-11

- M2G → 워프 순서로 적용하면 백업의 전체 해시와 달라져 상태 확인이 실패하던 문제 수정.
- 알려진 순정/저스트가드/워프 조합 8개의 SHA-256과 EXE 해시 연결로 읽기 전용 상태 인식 추가.
- 현재 파일과 일치하는 적용 백업이 없을 때 명시적으로 안내. 외부 변경을 덮어쓰지 않는 기존 복원 차단 유지.
- 패치 생성 결과는 변경하지 않으며 최신 워프툴의 적용 순서 호환 안내 반영.

## 1.1.0 — 2026-09-10

- 기존 멀티툴·워프·저스트가드 도구와 실행 방법을 통일하기 위해 Node.js 전용으로 전환. Python/pip/가상환경 설치 제거.
- MIT 라이선스 순수 JavaScript LZO 코드를 포함해 `npm install` 없이 `run.bat`만으로 실행.
- 사용자 실게임 검증을 마친 나이프 패치의 바이트코드·AI 분기·다른 패치 보존 방식 유지.
- 이전 Python 버전의 백업 기록 형식을 유지해 기존 적용 상태 인식 및 복원 지원.
- 코드·트랜잭션 테스트를 Node.js로 이식하고 독립 Python 검증기는 개발 전용 폴더로 분리.
- 압축 블록 크기 검증과 실행기 오류 종료 코드 전달 보강. `setup.bat`은 별도 설치 없이 실행기로 연결.

## 1.0.0 — 2026-09-10

- 사용자 실게임 정상 작동 확인 후 정식 버전으로 전환.
- 시험판/실게임 미검증 표시를 갱신하고 `--version` 명령 추가.
- 나이프 고정·연속 사격·AI 분리·백업 복원 로직은 검증한 시험판과 동일하게 유지.
- 룰렛 그림 회전, 레이지 제외, 저스트가드·워프 도구 변경 전 복원 등 호환성 안내 유지.
- 설치 가상환경을 사용하는 명령줄 예시 정리.

## 0.1.0 — 2026-09-10

- 플레이어 M2G 일반 사격을 나이프로 고정하는 독립 패치 도구 구현.
- 스크립트 직렬화 길이·점프 검증과 UPK/EXE 백업·복원, 충돌 차단 추가.
