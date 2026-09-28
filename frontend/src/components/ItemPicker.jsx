import { useEffect, useRef, useState } from "react";
import api from "../api/client";

/** Kolom pencarian barang untuk menambah baris transaksi. */
export default function ItemPicker({ onPick, exclude = [], placeholder = "Ketik kode atau nama barang untuk menambahkan" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get("/items", { params: { search: q, per_page: 8 } })
        .then(({ data }) => setResults(data.data)).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const visible = results.filter((r) => !exclude.includes(r.id));

  return (
    <div className="notif-wrap" ref={ref}>
      <input className="input" value={q} placeholder={placeholder} onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && (
        <div className="dropdown" style={{ left: 0, right: "auto", width: "100%", top: 40 }}>
          <div className="dropdown-list">
            {visible.length === 0 && <div className="empty">Barang tidak ditemukan.</div>}
            {visible.map((it) => (
              <button key={it.id} className="notif-item" onClick={() => { onPick(it); setQ(""); setOpen(false); }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span><b>{it.code}</b> {it.name}</span>
                  <span className="muted num">stok {it.stock} {it.unit?.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
