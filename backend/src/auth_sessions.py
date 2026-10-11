import secrets
from threading import Lock


_sessions = {}
_sessions_lock = Lock()


def create_session(user_id, role):
    token = secrets.token_urlsafe(32)
    with _sessions_lock:
        _sessions[token] = {"user_id": user_id, "role": role}
    return token


def get_session(token):
    with _sessions_lock:
        session = _sessions.get(token)
        return dict(session) if session else None


def delete_session(token):
    with _sessions_lock:
        return _sessions.pop(token, None) is not None
