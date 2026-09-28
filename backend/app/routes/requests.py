from datetime import datetime, date
from flask import Blueprint, request
from flask_jwt_extended import current_user
from ..extensions import db
from ..models import Request, RequestItem, Item, Setting, CONDITIONS
from ..utils import (ok, get_json, require_fields, roles_required, paginate, log_activity, notify,
                     notify_roles, to_int, parse_date, generate_number, ApiError, MANAGERS)
from ..services.stock import create_transaction

bp = Blueprint("requests", __name__)
TYPE_LABEL = {"request": "Permintaan", "loan": "Peminjaman"}


def get_owned_or_manager(rid):
    r = db.get_or_404(Request, rid)
    if current_user.role not in MANAGERS and r.requester_id != current_user.id:
        raise ApiError("Anda tidak memiliki akses ke pengajuan ini", 403)
    return r


def require_status(r, *statuses):
    if r.status not in statuses:
        raise ApiError(f"Aksi tidak dapat dilakukan pada pengajuan berstatus '{r.status}'", 422)


@bp.get("/requests")
@roles_required()
def list_requests():
    q = Request.query
    mine = request.args.get("mine") == "1" or current_user.role not in MANAGERS
    if mine:
        q = q.filter(Request.requester_id == current_user.id)
    if st := request.args.get("status"):
        if st == "overdue":
            q = q.filter(Request.type == "loan", Request.status == "handed_over",
                         Request.return_due_date < date.today())
        else:
            q = q.filter(Request.status.in_(st.split(",")))
    if t := request.args.get("type"):
        q = q.filter(Request.type == t)
    if s := request.args.get("search"):
        q = q.filter(Request.request_number.ilike(f"%{s}%") | Request.purpose.ilike(f"%{s}%"))
    data, meta = paginate(q.order_by(Request.created_at.desc()), lambda r: r.to_dict(with_items=False))
    return ok(data, meta=meta)


@bp.get("/requests/<int:rid>")
@roles_required()
def get_request(rid):
    return ok(get_owned_or_manager(rid).to_dict())


@bp.post("/requests")
@roles_required()
def create_request():
    data = get_json()
    require_fields(data, "type", "purpose", "needed_date", "items")
    rtype = data["type"]
    if rtype not in TYPE_LABEL:
        raise ApiError("Jenis pengajuan tidak valid", 422)
    needed = parse_date(data["needed_date"], "Tanggal dibutuhkan")
    if needed < date.today():
        raise ApiError("Tanggal dibutuhkan tidak boleh di masa lalu", 422, {"needed_date": "Tidak boleh lampau"})
    due = None
    if rtype == "loan":
        due = parse_date(data.get("return_due_date"), "Tanggal rencana kembali")
        if due < needed:
            raise ApiError("Tanggal kembali harus setelah tanggal dibutuhkan", 422)
        s = db.session.get(Setting, "max_loan_days")
        max_days = int(s.value) if s and s.value else 14
        if (due - needed).days > max_days:
            raise ApiError(f"Durasi peminjaman maksimal {max_days} hari", 422)

    expected_type = "consumable" if rtype == "request" else "loanable"
    r = Request(request_number=generate_number(Request, Request.request_number, "REQ"),
                requester_id=current_user.id, type=rtype, purpose=data["purpose"].strip(),
                needed_date=needed, return_due_date=due)
    seen = set()
    for row in data["items"]:
        iid = to_int(row.get("item_id"), "item_id")
        if iid in seen:
            continue
        seen.add(iid)
        item = Item.query.filter_by(id=iid, is_deleted=False).first()
        if not item:
            raise ApiError("Barang tidak ditemukan", 404)
        if item.item_type != expected_type:
            kind = "habis pakai" if expected_type == "consumable" else "pinjam"
            raise ApiError(f"{item.name} bukan barang {kind}, tidak dapat diajukan sebagai "
                           f"{TYPE_LABEL[rtype].lower()}", 422)
        qty = to_int(row.get("quantity"), "Jumlah", 1)
        r.items.append(RequestItem(item_id=iid, qty_requested=qty))
    db.session.add(r)
    db.session.flush()
    notify_roles(MANAGERS, f"{TYPE_LABEL[rtype]} baru",
                 f"{current_user.name} mengajukan {r.request_number}.", f"/requests/manage?id={r.id}",
                 exclude=current_user.id)
    log_activity("CREATE_REQUEST", "request", r.id, new={"request_number": r.request_number})
    db.session.commit()
    return ok(r.to_dict(), f"Pengajuan {r.request_number} terkirim", 201)


@bp.post("/requests/<int:rid>/cancel")
@roles_required()
def cancel_request(rid):
    r = get_owned_or_manager(rid)
    if r.requester_id != current_user.id:
        raise ApiError("Hanya pengaju yang dapat membatalkan pengajuan", 403)
    require_status(r, "pending")
    r.status = "cancelled"
    log_activity("CANCEL_REQUEST", "request", r.id)
    db.session.commit()
    return ok(r.to_dict(), "Pengajuan dibatalkan")


