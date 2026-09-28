from flask import Blueprint, request
from flask_jwt_extended import current_user
from ..extensions import db
from ..models import Notification, ActivityLog, Setting, DEFAULT_SETTINGS
from ..utils import ok, get_json, roles_required, paginate, log_activity, parse_date, ApiError, ADMIN

bp = Blueprint("misc", __name__)


# ---------- Notifikasi ----------
@bp.get("/notifications")
@roles_required()
def list_notifications():
    q = Notification.query.filter_by(user_id=current_user.id)
    if request.args.get("unread") == "1":
        q = q.filter_by(is_read=False)
    data, meta = paginate(q.order_by(Notification.created_at.desc()))
    meta["unread"] = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return ok(data, meta=meta)


@bp.patch("/notifications/<int:nid>/read")
@roles_required()
def read_notification(nid):
    n = Notification.query.filter_by(id=nid, user_id=current_user.id).first_or_404()
    n.is_read = True
    db.session.commit()
    return ok(n.to_dict())


@bp.patch("/notifications/read-all")
@roles_required()
def read_all():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return ok(message="Semua notifikasi ditandai sudah dibaca")


# ---------- Log aktivitas ----------
@bp.get("/activity-logs")
@roles_required(ADMIN)
def activity_logs():
    q = ActivityLog.query
    if uid := request.args.get("user_id", type=int):
        q = q.filter(ActivityLog.user_id == uid)
    if a := request.args.get("action"):
        q = q.filter(ActivityLog.action.ilike(f"%{a}%"))
    if d := request.args.get("date_from"):
        q = q.filter(db.func.date(ActivityLog.created_at) >= parse_date(d))
    if d := request.args.get("date_to"):
        q = q.filter(db.func.date(ActivityLog.created_at) <= parse_date(d))
    data, meta = paginate(q.order_by(ActivityLog.created_at.desc()))
    return ok(data, meta=meta)


# ---------- Pengaturan ----------
def all_settings():
    stored = {s.key: s.value for s in Setting.query.all()}
    return {k: stored.get(k, v) for k, v in DEFAULT_SETTINGS.items()}


@bp.get("/settings")
@roles_required()
def get_settings():
    return ok(all_settings())


@bp.put("/settings")
@roles_required(ADMIN)
def update_settings():
    data = get_json()
    old = all_settings()
    if "max_loan_days" in data:
        try:
            if int(data["max_loan_days"]) < 1:
                raise ValueError
        except (TypeError, ValueError):
            raise ApiError("Durasi peminjaman harus angka ≥ 1", 422, {"max_loan_days": "Minimal 1"})
    for key in DEFAULT_SETTINGS:
        if key in data:
            s = db.session.get(Setting, key) or Setting(key=key)
            s.value = str(data[key]).lower() if isinstance(data[key], bool) else str(data[key])
            db.session.add(s)
    db.session.flush()
    log_activity("UPDATE_SETTINGS", "settings", None, old=old, new=all_settings())
    db.session.commit()
    return ok(all_settings(), "Pengaturan disimpan")
