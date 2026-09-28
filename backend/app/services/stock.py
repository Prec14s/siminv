"""Satu-satunya tempat stok barang diubah. Semua perubahan lewat transaksi (FR-33, NFR-07)."""
from datetime import date
from ..extensions import db
from ..models import Item, StockTransaction, StockTransactionItem
from ..utils import ApiError, generate_number, notify_roles, MANAGERS

PREFIX = {"initial": "INI", "in": "IN", "out": "OUT", "adjustment": "ADJ",
          "return": "RET", "reversal": "REV"}


def create_transaction(trx_type, lines, created_by, trx_date=None, **fields):
    """
    lines: list of dict {item_id, quantity (bertanda: + masuk, - keluar), reason?}
    Tidak melakukan commit; pemanggil yang commit agar semuanya atomik.
    """
    if not lines:
        raise ApiError("Minimal satu barang harus diisi", 422)

    trx_date = trx_date or date.today()
    trx = StockTransaction(
        trx_number=generate_number(StockTransaction, StockTransaction.trx_number, PREFIX[trx_type], trx_date),
        type=trx_type, trx_date=trx_date, created_by=created_by, **fields,
    )
    db.session.add(trx)

    # Kunci baris barang dalam urutan id untuk menghindari deadlock
    merged = {}
    for line in lines:
        key = int(line["item_id"])
        if key in merged:
            merged[key]["quantity"] += int(line["quantity"])
        else:
            merged[key] = {"quantity": int(line["quantity"]), "reason": line.get("reason")}

    low_stock = []
    for item_id in sorted(merged):
        qty = merged[item_id]["quantity"]
        item = (db.session.query(Item).filter(Item.id == item_id, Item.is_deleted.is_(False))
                .with_for_update().first())
        if not item:
            raise ApiError(f"Barang dengan id {item_id} tidak ditemukan", 404)
        before = item.stock
        after = before + qty
        if after < 0:
            raise ApiError(
                f"Stok {item.name} tidak cukup (tersedia {before}, dibutuhkan {abs(qty)})", 422)
        item.stock = after
        trx.details.append(StockTransactionItem(
            item_id=item.id, quantity=qty, stock_before=before, stock_after=after,
            reason=merged[item_id]["reason"]))
        if before > item.min_stock >= after:
            low_stock.append(item)

    for item in low_stock:
        notify_roles(MANAGERS, "Stok menipis",
                     f"Stok {item.name} ({item.code}) tinggal {item.stock}, batas minimum {item.min_stock}.",
                     f"/items/{item.id}")
    return trx
