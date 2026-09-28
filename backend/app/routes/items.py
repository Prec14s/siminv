import os
import uuid
from flask import Blueprint, request, current_app
from flask_jwt_extended import current_user
from ..extensions import db
from ..models import Item, Category, Location, Unit, StockTransactionItem, StockTransaction, RequestItem, Request, ITEM_TYPES
from ..utils import (ok, get_json, require_fields, roles_required, paginate, log_activity, snapshot,
                     to_int, ApiError, ADMIN, MANAGERS)
from ..services.stock import create_transaction

bp = Blueprint("items", __name__)
FIELDS = ("code", "name", "category_id", "location_id", "unit_id", "item_type", "min_stock", "price", "description")
ALLOWED_IMG = {"png", "jpg", "jpeg", "webp"}


def next_code():
    last = db.session.query(Item.code).filter(Item.code.like("BRG-%")).order_by(Item.code.desc()).first()
    try:
        n = int(last[0].split("-")[1]) + 1 if last else 1
    except (ValueError, IndexError):
        n = Item.query.count() + 1
    return f"BRG-{n:04d}"


def apply_filters(q, public=False):
    if s := request.args.get("search"):
        like = f"%{s}%"
        q = q.filter(Item.name.ilike(like) | Item.code.ilike(like))
    if cid := request.args.get("category_id", type=int):
        q = q.filter(Item.category_id == cid)
    if (t := request.args.get("item_type")) in ITEM_TYPES:
        q = q.filter(Item.item_type == t)
    if not public:
        if lid := request.args.get("location_id", type=int):
            q = q.filter(Item.location_id == lid)
    st = request.args.get("stock_status")
    if st == "out":
        q = q.filter(Item.stock <= 0)
    elif st == "low":
        q = q.filter(Item.stock > 0, Item.stock <= Item.min_stock)
    elif st == "ok":
        q = q.filter(Item.stock > Item.min_stock)
    elif st == "available":
        q = q.filter(Item.stock > 0)
    return q


def validate(data, item_id=None):
    require_fields(data, "name", "category_id", "location_id", "unit_id", "item_type")
    if data["item_type"] not in ITEM_TYPES:
        raise ApiError("Jenis barang tidak valid", 422, {"item_type": "Tidak valid"})
    for model, key in ((Category, "category_id"), (Location, "location_id"), (Unit, "unit_id")):
        if not db.session.get(model, to_int(data[key], key)):
            raise ApiError("Data referensi tidak ditemukan", 422, {key: "Tidak ditemukan"})
    code = (data.get("code") or "").strip().upper()
    if code:
        q = Item.query.filter(Item.code == code)
        if item_id:
            q = q.filter(Item.id != item_id)
        if q.first():
            raise ApiError("Kode barang sudah digunakan", 422, {"code": "Sudah digunakan"})
    try:
        price = float(data.get("price") or 0)
        if price < 0:
            raise ValueError
    except (TypeError, ValueError):
        raise ApiError("Harga tidak valid", 422, {"price": "Harus angka ≥ 0"})
    return {
        "code": code, "name": data["name"].strip(),
        "category_id": int(data["category_id"]), "location_id": int(data["location_id"]),
        "unit_id": int(data["unit_id"]), "item_type": data["item_type"],
        "min_stock": to_int(data.get("min_stock") or 0, "min_stock", 0),
        "price": price, "description": (data.get("description") or "").strip() or None,
    }


@bp.get("/items")
@roles_required(*MANAGERS)
def list_items():
    q = apply_filters(Item.query.filter(Item.is_deleted.is_(False)))
    sort = request.args.get("sort", "name")
    order = {"name": Item.name, "code": Item.code, "stock": Item.stock, "newest": Item.created_at.desc()}
    q = q.order_by(order.get(sort, Item.name))
    if request.args.get("all") == "1":
        return ok([i.to_dict() for i in q.all()])
    data, meta = paginate(q)
    return ok(data, meta=meta)


@bp.get("/items/next-code")
@roles_required(*MANAGERS)
def get_next_code():
    return ok({"code": next_code()})


