from datetime import datetime, timedelta
from flask import Blueprint, current_app
from flask_jwt_extended import (create_access_token, create_refresh_token, jwt_required,
                                get_jwt, get_jwt_identity, current_user)
from ..extensions import db
from ..models import User, TokenBlocklist
from ..utils import ok, fail, get_json, require_fields, roles_required, log_activity, ApiError

bp = Blueprint("auth", __name__)


def tokens_for(user):
    identity = str(user.id)
    claims = {"role": user.role}
    return {
        "access_token": create_access_token(identity=identity, additional_claims=claims),
        "refresh_token": create_refresh_token(identity=identity),
        "user": user.to_dict(),
    }


@bp.post("/auth/login")
def login():
    data = get_json()
    require_fields(data, "username", "password")
    login_id = data["username"].strip().lower()
    user = User.query.filter(
        (db.func.lower(User.username) == login_id) | (db.func.lower(User.email) == login_id)).first()

    if user and user.locked_until and user.locked_until > datetime.utcnow():
        minutes = int((user.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        return fail(f"Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam {minutes} menit.", 423)

    if not user or not user.check_password(data["password"]):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= current_app.config["MAX_LOGIN_ATTEMPTS"]:
                user.locked_until = datetime.utcnow() + timedelta(minutes=current_app.config["LOCK_MINUTES"])
                user.failed_login_count = 0
            db.session.commit()
        return fail("Username/email atau password salah", 401)

    if not user.is_active:
        return fail("Akun Anda dinonaktifkan. Hubungi Super Admin.", 403)

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    log_activity("LOGIN", "user", user.id, user_id=user.id)
    db.session.commit()
    return ok(tokens_for(user), "Login berhasil")


@bp.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active:
        return fail("Sesi tidak valid", 401)
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return ok({"access_token": token, "user": user.to_dict()})


@bp.post("/auth/logout")
@jwt_required(verify_type=False)
def logout():
    db.session.add(TokenBlocklist(jti=get_jwt()["jti"]))
    db.session.commit()
    return ok(message="Logout berhasil")


@bp.get("/auth/me")
@roles_required()
def me():
    return ok(current_user.to_dict())


@bp.put("/auth/me")
@roles_required()
def update_me():
    data = get_json()
    require_fields(data, "name", "email")
    email = data["email"].strip().lower()
    if User.query.filter(User.email == email, User.id != current_user.id).first():
        raise ApiError("Email sudah digunakan", 409, {"email": "Sudah digunakan"})
    current_user.name = data["name"].strip()
    current_user.email = email
    current_user.division = (data.get("division") or "").strip() or None
    log_activity("UPDATE_PROFILE", "user", current_user.id)
    db.session.commit()
    return ok(current_user.to_dict(), "Profil diperbarui")


@bp.put("/auth/change-password")
@roles_required()
def change_password():
    data = get_json()
    require_fields(data, "old_password", "new_password")
    if not current_user.check_password(data["old_password"]):
        raise ApiError("Password lama salah", 422, {"old_password": "Password lama salah"})
    if len(data["new_password"]) < 8:
        raise ApiError("Password baru minimal 8 karakter", 422, {"new_password": "Minimal 8 karakter"})
    current_user.set_password(data["new_password"])
    log_activity("CHANGE_PASSWORD", "user", current_user.id)
    db.session.commit()
    return ok(message="Password berhasil diubah")
