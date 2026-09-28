from flask import Blueprint, request
from flask_jwt_extended import current_user
from ..extensions import db
from ..models import User, ROLES
from ..utils import (ok, get_json, require_fields, roles_required, paginate, log_activity,
                     snapshot, ApiError, ADMIN)

bp = Blueprint("users", __name__)
FIELDS = ("name", "username", "email", "role", "division", "is_active")


def validate(data, user_id=None, creating=False):
    require_fields(data, "name", "username", "email", "role")
    if data["role"] not in ROLES:
        raise ApiError("Peran tidak valid", 422, {"role": "Tidak valid"})
    errors = {}
    uname, email = data["username"].strip().lower(), data["email"].strip().lower()
    q = User.query
    if user_id:
        q = q.filter(User.id != user_id)
    if q.filter(db.func.lower(User.username) == uname).first():
        errors["username"] = "Sudah digunakan"
    if q.filter(db.func.lower(User.email) == email).first():
        errors["email"] = "Sudah digunakan"
    if creating and len(data.get("password") or "") < 8:
        errors["password"] = "Minimal 8 karakter"
    if errors:
        raise ApiError("Periksa kembali data pengguna", 422, errors)
    return uname, email


def ensure_other_admin(user):
    others = User.query.filter(User.role == ADMIN, User.is_active.is_(True), User.id != user.id).count()
    if others == 0:
        raise ApiError("Sistem harus memiliki minimal satu Super Admin aktif", 422)


@bp.get("/users")
@roles_required(ADMIN)
def list_users():
    q = User.query
    if s := request.args.get("search"):
        like = f"%{s}%"
        q = q.filter(User.name.ilike(like) | User.username.ilike(like) | User.email.ilike(like))
    if role := request.args.get("role"):
        q = q.filter(User.role == role)
    if (status := request.args.get("status")) in ("active", "inactive"):
        q = q.filter(User.is_active.is_(status == "active"))
    data, meta = paginate(q.order_by(User.name))
    return ok(data, meta=meta)


@bp.post("/users")
@roles_required(ADMIN)
def create_user():
    data = get_json()
    uname, email = validate(data, creating=True)
    u = User()
    u.name = data["name"].strip()
    u.username = uname
    u.email = email
    u.role = data["role"]
    u.division = (data.get("division") or "").strip() or None
    u.set_password(data["password"])
    db.session.add(u)
    db.session.flush()
    log_activity("CREATE_USER", "user", u.id, new=snapshot(u, FIELDS))
    db.session.commit()
    return ok(u.to_dict(), "Pengguna ditambahkan", 201)


@bp.get("/users/<int:uid>")
@roles_required(ADMIN)
def get_user(uid):
    return ok(db.get_or_404(User, uid).to_dict())


@bp.put("/users/<int:uid>")
@roles_required(ADMIN)
def update_user(uid):
    u = db.get_or_404(User, uid)
    data = get_json()
    uname, email = validate(data, user_id=uid)
    if u.role == ADMIN and data["role"] != ADMIN:
        if u.id == current_user.id:
            raise ApiError("Anda tidak dapat menurunkan peran akun Anda sendiri", 422)
        ensure_other_admin(u)
    old = snapshot(u, FIELDS)
    u.name, u.username, u.email, u.role = data["name"].strip(), uname, email, data["role"]
    u.division = (data.get("division") or "").strip() or None
    action = "CHANGE_ROLE" if old["role"] != u.role else "UPDATE_USER"
    log_activity(action, "user", u.id, old=old, new=snapshot(u, FIELDS))
    db.session.commit()
    return ok(u.to_dict(), "Pengguna diperbarui")


@bp.patch("/users/<int:uid>/status")
@roles_required(ADMIN)
def toggle_status(uid):
    u = db.get_or_404(User, uid)
    active = bool(get_json().get("is_active"))
    if not active:
        if u.id == current_user.id:
            raise ApiError("Anda tidak dapat menonaktifkan akun Anda sendiri", 422)
        if u.role == ADMIN:
            ensure_other_admin(u)
    u.is_active = active
    log_activity("ACTIVATE_USER" if active else "DEACTIVATE_USER", "user", u.id)
    db.session.commit()
    return ok(u.to_dict(), "Akun diaktifkan" if active else "Akun dinonaktifkan")


@bp.post("/users/<int:uid>/reset-password")
@roles_required(ADMIN)
def reset_password(uid):
    u = db.get_or_404(User, uid)
    pwd = get_json().get("password") or ""
    if len(pwd) < 8:
        raise ApiError("Password minimal 8 karakter", 422, {"password": "Minimal 8 karakter"})
    u.set_password(pwd)
    u.failed_login_count, u.locked_until = 0, None
    log_activity("RESET_PASSWORD", "user", u.id)
    db.session.commit()
    return ok(message="Password berhasil direset")
