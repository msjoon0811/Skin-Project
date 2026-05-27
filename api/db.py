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
                email        TEXT    NOT NULL UNIQUE,
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
        # 기존 DB 마이그레이션
        for col_sql in [
            "ALTER TABLE analyses ADD COLUMN user_id INTEGER",
            "ALTER TABLE analyses ADD COLUMN full_data TEXT",
        ]:
            try:
                con.execute(col_sql)
            except Exception:
                pass


# ── 인증 ──────────────────────────────────────────────────────────────

def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


def register_user(email: str, password: str) -> dict:
    """신규 가입 → {"id", "email"} 반환. 이메일 중복 시 ValueError."""
    salt = secrets.token_hex(16)
    pwd_hash = f"{salt}:{_hash_password(password, salt)}"
    with _conn() as con:
        try:
            cur = con.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?,?,?)",
                (email, pwd_hash, datetime.now().isoformat()),
            )
            return {"id": cur.lastrowid, "email": email}
        except sqlite3.IntegrityError:
            raise ValueError("이미 사용 중인 이메일입니다.")


def login_user(email: str, password: str) -> dict | None:
    """로그인 시도 → {"id", "email"} 또는 None."""
    with _conn() as con:
        row = con.execute(
            "SELECT id, email, password_hash FROM users WHERE email=?", (email,)
        ).fetchone()
    if not row:
        return None
    salt, stored = row["password_hash"].split(":", 1)
    if _hash_password(password, salt) != stored:
        return None
    return {"id": row["id"], "email": row["email"]}


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
            """SELECT u.id, u.email FROM users u
               JOIN sessions s ON s.user_id = u.id
               WHERE s.token=?""",
            (token,),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM sessions WHERE token=?", (token,))


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
                "SELECT full_data FROM analyses WHERE id=?",
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
                "SELECT id, created_at, composite, skin_label FROM analyses ORDER BY id DESC LIMIT ?",
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
