from datetime import date
from flask import Blueprint
from flask_jwt_extended import current_user
from sqlalchemy import func
from ..extensions import db
from ..models import Item, Request, RequestItem, StockTransaction, StockTransactionItem
from ..utils import ok, roles_required, MANAGERS

bp = Blueprint("dashboard", __name__)


def month_starts(n=6):
    today = date.today().replace(day=1)
    out = []
    y, m = today.year, today.month
    for _ in range(n):
        out.append(date(y, m, 1))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


@bp.get("/dashboard")
@roles_required()
def dashboard():
    if current_user.role in MANAGERS:
        return ok(manager_dashboard())
    return ok(user_dashboard())


def user_dashboard():
    base = Request.query.filter(Request.requester_id == current_user.id)
    counts = dict(db.session.query(Request.status, func.count()).filter(
        Request.requester_id == current_user.id).group_by(Request.status).all())
    recent = base.order_by(Request.created_at.desc()).limit(5).all()
    return {
        "role": "user",
        "stats": {
            "pending": counts.get("pending", 0),
            "approved": counts.get("approved", 0),
            "on_loan": counts.get("handed_over", 0),
            "overdue": sum(1 for r in base.filter(Request.status == "handed_over").all() if r.is_overdue),
        },
        "recent_requests": [r.to_dict(with_items=False) for r in recent],
    }


def manager_dashboard():
    items = Item.query.filter(Item.is_deleted.is_(False))
    total_value = db.session.query(func.coalesce(func.sum(Item.stock * Item.price), 0)).filter(
        Item.is_deleted.is_(False)).scalar()
    low = items.filter(Item.stock <= Item.min_stock).order_by(Item.stock).limit(8).all()
    low_count = items.filter(Item.stock <= Item.min_stock).count()
    pending = Request.query.filter(Request.status == "pending")
    on_loan = Request.query.filter(Request.status == "handed_over", Request.type == "loan")
    overdue = on_loan.filter(Request.return_due_date < date.today())

    months = month_starts()
    series = []
    for i, start in enumerate(months):
        end = months[i + 1] if i + 1 < len(months) else date(start.year + (start.month // 12),
                                                             start.month % 12 + 1, 1)
        rows = dict(db.session.query(StockTransaction.type, func.sum(func.abs(StockTransactionItem.quantity)))
                    .join(StockTransactionItem)
                    .filter(StockTransaction.trx_date >= start, StockTransaction.trx_date < end,
                            StockTransaction.type.in_(("in", "initial", "out", "return")))
                    .group_by(StockTransaction.type).all())
        series.append({"month": start.strftime("%Y-%m"),
                       "in": int((rows.get("in") or 0) + (rows.get("initial") or 0) + (rows.get("return") or 0)),
                       "out": int(rows.get("out") or 0)})

    top = (db.session.query(Item.name, func.sum(RequestItem.qty_requested).label("qty"))
           .join(RequestItem, RequestItem.item_id == Item.id)
           .join(Request, Request.id == RequestItem.request_id)
           .filter(Request.status.notin_(("cancelled",)))
           .group_by(Item.name).order_by(func.sum(RequestItem.qty_requested).desc()).limit(5).all())

    return {
        "role": current_user.role,
        "stats": {
            "total_items": items.count(),
            "total_value": float(total_value or 0),
            "low_stock": low_count,
            "pending_requests": pending.count(),
            "active_loans": on_loan.count(),
            "overdue_loans": overdue.count(),
        },
        "low_stock_items": [i.to_dict() for i in low],
        "pending_requests": [r.to_dict(with_items=False)
                             for r in pending.order_by(Request.created_at).limit(5).all()],
        "overdue_loans": [r.to_dict(with_items=False) for r in overdue.limit(5).all()],
        "monthly": series,
        "top_requested": [{"name": n, "qty": int(q)} for n, q in top],
    }
