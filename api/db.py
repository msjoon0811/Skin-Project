"""SQLite 기반 분석 기록 + 회원 인증 저장.

테이블:
  users      id, email, password_hash, created_at
  sessions   token, user_id, created_at
  analyses   id, user_id, created_at, composite, skin_label, attributes
"""

import hashlib
import json
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent / "data" / "history.db"


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(str(_DB_PATH))
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT    NOT NULL UNIQUE,
                password_hash TEXT   NOT NULL,
                created_at   TEXT    NOT NULL
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token      TEXT    PRIMARY KEY,
                user_id    INTEGER NOT NULL,
                created_at TEXT    NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                created_at  TEXT    NOT NULL,
                composite   INTEGER NOT NULL,
                skin_label  TEXT    NOT NULL,
                attributes  TEXT    NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS user_diaries (
                id           TEXT    PRIMARY KEY,
                user_id      INTEGER NOT NULL,
                date         TEXT    NOT NULL,
                food         TEXT    NOT NULL,
                skin_effect  TEXT,
                notes        TEXT,
                created_at   TEXT    NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS user_notifications (
                id           TEXT    PRIMARY KEY,
                user_id      INTEGER NOT NULL,
                type         TEXT    NOT NULL,
                title        TEXT    NOT NULL,
                message      TEXT    NOT NULL,
                is_read      INTEGER DEFAULT 0,
                created_at   TEXT    NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS user_cosmetics (
                id           TEXT    PRIMARY KEY,
                user_id      INTEGER NOT NULL,
                status       TEXT    NOT NULL, -- 'using', 'wishlist', 'empty'
                name         TEXT    NOT NULL,
                brand        TEXT,
                created_at   TEXT    NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        # 기존 DB 마이그레이션
        for col_sql in [
            "ALTER TABLE analyses ADD COLUMN user_id INTEGER",
            "ALTER TABLE analyses ADD COLUMN full_data TEXT",
            "ALTER TABLE users ADD COLUMN nickname TEXT",
            "ALTER TABLE users ADD COLUMN settings_json TEXT",
            "ALTER TABLE users RENAME COLUMN email TO username",
        ]:
            try:
                con.execute(col_sql)
            except sqlite3.OperationalError:
                pass


# ── 인증 ──────────────────────────────────────────────────────────────

def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


def register_user(username: str, password: str) -> dict:
    """신규 가입 → {"id", "email"} 반환. 아이디 중복 시 ValueError."""
    salt = secrets.token_hex(16)
    pwd_hash = f"{salt}:{_hash_password(password, salt)}"
    with _conn() as con:
        try:
            cur = con.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?,?,?)",
                (username, pwd_hash, datetime.now().isoformat()),
            )
            return {"id": cur.lastrowid, "email": username}
        except sqlite3.IntegrityError:
            raise ValueError("이미 사용 중인 아이디입니다.")


def login_user(username: str, password: str) -> dict | None:
    """로그인 시도 → {"id", "email"} 또는 None."""
    with _conn() as con:
        row = con.execute(
            "SELECT id, username, password_hash FROM users WHERE username=?", (username,)
        ).fetchone()
    if not row:
        return None
    salt, stored = row["password_hash"].split(":", 1)
    if _hash_password(password, salt) != stored:
        return None
    return {"id": row["id"], "email": row["username"]}


def create_session(user_id: int) -> str:
    """세션 토큰 생성 → token 문자열 반환."""
    token = secrets.token_hex(32)
    with _conn() as con:
        con.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
            (token, user_id, datetime.now().isoformat()),
        )
    return token


