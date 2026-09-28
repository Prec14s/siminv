import { useState } from "react";
import api, { download, errorMessage } from "../api/client";
import { useUI } from "../context/UIContext";
import useOptions from "../hooks/useOptions";
import ItemPicker from "../components/ItemPicker";
import { IconDownload } from "../components/Icons";
import { Field, PageHead } from "../components/UI";
import { fmtMoney, fmtNum, REQ_STATUS, TRX_LABEL, today } from "../utils/format";

const KINDS = {
  stock: { label: "Stok barang", desc: "Posisi stok dan nilai per tanggal." },
  transactions: { label: "Transaksi masuk/keluar", desc: "Semua pergerakan barang dalam periode." },
  requests: { label: "Permintaan & peminjaman", desc: "Pengajuan per periode, per divisi." },
  "stock-card": { label: "Kartu stok", desc: "Saldo awal, masuk, keluar, saldo akhir satu barang." },
};
const MONEY_COLS = ["price", "value"];

export default function Reports() {
  const { toast } = useUI();
  const opts = useOptions(["categories", "locations"]);
  const [kind, setKind] = useState("stock");
  const [f, setF] = useState({ as_of: today(), date_from: "", date_to: today(), category_id: "", location_id: "", type: "", status: "", division: "" });
  const [item, setItem] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const params = () => {
    const keys = { stock: ["as_of", "category_id", "location_id"], transactions: ["date_from", "date_to", "type"],
      requests: ["date_from", "date_to", "type", "status", "division"], "stock-card": ["date_from", "date_to"] }[kind];
    const p = Object.fromEntries(keys.filter((k) => f[k]).map((k) => [k, f[k]]));
    if (kind === "stock-card" && item) p.item_id = item.id;
    return p;
  };

  const preview = async () => {
    if (kind === "stock-card" && !item) { toast("Pilih barang terlebih dahulu", "error"); return; }
    setBusy(true);
    try { const r = await api.get(`/reports/${kind}`, { params: params() }); setReport(r.data.data); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const exportAs = async (format) => {
    if (kind === "stock-card" && !item) { toast("Pilih barang terlebih dahulu", "error"); return; }
    try { await download(`/reports/${kind}`, { ...params(), format }); }
    catch (e) { toast("Gagal mengunduh laporan", "error"); }
  };

  const fmt = (k, v) => (MONEY_COLS.includes(k) ? fmtMoney(v) : typeof v === "number" ? fmtNum(v) : v);

  return (
    <>
      <PageHead title="Laporan" subtitle="Lihat pratinjau, lalu unduh sebagai Excel atau PDF." />
      <div className="tabs">
        {Object.entries(KINDS).map(([k, v]) => <button key={k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); setReport(null); }}>{v.label}</button>)}
      </div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-body">
          <p className="muted" style={{ marginTop: 0 }}>{KINDS[kind].desc}</p>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {kind === "stock" && <>
              <Field label="Per tanggal"><input className="input" type="date" value={f.as_of} max={today()} onChange={set("as_of")} /></Field>
              <Field label="Kategori"><select className="input" value={f.category_id} onChange={set("category_id")}><option value="">Semua</option>{(opts.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Lokasi"><select className="input" value={f.location_id} onChange={set("location_id")}><option value="">Semua</option>{(opts.locations || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </>}
            {kind !== "stock" && <>
              <Field label="Dari tanggal"><input className="input" type="date" value={f.date_from} onChange={set("date_from")} /></Field>
              <Field label="Sampai tanggal"><input className="input" type="date" value={f.date_to} onChange={set("date_to")} /></Field>
            </>}
            {kind === "transactions" && (
              <Field label="Tipe"><select className="input" value={f.type} onChange={set("type")}><option value="">Semua</option>{Object.entries(TRX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            )}
            {kind === "requests" && <>
              <Field label="Jenis"><select className="input" value={f.type} onChange={set("type")}><option value="">Semua</option><option value="request">Permintaan</option><option value="loan">Peminjaman</option></select></Field>
              <Field label="Status"><select className="input" value={f.status} onChange={set("status")}><option value="">Semua</option>{Object.entries(REQ_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="Divisi"><input className="input" value={f.division} onChange={set("division")} /></Field>
            </>}
            {kind === "stock-card" && (
              <Field label="Barang" hint={item ? `Dipilih: ${item.code} ${item.name}` : "Wajib dipilih"}>
                <ItemPicker placeholder="Cari barang" onPick={setItem} />
              </Field>
            )}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy} onClick={preview}>{busy ? "Memuat…" : "Tampilkan pratinjau"}</button>
            <button className="btn" onClick={() => exportAs("xlsx")}><IconDownload /> Unduh Excel</button>
            <button className="btn" onClick={() => exportAs("pdf")}><IconDownload /> Unduh PDF</button>
          </div>
        </div>
      </div>
      {report && (
        <div className="panel">
          <div className="panel-head"><div><h2>{report.title}</h2><div className="small muted">{report.subtitle}</div></div></div>
          {report.summary && (
            <div className="stats" style={{ margin: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
              {Object.entries(report.summary).map(([k, v]) => (
                <div key={k} className="stat"><div className="stat-label">{k}</div><div className="stat-value" style={{ fontSize: 20 }}>{k.toLowerCase().includes("nilai") ? fmtMoney(v) : fmtNum(v)}</div></div>
              ))}
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{report.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {report.rows.length === 0 && <tr><td colSpan={report.columns.length}><div className="empty">Tidak ada data pada filter ini.</div></td></tr>}
                {report.rows.slice(0, 200).map((r, i) => (
                  <tr key={i}>{report.columns.map((c) => <td key={c.key} className={typeof r[c.key] === "number" ? "num" : ""}>{fmt(c.key, r[c.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.rows.length > 200 && <div className="pager">Pratinjau menampilkan 200 baris pertama dari {report.rows.length}. Unduh untuk data lengkap.</div>}
        </div>
      )}
    </>
  );
}
