import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { assetUrl, errorMessage, fieldErrors } from "../api/client";
import { useUI } from "../context/UIContext";
import useList from "../hooks/useList";
import useOptions from "../hooks/useOptions";
import { IconBox, IconTrash } from "../components/Icons";
import { Field, PageHead, Pagination, StockStatus } from "../components/UI";
import { addDays, today } from "../utils/format";

const MODES = {
  request: { tab: "Permintaan barang habis pakai", itemType: "consumable", hint: "Barang habis pakai tidak perlu dikembalikan." },
  loan: { tab: "Peminjaman barang", itemType: "loanable", hint: "Barang pinjaman wajib dikembalikan sesuai tanggal." },
};

export default function Catalog() {
  const { toast } = useUI();
  const navigate = useNavigate();
  const [mode, setMode] = useState("request");
  const opts = useOptions(["categories"]);
  const list = useList("/catalog", { search: "", category_id: "", item_type: "consumable" }, { perPage: 12 });
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ purpose: "", needed_date: today(), return_due_date: addDays(today(), 3) });
  const [maxDays, setMaxDays] = useState(14);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings").then(({ data }) => setMaxDays(Number(data.data.max_loan_days) || 14)).catch(() => {}); }, []);

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setCart([]);
    list.setFilter("item_type", MODES[m].itemType);
  };

  const add = (item) => setCart((c) => (c.some((l) => l.item.id === item.id) ? c : [...c, { item, quantity: 1 }]));
  const setQty = (id, q) => setCart((c) => c.map((l) => (l.item.id === id ? { ...l, quantity: q } : l)));

  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      const r = await api.post("/requests", {
        type: mode, purpose: form.purpose, needed_date: form.needed_date,
        return_due_date: mode === "loan" ? form.return_due_date : null,
        items: cart.map((l) => ({ item_id: l.item.id, quantity: Number(l.quantity) })),
      });
      toast(r.data.message);
      navigate(`/requests/mine?id=${r.data.data.id}`);
    } catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const invalid = !cart.length || !form.purpose.trim() || cart.some((l) => !(Number(l.quantity) > 0));

  return (
    <>
      <PageHead title="Katalog barang" subtitle="Pilih barang, lalu kirim pengajuan untuk disetujui petugas." />
      <div className="tabs">
        {Object.entries(MODES).map(([k, v]) => <button key={k} className={mode === k ? "active" : ""} onClick={() => switchMode(k)}>{v.tab}</button>)}
      </div>
      <div className="catalog-layout">
        <div>
          <div className="btn-row" style={{ marginBottom: 14 }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Cari barang" value={list.filters.search} onChange={(e) => list.setFilter("search", e.target.value)} />
            <select className="input" style={{ width: 200 }} value={list.filters.category_id} onChange={(e) => list.setFilter("category_id", e.target.value)}>
              <option value="">Semua kategori</option>
              {(opts.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {list.loading && <div className="loading">Memuat katalog…</div>}
          {list.error && <div className="alert error">{list.error}</div>}
          {!list.loading && !list.data.length && <div className="panel"><div className="empty"><strong>Tidak ada barang</strong>Coba kata kunci atau kategori lain.</div></div>}
          <div className="catalog-grid">
            {!list.loading && list.data.map((i) => {
              const inCart = cart.some((l) => l.item.id === i.id);
              return (
                <div key={i.id} className="cat-card">
                  <div className="cat-img">{i.image_url ? <img src={assetUrl(i.image_url)} alt="" /> : <IconBox />}</div>
                  <div className="cat-body">
                    <div><div className="cell-title">{i.name}</div><div className="cell-sub">{i.category?.name}</div></div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <StockStatus status={i.stock_status} />
                      <span className="small muted num">{i.stock} {i.unit?.name}</span>
                    </div>
                    <button className={`btn btn-sm ${inCart ? "" : "btn-primary"}`} disabled={i.stock <= 0 || inCart} onClick={() => add(i)}>
                      {inCart ? "Sudah dipilih" : i.stock <= 0 ? "Stok habis" : "Pilih barang"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="panel" style={{ marginTop: 14, border: list.meta.pages > 1 ? undefined : 0, background: "transparent" }}>
            {list.meta.pages > 1 && <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />}
          </div>
        </div>

        <aside className="panel cart">
          <div className="panel-head"><h2>{mode === "loan" ? "Peminjaman" : "Permintaan"} saya</h2><span className="muted small">{cart.length} barang</span></div>
          <div className="panel-body stack" style={{ gap: 14 }}>
            <p className="small muted" style={{ margin: 0 }}>{MODES[mode].hint}</p>
            {cart.length === 0 && <div className="small muted">Belum ada barang dipilih.</div>}
            {cart.length > 0 && (
              <div>
                {cart.map((l) => (
                  <div key={l.item.id} className="cart-line">
                    <div><div className="cell-title small">{l.item.name}</div><div className="cell-sub">tersedia {l.item.stock} {l.item.unit?.name}</div></div>
                    <input className="input qty-input" type="number" min="1" max={l.item.stock} value={l.quantity} onChange={(e) => setQty(l.item.id, e.target.value)} aria-label={`Jumlah ${l.item.name}`} />
                    <button className="btn btn-ghost btn-icon" aria-label="Hapus" onClick={() => setCart(cart.filter((x) => x.item.id !== l.item.id))}><IconTrash /></button>
                  </div>
                ))}
              </div>
            )}
            <Field label="Keperluan" error={errors.purpose}>
              <textarea className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Contoh: rapat koordinasi bulanan" />
            </Field>
            <Field label="Tanggal dibutuhkan" error={errors.needed_date}>
              <input className="input" type="date" min={today()} value={form.needed_date} onChange={(e) => setForm({ ...form, needed_date: e.target.value })} />
            </Field>
            {mode === "loan" && (
              <Field label="Rencana tanggal kembali" hint={`Maksimal ${maxDays} hari sejak tanggal dibutuhkan.`}>
                <input className="input" type="date" min={form.needed_date} max={addDays(form.needed_date, maxDays)} value={form.return_due_date} onChange={(e) => setForm({ ...form, return_due_date: e.target.value })} />
              </Field>
            )}
            <button className="btn btn-primary" disabled={busy || invalid} onClick={submit}>Kirim pengajuan</button>
          </div>
        </aside>
      </div>
    </>
  );
}
