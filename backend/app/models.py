from datetime import datetime, date
import bcrypt
from .extensions import db

ROLES = ("super_admin", "staff", "user")
ITEM_TYPES = ("consumable", "loanable")
TRX_TYPES = ("initial", "in", "out", "adjustment", "return", "reversal")
REQ_TYPES = ("request", "loan")
REQ_STATUS = ("pending", "approved", "rejected", "handed_over", "returned", "completed", "cancelled")
CONDITIONS = ("good", "damaged", "lost")


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class BaseModel(db.Model):
    __abstract__ = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        for key, val in kwargs.items():
            setattr(self, key, val)


class User(TimestampMixin, BaseModel):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(*ROLES, name="user_role"), nullable=False, default="user")
    division = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login_at = db.Column(db.DateTime)
    failed_login_count = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime)

    def set_password(self, raw):
        self.password_hash = bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()

    def check_password(self, raw):
        return bcrypt.checkpw(raw.encode(), self.password_hash.encode())

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "username": self.username, "email": self.email,
            "role": self.role, "division": self.division, "is_active": self.is_active,
            "last_login_at": iso(self.last_login_at), "created_at": iso(self.created_at),
        }


class TokenBlocklist(BaseModel):
    __tablename__ = "token_blocklist"
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MasterMixin(TimestampMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class Category(MasterMixin, BaseModel):
    __tablename__ = "categories"
    description = db.Column(db.Text)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description, "is_active": self.is_active}


class Location(MasterMixin, BaseModel):
    __tablename__ = "locations"
    description = db.Column(db.Text)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description, "is_active": self.is_active}


class Unit(MasterMixin, BaseModel):
    __tablename__ = "units"

    def to_dict(self):
        return {"id": self.id, "name": self.name, "is_active": self.is_active}


class Supplier(MasterMixin, BaseModel):
    __tablename__ = "suppliers"
    contact = db.Column(db.String(100))
    phone = db.Column(db.String(30))
    address = db.Column(db.Text)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "contact": self.contact, "phone": self.phone,
                "address": self.address, "is_active": self.is_active}


class Item(TimestampMixin, BaseModel):
    __tablename__ = "items"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey("locations.id"), nullable=False)
    unit_id = db.Column(db.Integer, db.ForeignKey("units.id"), nullable=False)
    item_type = db.Column(db.Enum(*ITEM_TYPES, name="item_type"), nullable=False, default="consumable")
    stock = db.Column(db.Integer, nullable=False, default=0)
    min_stock = db.Column(db.Integer, nullable=False, default=0)
    price = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    image_path = db.Column(db.String(255))
    description = db.Column(db.Text)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    category = db.relationship("Category")
    location = db.relationship("Location")
    unit = db.relationship("Unit")

    __table_args__ = (db.CheckConstraint("stock >= 0", name="ck_item_stock_non_negative"),)

    @property
    def stock_status(self):
        if self.stock <= 0:
            return "out"
        if self.stock <= self.min_stock:
            return "low"
        return "ok"

    def to_dict(self, public=False):
        data = {
            "id": self.id, "code": self.code, "name": self.name,
            "category": self.category.to_dict() if self.category else None,
            "unit": self.unit.to_dict() if self.unit else None,
            "item_type": self.item_type, "stock": self.stock, "stock_status": self.stock_status,
            "image_url": f"/uploads/{self.image_path}" if self.image_path else None,
            "description": self.description,
        }
        if not public:
            data.update({
                "category_id": self.category_id, "location_id": self.location_id, "unit_id": self.unit_id,
                "location": self.location.to_dict() if self.location else None,
                "min_stock": self.min_stock, "price": float(self.price or 0),
                "created_at": iso(self.created_at), "updated_at": iso(self.updated_at),
            })
        return data


class StockTransaction(TimestampMixin, BaseModel):
    __tablename__ = "stock_transactions"
    id = db.Column(db.Integer, primary_key=True)
    trx_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    type = db.Column(db.Enum(*TRX_TYPES, name="trx_type"), nullable=False)
    trx_date = db.Column(db.Date, nullable=False, default=date.today)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"))
    request_id = db.Column(db.Integer, db.ForeignKey("requests.id"))
    reversal_of_id = db.Column(db.Integer, db.ForeignKey("stock_transactions.id"))
    is_cancelled = db.Column(db.Boolean, default=False, nullable=False)
    recipient = db.Column(db.String(150))
    reference_no = db.Column(db.String(50))
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    supplier = db.relationship("Supplier")
    creator = db.relationship("User")
    details = db.relationship("StockTransactionItem", backref="transaction", cascade="all, delete-orphan")

    def to_dict(self, with_details=True):
        data = {
            "id": self.id, "trx_number": self.trx_number, "type": self.type,
            "trx_date": self.trx_date.isoformat(), "supplier": self.supplier.to_dict() if self.supplier else None,
            "request_id": self.request_id, "reversal_of_id": self.reversal_of_id,
            "is_cancelled": self.is_cancelled, "recipient": self.recipient,
            "reference_no": self.reference_no, "notes": self.notes,
            "created_by": {"id": self.creator.id, "name": self.creator.name} if self.creator else None,
            "created_at": iso(self.created_at), "total_items": len(self.details),
        }
        if with_details:
            data["details"] = [d.to_dict() for d in self.details]
        return data


