import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useUI } from "../context/UIContext";
import useOptions from "../hooks/useOptions";
import { PageHead } from "../components/UI";

export default function StockOpname() {
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const opts = useOptions(["locations"]);
  const [location, setLocation] = useState("");
  const [items, setItems] = useState([]);
  const [input, setInput] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get("/items", { params: { all: 1, location_id: location || undefined, sort: "code" } })
      .then(({ data }) => { setItems(data.data); setInput({}); })
      .catch((e) => toast(errorMessage(e), "error"))
      .finally(() => setLoading(false));
  }, [location, toast]);

  const changes = useMemo(() => items.filter((i) => input[i.id]?.physical !== undefined && input[i.id].physical !== ""
    && Number(input[i.id].physical) !== i.stock), [items, input]);
  const missingReason = changes.some((i) => !input[i.id]?.reason?.trim());

  const set = (id, k, v) => setInput((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const submit = async () => {
    if (!(await confirm({ title: "Simpan penyesuaian stok?", message: `${changes.length} barang akan disesuaikan dengan hasil hitung fisik.`, confirmText: "Simpan penyesuaian" }))) return;
    setBusy(true);
    try {
      const r = await api.post("/transactions", {
        type: "adjustment", notes,
        items: changes.map((i) => ({ item_id: i.id, physical_stock: Number(input[i.id].physical), reason: input[i.id].reason })),
      });
      toast(r.data.message);
      navigate(`/transactions?open=${r.data.data.id}`);
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Stock opname" subtitle="Isi stok hasil hitung fisik. Hanya barang yang berbeda yang akan disesuaikan.">
        <select className="input" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: 220 }}>
          <option value="">Semua lokasi</option>
          {(opts.locations || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button className="btn" onClick={() => window.print()}>Cetak lembar hitung</button>
      </PageHead>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Kode</th><th>Barang</th><th>Lokasi</th><th className="right">Stok sistem</th><th style={{ width: 130 }}>Stok fisik</th><th className="right">Selisih</th><th style={{ width: 240 }}>Alasan</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><div className="loading">Memuat barang…</div></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7}><div className="empty">Tidak ada barang di lokasi ini.</div></td></tr>}
              {!loading && items.map((i) => {
                const v = input[i.id]?.physical;
                const diff = v === undefined || v === "" ? null : Number(v) - i.stock;
                return (
                  <tr key={i.id}>
                    <td className="code">{i.code}</td>
                    <td className="cell-title">{i.name}</td>
                    <td className="small">{i.location?.name}</td>
                    <td className="right num">{i.stock} {i.unit?.name}</td>
                    <td><input className="input" type="number" min="0" value={v ?? ""} placeholder={String(i.stock)} onChange={(e) => set(i.id, "physical", e.target.value)} /></td>
                    <td className="right num" style={{ fontWeight: 700, color: diff > 0 ? "var(--ok)" : diff < 0 ? "var(--out)" : undefined }}>
                      {diff === null || diff === 0 ? "–" : (diff > 0 ? "+" : "") + diff}
                    </td>
                    <td>{diff ? <input className={`input ${!input[i.id]?.reason?.trim() ? "invalid" : ""}`} placeholder="Wajib diisi" value={input[i.id]?.reason || ""} onChange={(e) => set(i.id, "reason", e.target.value)} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="modal-foot" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <input className="input" style={{ maxWidth: 380 }} placeholder="Catatan opname (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="btn-row">
            <span className="muted small">{changes.length} barang berbeda{missingReason ? ", alasan belum lengkap" : ""}</span>
            <button className="btn btn-primary" disabled={busy || !changes.length || missingReason} onClick={submit}>Simpan penyesuaian</button>
          </div>
        </div>
      </div>
    </>
  );
}
