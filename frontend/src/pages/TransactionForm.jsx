import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useUI } from "../context/UIContext";
import useOptions from "../hooks/useOptions";
import ItemPicker from "../components/ItemPicker";
import { IconTrash } from "../components/Icons";
import { Field, PageHead } from "../components/UI";
import { today } from "../utils/format";

const COPY = {
  in: { title: "Barang masuk", sub: "Catat barang yang diterima. Stok bertambah setelah disimpan.", btn: "Simpan barang masuk" },
  out: { title: "Barang keluar", sub: "Catat barang yang dikeluarkan di luar pengajuan. Stok berkurang setelah disimpan.", btn: "Simpan barang keluar" },
};

export default function TransactionForm() {
  const { type } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useUI();
  const opts = useOptions(["suppliers"]);
  const [form, setForm] = useState({ trx_date: today(), supplier_id: "", reference_no: "", recipient: "", notes: "" });
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLines([]);
    const pre = params.get("item");
    if (pre) api.get(`/items/${pre}`).then(({ data }) => setLines([{ item: data.data, quantity: 1 }])).catch(() => {});
  }, [type, params]);

  if (!COPY[type]) return <Navigate to="/transactions" replace />;
  const copy = COPY[type];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const updateQty = (idx, v) => setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: v } : l)));

  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      const res = await api.post("/transactions", {
        ...form, type, items: lines.map((l) => ({ item_id: l.item.id, quantity: Number(l.quantity) })),
      });
      toast(res.data.message);
      navigate(`/transactions?open=${res.data.data.id}`);
    } catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const invalid = !lines.length || lines.some((l) => !(Number(l.quantity) > 0)
    || (type === "out" && Number(l.quantity) > l.item.stock));

  return (
    <>
      <PageHead title={copy.title} subtitle={copy.sub}>
        <Link className="btn" to="/transactions">Riwayat transaksi</Link>
      </PageHead>
      <div className="stack">
        <div className="panel"><div className="panel-body">
          <div className="form-grid">
            <Field label="Tanggal"><input className="input" type="date" value={form.trx_date} max={today()} onChange={set("trx_date")} /></Field>
            {type === "in" ? (
              <Field label="Supplier">
                <select className="input" value={form.supplier_id} onChange={set("supplier_id")}>
                  <option value="">Tanpa supplier</option>
                  {(opts.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Penerima atau tujuan" error={errors.recipient}>
                <input className="input" value={form.recipient} onChange={set("recipient")} placeholder="Contoh: Divisi Umum" />
              </Field>
            )}
            <Field label={type === "in" ? "No. faktur / surat jalan" : "No. referensi"}>
              <input className="input" value={form.reference_no} onChange={set("reference_no")} />
            </Field>
            <Field label="Catatan"><input className="input" value={form.notes} onChange={set("notes")} /></Field>
          </div>
        </div></div>

        <div className="panel">
          <div className="panel-head"><h2>Daftar barang</h2><span className="muted small">{lines.length} barang</span></div>
          <div className="panel-body" style={{ paddingBottom: 8 }}>
            <ItemPicker exclude={lines.map((l) => l.item.id)} onPick={(item) => setLines([...lines, { item, quantity: 1 }])} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Barang</th><th className="right">Stok sekarang</th><th style={{ width: 140 }}>Jumlah</th><th className="right">Stok setelah</th><th /></tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={5}><div className="empty">Cari dan pilih barang di atas untuk menambahkannya.</div></td></tr>}
                {lines.map((l, idx) => {
                  const q = Number(l.quantity) || 0;
                  const after = type === "in" ? l.item.stock + q : l.item.stock - q;
                  return (
                    <tr key={l.item.id}>
                      <td><div className="cell-title">{l.item.name}</div><div className="cell-sub">{l.item.code}</div></td>
                      <td className="right num">{l.item.stock} {l.item.unit?.name}</td>
                      <td><input className={`input qty-input ${after < 0 || q <= 0 ? "invalid" : ""}`} type="number" min="1" value={l.quantity}
                        onChange={(e) => updateQty(idx, e.target.value)} style={{ width: 110 }} /></td>
                      <td className="right num" style={{ color: after < 0 ? "var(--out)" : undefined, fontWeight: 600 }}>
                        {after < 0 ? "Stok tidak cukup" : after}
                      </td>
                      <td className="right"><button className="btn btn-ghost btn-icon" aria-label="Hapus baris" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><IconTrash /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-foot">
            <button className="btn btn-primary" disabled={busy || invalid} onClick={submit}>{copy.btn}</button>
          </div>
        </div>
      </div>
    </>
  );
}