@bp.post("/requests/<int:rid>/approve")
@roles_required(*MANAGERS)
def approve(rid):
    r = db.get_or_404(Request, rid)
    require_status(r, "pending")
    data = get_json()
    approved = {int(i["id"]): i.get("qty_approved") for i in data.get("items", [])}
    total = 0
    for ri in r.items:
        qty = approved.get(ri.id, ri.qty_requested)
        qty = to_int(qty, "Jumlah disetujui", 0)
        if qty > ri.qty_requested:
            raise ApiError(f"Jumlah disetujui untuk {ri.item.name} melebihi jumlah diminta", 422)
        ri.qty_approved = qty
        total += qty
    if total == 0:
        raise ApiError("Minimal satu barang harus disetujui. Gunakan Tolak jika tidak ada yang disetujui.", 422)
    r.status, r.approved_by, r.approved_at = "approved", current_user.id, datetime.utcnow()
    r.staff_notes = (data.get("notes") or "").strip() or None
    partial = any(ri.qty_approved < ri.qty_requested for ri in r.items)
    notify([r.requester_id], "Pengajuan disetujui" + (" sebagian" if partial else ""),
           f"{r.request_number} disetujui. Silakan ambil barang di petugas.", f"/requests/mine?id={r.id}")
    log_activity("APPROVE_REQUEST", "request", r.id,
                 new={ri.item_id: ri.qty_approved for ri in r.items})
    db.session.commit()
    return ok(r.to_dict(), "Pengajuan disetujui")


@bp.post("/requests/<int:rid>/reject")
@roles_required(*MANAGERS)
def reject(rid):
    r = db.get_or_404(Request, rid)
    require_status(r, "pending")
    reason = (get_json().get("reason") or "").strip()
    if not reason:
        raise ApiError("Alasan penolakan wajib diisi", 422, {"reason": "Wajib diisi"})
    r.status, r.rejection_reason = "rejected", reason
    r.approved_by, r.approved_at = current_user.id, datetime.utcnow()
    notify([r.requester_id], "Pengajuan ditolak", f"{r.request_number}: {reason}", f"/requests/mine?id={r.id}")
    log_activity("REJECT_REQUEST", "request", r.id, new={"reason": reason})
    db.session.commit()
    return ok(r.to_dict(), "Pengajuan ditolak")


@bp.post("/requests/<int:rid>/handover")
@roles_required(*MANAGERS)
def handover(rid):
    r = db.get_or_404(Request, rid)
    require_status(r, "approved")
    lines = [{"item_id": ri.item_id, "quantity": -ri.qty_approved} for ri in r.items if ri.qty_approved]
    trx = create_transaction("out", lines, current_user.id, request_id=r.id,
                             recipient=r.requester.name, reference_no=r.request_number,
                             notes=f"{TYPE_LABEL[r.type]} {r.request_number}")
    r.handed_over_at = datetime.utcnow()
    r.status = "handed_over" if r.type == "loan" else "completed"
    db.session.flush()
    notify([r.requester_id], "Barang diserahkan", f"Barang untuk {r.request_number} telah diserahkan.",
           f"/requests/mine?id={r.id}")
    log_activity("HANDOVER_REQUEST", "request", r.id, new={"transaction": trx.trx_number})
    db.session.commit()
    return ok(r.to_dict(), "Barang diserahkan, stok diperbarui")


@bp.post("/requests/<int:rid>/return")
@roles_required(*MANAGERS)
def return_items(rid):
    r = db.get_or_404(Request, rid)
    if r.type != "loan":
        raise ApiError("Hanya peminjaman yang dapat dikembalikan", 422)
    require_status(r, "handed_over")
    data = get_json()
    rows = {int(i["id"]): i for i in data.get("items", [])}
    lines = []
    for ri in r.items:
        if not ri.qty_approved:
            continue
        row = rows.get(ri.id, {})
        good = to_int(row.get("qty_good", ri.qty_approved), "Jumlah baik", 0)
        damaged = to_int(row.get("qty_damaged", 0), "Jumlah rusak", 0)
        lost = to_int(row.get("qty_lost", 0), "Jumlah hilang", 0)
        if good + damaged + lost != ri.qty_approved:
            raise ApiError(f"Total kembali untuk {ri.item.name} harus sama dengan {ri.qty_approved}", 422)
        ri.qty_returned = good + damaged
        ri.return_condition = "good" if good == ri.qty_approved else ("lost" if lost and not damaged else "damaged")
        if good:
            reason = None if good == ri.qty_approved else f"Baik {good}, rusak {damaged}, hilang {lost}"
            lines.append({"item_id": ri.item_id, "quantity": good, "reason": reason})
    notes = (data.get("notes") or "").strip()
    if lines:
        create_transaction("return", lines, current_user.id, request_id=r.id,
                           reference_no=r.request_number,
                           notes=f"Pengembalian {r.request_number}" + (f": {notes}" if notes else ""))
    r.status, r.returned_at = "returned", datetime.utcnow()
    if notes:
        r.staff_notes = ((r.staff_notes + "\n") if r.staff_notes else "") + notes
    notify([r.requester_id], "Pengembalian dicatat", f"Pengembalian {r.request_number} telah dicatat.",
           f"/requests/mine?id={r.id}")
    log_activity("RETURN_REQUEST", "request", r.id,
                 new={ri.item_id: ri.return_condition for ri in r.items})
    db.session.commit()
    return ok(r.to_dict(), "Pengembalian dicatat")
