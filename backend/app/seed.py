from .extensions import db
from .models import User, Category, Location, Unit, Supplier, Item, Setting, DEFAULT_SETTINGS
from .services.stock import create_transaction

ACCOUNTS = [
    ("Super Admin", "superadmin", "superadmin@siminv.local", "super_admin", "IT"),
    ("Siti Staff Gudang", "staff", "staff@siminv.local", "staff", "Gudang"),
    ("Budi Pegawai", "user", "user@siminv.local", "user", "Keuangan"),
]
DEFAULT_PASSWORD = "password123"


def get_or_create(model, **kw):
    obj = model.query.filter_by(name=kw["name"]).first()
    if not obj:
        obj = model(**kw)
        db.session.add(obj)
        db.session.flush()
    return obj


def run_seed(demo=True):
    for key, val in DEFAULT_SETTINGS.items():
        if not db.session.get(Setting, key):
            db.session.add(Setting(key=key, value=val))

    for name, uname, email, role, div in ACCOUNTS:
        if not User.query.filter_by(username=uname).first():
            u = User(name=name, username=uname, email=email, role=role, division=div)
            u.set_password(DEFAULT_PASSWORD)
            db.session.add(u)
    db.session.flush()

    if demo and Item.query.count() == 0:
        admin = User.query.filter_by(username="superadmin").first()
        atk = get_or_create(Category, name="Alat Tulis Kantor", description="Kertas, pena, map, dll.")
        elek = get_or_create(Category, name="Elektronik", description="Perangkat elektronik yang dapat dipinjam")
        keb = get_or_create(Category, name="Kebersihan")
        g1 = get_or_create(Location, name="Gudang A - Rak 1")
        g2 = get_or_create(Location, name="Ruang IT")
        units = {n: get_or_create(Unit, name=n) for n in ("pcs", "rim", "box", "unit", "botol")}
        get_or_create(Supplier, name="CV Sumber Makmur", contact="Andi", phone="0812-0000-1111",
                      address="Jl. Sudirman No. 10")
        get_or_create(Supplier, name="PT Teknologi Nusantara", contact="Rina", phone="0813-2222-3333")

        demo_items = [
            ("BRG-0001", "Kertas HVS A4 70gr", atk, g1, "rim", "consumable", 40, 10, 55000),
            ("BRG-0002", "Pulpen Hitam", atk, g1, "box", "consumable", 15, 5, 25000),
            ("BRG-0003", "Map Plastik", atk, g1, "pcs", "consumable", 8, 10, 3000),
            ("BRG-0004", "Tinta Printer Hitam", atk, g1, "botol", "consumable", 3, 4, 90000),
            ("BRG-0005", "Cairan Pembersih Lantai", keb, g1, "botol", "consumable", 12, 3, 30000),
            ("BRG-0006", "Laptop Kantor", elek, g2, "unit", "loanable", 5, 1, 8500000),
            ("BRG-0007", "Proyektor", elek, g2, "unit", "loanable", 2, 1, 5200000),
            ("BRG-0008", "Kabel HDMI 5m", elek, g2, "pcs", "loanable", 6, 2, 120000),
        ]
        for code, name, cat, loc, unit, typ, stock, mn, price in demo_items:
            item = Item(code=code, name=name, category_id=cat.id, location_id=loc.id,
                        unit_id=units[unit].id, item_type=typ, min_stock=mn, price=price, stock=0)
            db.session.add(item)
            db.session.flush()
            create_transaction("initial", [{"item_id": item.id, "quantity": stock}], admin.id,
                               notes="Stok awal (data contoh)")
    db.session.commit()
