import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL, timeAgo } from "../utils/format";
import {
  IconBell, IconBox, IconCart, IconChart, IconClipboard, IconDashboard, IconHistory, IconIn,
  IconInbox, IconList, IconMenu, IconOut, IconScale, IconSettings, IconTag, IconUser, IconUsers,
} from "./Icons";

const NAV = [
  { group: null, items: [{ to: "/", label: "Dashboard", icon: IconDashboard, end: true }] },
  { group: "Pengajuan", items: [
    { to: "/catalog", label: "Katalog barang", icon: IconCart },
    { to: "/requests/mine", label: "Pengajuan saya", icon: IconClipboard },
    { to: "/requests/manage", label: "Kelola pengajuan", icon: IconInbox, roles: ["super_admin", "staff"] },
  ] },
  { group: "Inventaris", roles: ["super_admin", "staff"], items: [
    { to: "/items", label: "Barang", icon: IconBox },
    { to: "/transactions/new/in", label: "Barang masuk", icon: IconIn },
    { to: "/transactions/new/out", label: "Barang keluar", icon: IconOut },
    { to: "/stock-opname", label: "Stock opname", icon: IconScale },
    { to: "/transactions", label: "Riwayat transaksi", icon: IconList, end: true },
    { to: "/master", label: "Master data", icon: IconTag },
    { to: "/reports", label: "Laporan", icon: IconChart },
  ] },
  { group: "Administrasi", roles: ["super_admin"], items: [
    { to: "/users", label: "Pengguna", icon: IconUsers },
    { to: "/activity-logs", label: "Log aktivitas", icon: IconHistory },
    { to: "/settings", label: "Pengaturan", icon: IconSettings },
  ] },
];

function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  const load = () => api.get("/notifications", { params: { per_page: 15 } })
    .then(({ data }) => { setItems(data.data); setUnread(data.meta.unread); })
    .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const openItem = async (n) => {
    if (!n.is_read) await api.patch(`/notifications/${n.id}/read`).catch(() => {});
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };

  const readAll = async () => { await api.patch("/notifications/read-all"); load(); };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="btn btn-ghost btn-icon" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label="Notifikasi">
        <IconBell />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="panel-head">
            <h3>Notifikasi</h3>
            {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={readAll}>Tandai semua dibaca</button>}
          </div>
          <div className="dropdown-list">
            {items.length === 0 && <div className="empty">Belum ada notifikasi.</div>}
            {items.map((n) => (
              <button key={n.id} className={`notif-item ${n.is_read ? "" : "unread"}`} onClick={() => openItem(n)}>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div className="small">{n.message}</div>
                <div className="small muted">{timeAgo(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="notif-wrap" ref={ref}>
      <button className="btn btn-ghost user-chip" style={{ height: 44 }} onClick={() => setOpen(!open)}>
        <span className="avatar">{initials}</span>
        <span className="who" style={{ textAlign: "left", lineHeight: 1.2 }}>
          <span style={{ display: "block" }}>{user.name}</span>
          <span className="small muted" style={{ fontWeight: 400 }}>{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open && (
        <div className="dropdown" style={{ width: 220 }}>
          <div className="menu-list">
            <Link to="/profile" onClick={() => setOpen(false)}>Profil & password</Link>
            <button onClick={logout}>Keluar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [institution, setInstitution] = useState("");

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    api.get("/settings").then(({ data }) => setInstitution(data.data.institution_name)).catch(() => {});
  }, []);

  return (
    <div className="shell">
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div>
            <div className="brand-name">SIMINV</div>
            <div className="brand-sub">{institution || "Sistem inventaris"}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.filter((g) => !g.roles || hasRole(...g.roles)).map((g, gi) => (
            <div key={gi} style={{ display: "contents" }}>
              {g.group && <div className="nav-group">{g.group}</div>}
              {g.items.filter((i) => !i.roles || hasRole(...i.roles)).map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end}>
                  <i.icon /> {i.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group">Akun</div>
          <NavLink to="/profile"><IconUser /> Profil</NavLink>
        </nav>
        <div className="sidebar-foot">Masuk sebagai {ROLE_LABEL[user.role]}</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Buka menu">
            <IconMenu />
          </button>
          <div className="spacer" />
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
