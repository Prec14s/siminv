from flask import Blueprint, request
from ..extensions import db
from ..models import Category, Location, Unit, Supplier, Item
from ..utils import ok, get_json, require_fields, roles_required, paginate, log_activity, snapshot, ApiError, MANAGERS

bp = Blueprint("master", __name__)

MASTERS = {
    "categories": (Category, ("name", "description"), "category_id"),
    "locations": (Location, ("name", "description"), "location_id"),
    "units": (Unit, ("name",), "unit_id"),
    "suppliers": (Supplier, ("name", "contact", "phone", "address"), None),
}


def resolve(kind):
    if kind not in MASTERS:
        raise ApiError("Jenis master data tidak dikenal", 404)
    return MASTERS[kind]


def is_used(kind, obj):
    model, _, fk = MASTERS[kind]
    if fk:
        return db.session.query(Item.id).filter(getattr(Item, fk) == obj.id).first() is not None
    from ..models import StockTransaction
    return db.session.query(StockTransaction.id).filter_by(supplier_id=obj.id).first() is not None


@bp.get("/master/<kind>")
@roles_required()
def list_master(kind):
    model, _, _ = resolve(kind)
    q = model.query
    if s := request.args.get("search"):
        q = q.filter(model.name.ilike(f"%{s}%"))
    if request.args.get("active_only") == "1":
        q = q.filter(model.is_active.is_(True))
    q = q.order_by(model.name)
    if request.args.get("all") == "1":
        return ok([o.to_dict() for o in q.all()])
    data, meta = paginate(q)
    return ok(data, meta=meta)


@bp.post("/master/<kind>")
@roles_required(*MANAGERS)
def create_master(kind):
    model, fields, _ = resolve(kind)
    data = get_json()
    require_fields(data, "name")
    obj = model(**{f: (data.get(f) or "").strip() or None for f in fields})
    db.session.add(obj)
    db.session.flush()
    log_activity(f"CREATE_{kind.upper()}", kind, obj.id, new=snapshot(obj, fields))
    db.session.commit()
    return ok(obj.to_dict(), "Data ditambahkan", 201)


@bp.put("/master/<kind>/<int:oid>")
@roles_required(*MANAGERS)
def update_master(kind, oid):
    model, fields, _ = resolve(kind)
    obj = db.get_or_404(model, oid)
    data = get_json()
    require_fields(data, "name")
    old = snapshot(obj, fields + ("is_active",))
    for f in fields:
        setattr(obj, f, (data.get(f) or "").strip() or None)
    if "is_active" in data:
        obj.is_active = bool(data["is_active"])
    log_activity(f"UPDATE_{kind.upper()}", kind, obj.id, old=old, new=snapshot(obj, fields + ("is_active",)))
    db.session.commit()
    return ok(obj.to_dict(), "Data diperbarui")


@bp.delete("/master/<kind>/<int:oid>")
@roles_required(*MANAGERS)
def delete_master(kind, oid):
    model, fields, _ = resolve(kind)
    obj = db.get_or_404(model, oid)
    if is_used(kind, obj):
        obj.is_active = False
        log_activity(f"DEACTIVATE_{kind.upper()}", kind, obj.id)
        db.session.commit()
        return ok(obj.to_dict(), "Data sudah dipakai, sehingga hanya dinonaktifkan")
    log_activity(f"DELETE_{kind.upper()}", kind, obj.id, old=snapshot(obj, fields))
    db.session.delete(obj)
    db.session.commit()
    return ok(message="Data dihapus")
