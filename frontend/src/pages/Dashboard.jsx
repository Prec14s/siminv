import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHead, RequestStatus, StockGauge } from "../components/UI";
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNum, REQ_TYPE_LABEL } from "../utils/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function Stat({ label, value, to, tone, title }) {
  const inner = <><div className="stat-label">{label}</div><div className="stat-value" title={title}>{value}</div></>;
  return to ? <Link to={to} className={`stat ${tone || ""}`}>{inner}</Link> : <div className={`stat ${tone || ""}`}>{inner}</div>;
}

function RequestRows({ rows, base, empty }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return rows.map((r) => (
    <Link key={r.id} to={`${base}?id=${r.id}`} className="list-row">
      <div>
        <div className="cell-title">{r.request_number}</div>
        <div className="cell-sub">{REQ_TYPE_LABEL[r.type]} · {r.requester?.name} · {fmtDate(r.created_at)}</div>
      </div>
      <RequestStatus status={r.status} overdue={r.is_overdue} />
    </Link>
  ));
}

function ManagerDashboard({ d }) {
  const s = d.stats;
  const chart = d.monthly.map((m) => ({ name: MONTHS[+m.month.slice(5) - 1], Masuk: m.in, Keluar: m.out }));
  return (
    <>
      <div className="stats">
        <Stat label="Jenis barang" value={fmtNum(s.total_items)} to="/items" />
        <Stat label="Nilai inventaris" value={fmtMoneyShort(s.total_value)} title={fmtMoney(s.total_value)} />
        <Stat label="Stok menipis atau habis" value={s.low_stock} tone={s.low_stock ? "warn" : ""} to="/items?stock_status=low" />
        <Stat label="Pengajuan menunggu" value={s.pending_requests} tone={s.pending_requests ? "warn" : ""} to="/requests/manage" />
        <Stat label="Sedang dipinjam" value={s.active_loans} to="/requests/manage?status=handed_over" />
        <Stat label="Peminjaman terlambat" value={s.overdue_loans} tone={s.overdue_loans ? "danger" : ""} to="/requests/manage?status=overdue" />
      </div>
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-head"><h2>Barang masuk dan keluar, 6 bulan terakhir</h2></div>
          <div className="panel-body" style={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={3}>
                <CartesianGrid vertical={false} stroke="#eceee9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} width={36} />
                <Tooltip cursor={{ fill: "#f3f4f1" }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Masuk" fill="#1d5c63" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Keluar" fill="#e9a825" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Paling sering diminta</h2></div>
          {d.top_requested.length === 0 && <div className="empty">Belum ada pengajuan.</div>}
          {d.top_requested.map((t) => (
            <div key={t.name} className="list-row"><span>{t.name}</span><b className="num">{fmtNum(t.qty)}</b></div>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h2>Stok perlu diisi ulang</h2>
            <Link className="btn btn-sm" to="/transactions/new/in">Catat barang masuk</Link>
          </div>
          {d.low_stock_items.length === 0 && <div className="empty">Semua stok di atas batas minimum.</div>}
          {d.low_stock_items.map((i) => (
            <Link key={i.id} to={`/items/${i.id}`} className="list-row">
              <div><div className="cell-title">{i.name}</div><div className="cell-sub">{i.code} · min. {i.min_stock}</div></div>
              <StockGauge stock={i.stock} min={i.min_stock} unit={i.unit?.name} />
            </Link>
          ))}
        </div>
        <div className="stack" style={{ alignContent: "start" }}>
          <div className="panel">
            <div className="panel-head"><h2>Menunggu persetujuan</h2><Link className="btn btn-sm" to="/requests/manage">Lihat semua</Link></div>
            <RequestRows rows={d.pending_requests} base="/requests/manage" empty="Tidak ada pengajuan yang menunggu." />
          </div>
          {d.overdue_loans.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Peminjaman terlambat</h2></div>
              <RequestRows rows={d.overdue_loans} base="/requests/manage" empty="" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function UserDashboard({ d }) {
  const s = d.stats;
  return (
    <>
      <div className="stats">
        <Stat label="Menunggu persetujuan" value={s.pending} to="/requests/mine" />
        <Stat label="Disetujui, siap diambil" value={s.approved} to="/requests/mine" />
        <Stat label="Sedang saya pinjam" value={s.on_loan} to="/requests/mine" />
        <Stat label="Terlambat dikembalikan" value={s.overdue} tone={s.overdue ? "danger" : ""} to="/requests/mine" />
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Pengajuan terakhir saya</h2>
          <Link className="btn btn-primary btn-sm" to="/catalog">Buat pengajuan</Link>
        </div>
        <RequestRows rows={d.recent_requests} base="/requests/mine"
          empty="Anda belum pernah mengajukan barang. Buka katalog untuk memulai." />
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/dashboard").then(({ data }) => setD(data.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <PageHead title={`Halo, ${user.name.split(" ")[0]}`}
        subtitle={new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date())} />
      {error && <div className="alert error">{error}</div>}
      {!d && !error && <div className="loading">Memuat dashboard…</div>}
      {d && (d.role === "user" ? <UserDashboard d={d} /> : <ManagerDashboard d={d} />)}
    </>
  );
}
