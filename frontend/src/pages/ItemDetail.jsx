import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { assetUrl, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import useList from "../hooks/useList";
import ItemForm from "./ItemForm";
import { IconBox, IconEdit, IconImage, IconTrash } from "../components/Icons";
import { PageHead, Pagination, StockGauge, StockStatus, TableState, TrxType } from "../components/UI";
import { fmtDate, fmtMoney, ITEM_TYPE_LABEL } from "../utils/format";

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { toast, confirm } = useUI();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const fileRef = useRef(null);
  const history = useList(`/items/${id}/history`);

  const load = () => api.get(`/items/${id}`).then(({ data }) => setItem(data.data)).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    try { const r = await api.post(`/items/${id}/image`, fd); setItem(r.data.data); toast(r.data.message); }
    catch (err) { toast(errorMessage(err), "error"); }
    e.target.value = "";
  };

  const remove = async () => {
    if (!(await confirm({ title: `Hapus ${item.name}?`, message: "Barang akan disembunyikan dari daftar. Riwayat transaksinya tetap tersimpan.", confirmText: "Hapus barang", danger: true }))) return;
    try { await api.delete(`/items/${id}`); toast("Barang dihapus"); navigate("/items"); }
    catch (e) { toast(errorMessage(e), "error"); }
  };

  if (error) return <div className="alert error">{error}</div>;
  if (!item) return <div className="loading">Memuat barang…</div>;

  return (
    <>
      <div className="small" style={{ marginBottom: 8 }}><Link to="/items">Barang</Link> / {item.code}</div>
      <PageHead title={item.name} subtitle={`${item.code} · ${item.category?.name} · ${ITEM_TYPE_LABEL[item.item_type]}`}>
        <Link className="btn" to={`/transactions/new/in?item=${item.id}`}>Catat masuk</Link>
        <Link className="btn" to={`/transactions/new/out?item=${item.id}`}>Catat keluar</Link>
        <button className="btn" onClick={() => setEditing(true)}><IconEdit /> Ubah</button>
        {hasRole("super_admin") && <button className="btn btn-ghost" onClick={remove}><IconTrash /> Hapus</button>}
      </PageHead>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "minmax(0,260px) 1fr", gap: 22 }}>
            <div>
              {item.image_url
                ? <img className="item-photo" src={assetUrl(item.image_url)} alt={item.name} />
                : <div className="item-photo"><IconBox width={48} height={48} /></div>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={upload} />
              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => fileRef.current.click()}>
                <IconImage /> {item.image_url ? "Ganti foto" : "Unggah foto"}
              </button>
            </div>
            <dl className="dl">
              <dt>Lokasi</dt><dd>{item.location?.name}</dd>
              <dt>Satuan</dt><dd>{item.unit?.name}</dd>
              <dt>Harga satuan</dt><dd className="num">{fmtMoney(item.price)}</dd>
              <dt>Nilai stok</dt><dd className="num">{fmtMoney(item.price * item.stock)}</dd>
              <dt>Deskripsi</dt><dd>{item.description || "-"}</dd>
              <dt>Terakhir diubah</dt><dd>{fmtDate(item.updated_at)}</dd>
            </dl>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Stok saat ini</h2><StockStatus status={item.stock_status} /></div>
          <div className="panel-body">
            <div style={{ transform: "scale(1.25)", transformOrigin: "left top", width: "80%", marginBottom: 20 }}>
              <StockGauge stock={item.stock} min={item.min_stock} unit={item.unit?.name} />
            </div>
            <p className="muted small" style={{ margin: 0 }}>Garis gelap pada bar menandai stok minimum ({item.min_stock} {item.unit?.name}).</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Riwayat transaksi</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tanggal</th><th>No. transaksi</th><th>Tipe</th><th className="right">Perubahan</th><th className="right">Stok sebelum → sesudah</th><th>Petugas</th><th>Keterangan</th></tr></thead>
            <tbody>
              <TableState colSpan={7} loading={history.loading} error={history.error} empty={!history.data.length} emptyTitle="Belum ada transaksi" />
              {!history.loading && history.data.map((h) => (
                <tr key={h.id}>
                  <td>{fmtDate(h.trx_date)}</td>
                  <td className="code">{h.trx_number}</td>
                  <td><TrxType type={h.type} /></td>
                  <td className="right num" style={{ fontWeight: 700, color: h.quantity > 0 ? "var(--ok)" : "var(--out)" }}>{h.quantity > 0 ? "+" : ""}{h.quantity}</td>
                  <td className="right num">{h.stock_before} → {h.stock_after}</td>
                  <td>{h.created_by}</td>
                  <td className="small">{h.reason || h.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={history.meta} page={history.page} setPage={history.setPage} />
      </div>
      {editing && <ItemForm initial={item} onClose={() => setEditing(false)} onSaved={(it) => { setEditing(false); setItem(it); }} />}
    </>
  );
}
