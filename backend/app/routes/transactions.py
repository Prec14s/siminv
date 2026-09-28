from flask import Blueprint, request
from flask_jwt_extended import current_user
from ..extensions import db
from ..models import StockTransaction, StockTransactionItem, Supplier, Item
from ..utils import (ok, get_json, require_fields, roles_required, paginate, log_activity,
                     to_int, parse_date, ApiError, ADMIN, MANAGERS)
from ..services.stock import create_transaction

bp = Blueprint("transactions", __name__)


@bp.get("/transactions")
@roles_required(*MANAGERS)
def list_transactions():
    q = StockTransaction.query
    if t := request.args.get("type"):
        q = q.filter(StockTransaction.type.in_(t.split(",")))
    if s := request.args.get("search"):
        q = q.filter(StockTransaction.trx_number.ilike(f"%{s}%") |
                     StockTransaction.reference_no.ilike(f"%{s}%") |
                     StockTransaction.recipient.ilike(f"%{s}%"))
    if d := request.args.get("date_from"):
        q = q.filter(StockTransaction.trx_date >= parse_date(d))
    if d := request.args.get("date_to"):
        q = q.filter(StockTransaction.trx_date <= parse_date(d))
    if iid := request.args.get("item_id", type=int):
        q = q.filter(StockTransaction.details.any(StockTransactionItem.item_id == iid))
    if uid := request.args.get("created_by", type=int):
        q = q.filter(StockTransaction.created_by == uid)
    q = q.order_by(StockTransaction.created_at.desc())
    data, meta = paginate(q, lambda t: t.to_dict(with_details=False))
    return ok(data, meta=meta)


@bp.get("/transactions/<int:tid>")
@roles_required(*MANAGERS)
def get_transaction(tid):
    return ok(db.get_or_404(StockTransaction, tid).to_dict())


@bp.post("/transactions")
@roles_required(*MANAGERS)
def create():
    data = get_json()
    require_fields(data, "type", "items")
    ttype = data["type"]
    if ttype not in ("in", "out", "adjustment"):
        raise ApiError("Tipe transaksi harus in, out, atau adjustment", 422)
    trx_date = parse_date(data.get("trx_date"), required=False)
    lines = []

    for idx, row in enumerate(data["items"]):
        item_id = to_int(row.get("item_id"), f"items[{idx}].item_id")
        if ttype == "adjustment":
            item = db.session.get(Item, item_id)
            if not item or item.is_deleted:
                raise ApiError("Barang tidak ditemukan", 404)
            physical = to_int(row.get("physical_stock"), "Stok fisik", 0)
            diff = physical - item.stock
            if diff == 0:
                continue
            reason = (row.get("reason") or "").strip()
            if not reason:
                raise ApiError(f"Alasan penyesuaian untuk {item.name} wajib diisi", 422)
            lines.append({"item_id": item_id, "quantity": diff, "reason": reason})
        else:
            qty = to_int(row.get("quantity"), "Jumlah", 1)
            lines.append({"item_id": item_id, "quantity": qty if ttype == "in" else -qty})

    if not lines:
        raise ApiError("Tidak ada perubahan stok yang perlu disimpan", 422)

    fields = {"notes": (data.get("notes") or "").strip() or None,
              "reference_no": (data.get("reference_no") or "").strip() or None}
    if ttype == "in":
        if sid := data.get("supplier_id"):
            if not db.session.get(Supplier, to_int(sid, "supplier_id")):
                raise ApiError("Supplier tidak ditemukan", 422)
            fields["supplier_id"] = int(sid)
    if ttype == "out":
        if not (data.get("recipient") or "").strip():
            raise ApiError("Penerima/tujuan wajib diisi", 422, {"recipient": "Wajib diisi"})
        fields["recipient"] = data["recipient"].strip()

    trx = create_transaction(ttype, lines, current_user.id, trx_date, **fields)
    db.session.flush()
    log_activity(f"CREATE_TRX_{ttype.upper()}", "transaction", trx.id,
                 new={"trx_number": trx.trx_number, "lines": lines})
    db.session.commit()
    return ok(trx.to_dict(), f"Transaksi {trx.trx_number} tersimpan", 201)


@bp.post("/transactions/<int:tid>/cancel")
@roles_required(ADMIN)
def cancel(tid):
    trx = db.get_or_404(StockTransaction, tid)
    if trx.is_cancelled or trx.type == "reversal":
        raise ApiError("Transaksi ini sudah dibatalkan atau merupakan transaksi pembalik", 422)
    if trx.request_id:
        raise ApiError("Transaksi dari pengajuan tidak dapat dibatalkan dari sini", 422)
    reason = (get_json().get("reason") or "").strip()
    if not reason:
        raise ApiError("Alasan pembatalan wajib diisi", 422, {"reason": "Wajib diisi"})
    lines = [{"item_id": d.item_id, "quantity": -d.quantity, "reason": reason} for d in trx.details]
    rev = create_transaction("reversal", lines, current_user.id, reversal_of_id=trx.id,
                             notes=f"Pembatalan {trx.trx_number}: {reason}")
    trx.is_cancelled = True
    db.session.flush()
    log_activity("CANCEL_TRX", "transaction", trx.id, new={"reversal": rev.trx_number, "reason": reason})
    db.session.commit()
    return ok(rev.to_dict(), f"Transaksi dibatalkan dengan {rev.trx_number}")
