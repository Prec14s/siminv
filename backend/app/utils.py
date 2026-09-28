from datetime import date, datetime
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from .extensions import db
from .models import ActivityLog, Notification, User


class ApiError(Exception):
    def __init__(self, message, status=400, errors=None):
        super().__init__(message)
        self.message, self.status, self.errors = message, status, errors


def ok(data=None, message="Berhasil", status=200, meta=None):
    body = {"success": True, "message": message, "data": data}
    if meta is not None:
        body["meta"] = meta
    return jsonify(body), status


def fail(message, status=400, errors=None):
    return jsonify({"success": False, "message": message, "errors": errors}), status


def roles_required(*roles):
    """Wajib login. Jika roles diisi, peran pengguna harus salah satunya."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if current_user is None or not current_user.is_active:
                return fail("Sesi tidak valid atau akun dinonaktifkan", 401)
            if roles and current_user.role not in roles:
                return fail("Anda tidak memiliki akses ke fitur ini", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


ADMIN = "super_admin"
STAFF = "staff"
MANAGERS = (ADMIN, STAFF)


def get_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Body request harus berupa JSON")
    return data


def require_fields(data, *fields):
    missing = {f: "Wajib diisi" for f in fields if data.get(f) in (None, "", [])}
    if missing:
        raise ApiError("Data belum lengkap", 422, missing)


def to_int(value, field, minimum=None):
    try:
        v = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{field} harus berupa angka", 422, {field: "Harus berupa angka"})
    if minimum is not None and v < minimum:
        raise ApiError(f"{field} minimal {minimum}", 422, {field: f"Minimal {minimum}"})
    return v


def parse_date(value, field="tanggal", required=True):
    if not value:
        if required:
            raise ApiError(f"{field} wajib diisi", 422, {field: "Wajib diisi"})
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise ApiError(f"Format {field} tidak valid (YYYY-MM-DD)", 422)


def paginate(query, serializer=lambda x: x.to_dict()):
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 10, type=int), 1), 100)
    p = query.paginate(page=page, per_page=per_page, error_out=False)
    meta = {"page": p.page, "per_page": p.per_page, "total": p.total, "pages": p.pages}
    return [serializer(i) for i in p.items], meta


def log_activity(action, entity=None, entity_id=None, old=None, new=None, user_id=None):
    try:
        uid = user_id or (current_user.id if current_user else None)
    except Exception:
        uid = user_id
    db.session.add(ActivityLog(
        user_id=uid, action=action, entity=entity, entity_id=entity_id,
        old_data=old, new_data=new,
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
    ))


def notify(user_ids, title, message=None, link=None):
    for uid in set(user_ids):
        db.session.add(Notification(user_id=uid, title=title, message=message, link=link))


def notify_roles(roles, title, message=None, link=None, exclude=None):
    ids = [u.id for u in User.query.filter(User.role.in_(roles), User.is_active.is_(True)).all()
           if u.id != exclude]
    notify(ids, title, message, link)


def generate_number(model, column, prefix, on_date=None):
    d = on_date or date.today()
    base = f"{prefix}-{d:%Y%m%d}-"
    last = (db.session.query(column).filter(column.like(f"{base}%"))
            .order_by(column.desc()).first())
    seq = int(last[0].rsplit("-", 1)[1]) + 1 if last else 1
    return f"{base}{seq:03d}"


def snapshot(obj, fields):
    out = {}
    for f in fields:
        v = getattr(obj, f, None)
        if isinstance(v, (date, datetime)):
            v = v.isoformat()
        elif hasattr(v, "is_finite"):  # Decimal
            v = float(v)
        out[f] = v
    return out