@bp.post("/items")
@roles_required(*MANAGERS)
def create_item():
    data = get_json()
    values = validate(data)
    values["code"] = values["code"] or next_code()
    initial = to_int(data.get("initial_stock") or 0, "initial_stock", 0)
    item = Item(**values, stock=0)
    db.session.add(item)
    db.session.flush()
    if initial > 0:
        create_transaction("initial", [{"item_id": item.id, "quantity": initial}], current_user.id,
                           notes="Stok awal barang baru")
    log_activity("CREATE_ITEM", "item", item.id, new={**snapshot(item, FIELDS), "initial_stock": initial})
    db.session.commit()
    return ok(item.to_dict(), "Barang ditambahkan", 201)


@bp.get("/items/<int:iid>")
@roles_required(*MANAGERS)
def get_item(iid):
    item = Item.query.filter_by(id=iid, is_deleted=False).first_or_404()
    return ok(item.to_dict())


@bp.put("/items/<int:iid>")
@roles_required(*MANAGERS)
def update_item(iid):
    item = Item.query.filter_by(id=iid, is_deleted=False).first_or_404()
    values = validate(get_json(), iid)
    values["code"] = values["code"] or item.code
    old = snapshot(item, FIELDS)
    for k, v in values.items():
        setattr(item, k, v)
    log_activity("UPDATE_ITEM", "item", item.id, old=old, new=snapshot(item, FIELDS))
    db.session.commit()
    return ok(item.to_dict(), "Barang diperbarui")


@bp.delete("/items/<int:iid>")
@roles_required(ADMIN)
def delete_item(iid):
    item = Item.query.filter_by(id=iid, is_deleted=False).first_or_404()
    active = (db.session.query(RequestItem.id).join(Request)
              .filter(RequestItem.item_id == iid,
                      Request.status.in_(("pending", "approved", "handed_over"))).first())
    if active:
        raise ApiError("Barang masih memiliki pengajuan aktif dan tidak dapat dihapus", 422)
    item.is_deleted = True
    log_activity("DELETE_ITEM", "item", item.id, old=snapshot(item, FIELDS))
    db.session.commit()
    return ok(message="Barang dihapus")


@bp.post("/items/<int:iid>/image")
@roles_required(*MANAGERS)
def upload_image(iid):
    item = Item.query.filter_by(id=iid, is_deleted=False).first_or_404()
    f = request.files.get("image")
    if not f or "." not in f.filename:
        raise ApiError("Pilih file gambar terlebih dahulu", 422)
    ext = f.filename.rsplit(".", 1)[1].lower()
    if ext not in ALLOWED_IMG:
        raise ApiError("Format gambar harus PNG, JPG, atau WEBP", 422)
    name = f"item_{item.id}_{uuid.uuid4().hex[:8]}.{ext}"
    f.save(os.path.join(current_app.config["UPLOAD_FOLDER"], name))
    if item.image_path:
        try:
            os.remove(os.path.join(current_app.config["UPLOAD_FOLDER"], item.image_path))
        except OSError:
            pass
    item.image_path = name
    log_activity("UPLOAD_ITEM_IMAGE", "item", item.id)
    db.session.commit()
    return ok(item.to_dict(), "Foto diperbarui")


@bp.get("/items/<int:iid>/history")
@roles_required(*MANAGERS)
def item_history(iid):
    q = (db.session.query(StockTransactionItem).join(StockTransaction)
         .filter(StockTransactionItem.item_id == iid)
         .order_by(StockTransaction.created_at.desc(), StockTransactionItem.id.desc()))

    def ser(d):
        t = d.transaction
        return {"id": d.id, "transaction_id": t.id, "trx_number": t.trx_number, "type": t.type,
                "trx_date": t.trx_date.isoformat(), "quantity": d.quantity,
                "stock_before": d.stock_before, "stock_after": d.stock_after,
                "reason": d.reason, "notes": t.notes,
                "created_by": t.creator.name if t.creator else None}
    data, meta = paginate(q, ser)
    return ok(data, meta=meta)


@bp.get("/catalog")
@roles_required()
def catalog():
    q = apply_filters(Item.query.filter(Item.is_deleted.is_(False)), public=True).order_by(Item.name)
    data, meta = paginate(q, lambda i: i.to_dict(public=True))
    return ok(data, meta=meta)