class StockTransactionItem(BaseModel):
    __tablename__ = "stock_transaction_items"
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey("stock_transactions.id"), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)  # positif = masuk, negatif = keluar
    stock_before = db.Column(db.Integer, nullable=False)
    stock_after = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255))

    item = db.relationship("Item")

    def to_dict(self):
        return {
            "id": self.id, "item_id": self.item_id,
            "item": {"id": self.item.id, "code": self.item.code, "name": self.item.name,
                     "unit": self.item.unit.name if self.item.unit else None} if self.item else None,
            "quantity": self.quantity, "stock_before": self.stock_before,
            "stock_after": self.stock_after, "reason": self.reason,
        }


class Request(TimestampMixin, BaseModel):
    __tablename__ = "requests"
    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.Enum(*REQ_TYPES, name="request_type"), nullable=False)
    purpose = db.Column(db.Text, nullable=False)
    needed_date = db.Column(db.Date, nullable=False)
    return_due_date = db.Column(db.Date)
    status = db.Column(db.Enum(*REQ_STATUS, name="request_status"), nullable=False, default="pending")
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    handed_over_at = db.Column(db.DateTime)
    returned_at = db.Column(db.DateTime)
    staff_notes = db.Column(db.Text)

    requester = db.relationship("User", foreign_keys=[requester_id])
    approver = db.relationship("User", foreign_keys=[approved_by])
    items = db.relationship("RequestItem", backref="request", cascade="all, delete-orphan")

    @property
    def is_overdue(self):
        return (self.type == "loan" and self.status == "handed_over"
                and self.return_due_date is not None and self.return_due_date < date.today())

    def to_dict(self, with_items=True):
        data = {
            "id": self.id, "request_number": self.request_number, "type": self.type,
            "purpose": self.purpose, "needed_date": self.needed_date.isoformat(),
            "return_due_date": self.return_due_date.isoformat() if self.return_due_date else None,
            "status": self.status, "is_overdue": self.is_overdue,
            "requester": {"id": self.requester.id, "name": self.requester.name,
                          "division": self.requester.division} if self.requester else None,
            "approver": {"id": self.approver.id, "name": self.approver.name} if self.approver else None,
            "approved_at": iso(self.approved_at), "rejection_reason": self.rejection_reason,
            "handed_over_at": iso(self.handed_over_at), "returned_at": iso(self.returned_at),
            "staff_notes": self.staff_notes, "created_at": iso(self.created_at),
            "total_items": len(self.items),
        }
        if with_items:
            data["items"] = [i.to_dict() for i in self.items]
        return data


class RequestItem(BaseModel):
    __tablename__ = "request_items"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey("requests.id"), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    qty_requested = db.Column(db.Integer, nullable=False)
    qty_approved = db.Column(db.Integer)
    qty_returned = db.Column(db.Integer)
    return_condition = db.Column(db.Enum(*CONDITIONS, name="return_condition"))

    item = db.relationship("Item")

    def to_dict(self):
        return {
            "id": self.id, "item_id": self.item_id,
            "item": {"id": self.item.id, "code": self.item.code, "name": self.item.name,
                     "stock": self.item.stock, "item_type": self.item.item_type,
                     "unit": self.item.unit.name if self.item.unit else None} if self.item else None,
            "qty_requested": self.qty_requested, "qty_approved": self.qty_approved,
            "qty_returned": self.qty_returned, "return_condition": self.return_condition,
        }


class Notification(BaseModel):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text)
    link = db.Column(db.String(255))
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "message": self.message, "link": self.link,
                "is_read": self.is_read, "created_at": iso(self.created_at)}


class ActivityLog(BaseModel):
    __tablename__ = "activity_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(50), nullable=False, index=True)
    entity = db.Column(db.String(50))
    entity_id = db.Column(db.Integer)
    old_data = db.Column(db.JSON)
    new_data = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship("User")

    def to_dict(self):
        return {"id": self.id, "user": {"id": self.user.id, "name": self.user.name} if self.user else None,
                "action": self.action, "entity": self.entity, "entity_id": self.entity_id,
                "old_data": self.old_data, "new_data": self.new_data, "ip_address": self.ip_address,
                "created_at": iso(self.created_at)}


class Setting(BaseModel):
    __tablename__ = "settings"
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.Text)


DEFAULT_SETTINGS = {
    "institution_name": "Instansi Saya",
    "max_loan_days": "14",
    "email_notifications": "false",
}


def iso(dt):
    return dt.isoformat() + "Z" if dt else None