def get_session_user(token: str) -> dict | None:
    """토큰 → {"id", "email"} 또는 None."""
    with _conn() as con:
        row = con.execute(
            """SELECT u.id, u.username AS email FROM users u
               JOIN sessions s ON s.user_id = u.id
               WHERE s.token=?""",
            (token,),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM sessions WHERE token=?", (token,))


def delete_user(user_id: int) -> None:
    """유저 및 관련된 모든 데이터(세션, 분석 기록, 위시리스트, 다이어리, 알림) 삭제."""
    with _conn() as con:
        con.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        con.execute("DELETE FROM analyses WHERE user_id=?", (user_id,))
        for tbl in ("wishlist", "diary", "notifications"):
            try:
                con.execute(f"DELETE FROM {tbl} WHERE user_id=?", (user_id,))
            except Exception:
                pass  # 테이블이 없을 경우 무시
        con.execute("DELETE FROM users WHERE id=?", (user_id,))


# ── 분석 기록 ──────────────────────────────────────────────────────────

def save_analysis(
    composite: int,
    skin_label: str,
    attributes: list[dict],
    user_id: int | None = None,
    full_data: str | None = None,
) -> int:
    now = datetime.now().strftime("%Y · %m · %d")
    with _conn() as con:
        cur = con.execute(
            "INSERT INTO analyses (user_id, created_at, composite, skin_label, attributes, full_data) VALUES (?,?,?,?,?,?)",
            (user_id, now, composite, skin_label, json.dumps(attributes, ensure_ascii=False), full_data),
        )
        return cur.lastrowid


def get_analysis_detail(analysis_id: int, user_id: int | None = None) -> dict | None:
    """분석 ID로 full_data 반환. user_id 전달 시 소유권 검증."""
    with _conn() as con:
        if user_id is not None:
            row = con.execute(
                "SELECT full_data FROM analyses WHERE id=? AND user_id=?",
                (analysis_id, user_id),
            ).fetchone()
        else:
            row = con.execute(
                "SELECT full_data FROM analyses WHERE id=? AND user_id IS NULL",
                (analysis_id,),
            ).fetchone()
    if not row or not row["full_data"]:
        return None
    return json.loads(row["full_data"])


def get_history(limit: int = 20, user_id: int | None = None) -> list[dict]:
    """최근 분석 기록 반환 (최신순). user_id 있으면 해당 유저만."""
    with _conn() as con:
        if user_id is not None:
            rows = con.execute(
                "SELECT id, created_at, composite, skin_label FROM analyses WHERE user_id=? ORDER BY id DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT id, created_at, composite, skin_label FROM analyses WHERE user_id IS NULL ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()

    result = []
    for i, row in enumerate(rows):
        prev = rows[i + 1]["composite"] if i + 1 < len(rows) else None
        delta = row["composite"] - prev if prev is not None else None
        result.append({
            "id":        row["id"],
            "date":      row["created_at"],
            "label":     f"피부 분석 #{row['id']}",
            "score":     row["composite"],
            "skinLabel": row["skin_label"],
            "delta":     (f"+{delta}" if delta >= 0 else str(delta)) if delta is not None else None,
            "up":        delta >= 0 if delta is not None else True,
        })
    return result


def delete_history(analysis_id: int, user_id: int | None = None) -> bool:
    """분석 기록 삭제. 삭제 성공 시 True 반환."""
    with _conn() as con:
        if user_id is not None:
            cur = con.execute("DELETE FROM analyses WHERE id=? AND user_id=?", (analysis_id, user_id))
        else:
            cur = con.execute("DELETE FROM analyses WHERE id=?", (analysis_id,))
        return cur.rowcount > 0

# ── 식단 일기 ──────────────────────────────────────────────────────────

def add_diary(id: str, user_id: int, date: str, food: str, skin_effect: str | None, notes: str | None) -> None:
    now = datetime.now().isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO user_diaries (id, user_id, date, food, skin_effect, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (id, user_id, date, food, skin_effect, notes, now)
        )

def get_diaries(user_id: int) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT id, date, food, skin_effect, notes, created_at FROM user_diaries WHERE user_id=? ORDER BY date DESC, created_at DESC",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def delete_diary(id: str, user_id: int) -> bool:
    with _conn() as con:
        cur = con.execute("DELETE FROM user_diaries WHERE id=? AND user_id=?", (id, user_id))
        return cur.rowcount > 0

# ── 알림 ──────────────────────────────────────────────────────────

def add_notification(id: str, user_id: int, type: str, title: str, message: str, created_at: str = None) -> None:
    now = created_at if created_at else datetime.now().isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO user_notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (id, user_id, type, title, message, now)
        )

def get_notifications(user_id: int) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT id, type, title, message, is_read, created_at FROM user_notifications WHERE user_id=? ORDER BY created_at DESC, id DESC",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def mark_notifications_read(user_id: int) -> None:
    with _conn() as con:
        con.execute("UPDATE user_notifications SET is_read=1 WHERE user_id=? AND is_read=0", (user_id,))

def delete_notification(id: str, user_id: int) -> bool:
    with _conn() as con:
        cur = con.execute("DELETE FROM user_notifications WHERE id=? AND user_id=?", (id, user_id))
        return cur.rowcount > 0

# ── 유저 관리 ──────────────────────────────────────────────────────────

def update_user_info(user_id: int, nickname: str | None = None, settings_json: str | None = None) -> None:
    updates = []
    params = []
    if nickname is not None:
        updates.append("nickname=?")
        params.append(nickname)
    if settings_json is not None:
        updates.append("settings_json=?")
        params.append(settings_json)
    
    if updates:
        params.append(user_id)
        sql = "UPDATE users SET " + ", ".join(updates) + " WHERE id=?"
        with _conn() as con:
            con.execute(sql, tuple(params))

def get_user_by_id(user_id: int) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT id, email, nickname, settings_json, created_at FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(row) if row else None

import uuid


# ── 위시리스트 (Wishlist) ────────────────────────────────────────────────

def add_wishlist(user_id: int, item_type: str, title: str, subtitle: str | None = None) -> str:
    import uuid
    from datetime import datetime
    item_id = str(uuid.uuid4())
    with _conn() as con:
        # user_cosmetics 테이블 재사용: status -> item_type ('product', 'treatment'), name -> title, brand -> subtitle
        con.execute(
            "INSERT INTO user_cosmetics (id, user_id, status, name, brand, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (item_id, user_id, item_type, title, subtitle, datetime.now().isoformat())
        )
    return item_id

def get_wishlist(user_id: int) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT id, status as item_type, name as title, brand as subtitle, created_at FROM user_cosmetics WHERE user_id=? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def delete_wishlist(item_id: str, user_id: int) -> bool:
    with _conn() as con:
        cur = con.execute(
            "DELETE FROM user_cosmetics WHERE id=? AND user_id=?",
            (item_id, user_id)
        )
        return cur.rowcount > 0
