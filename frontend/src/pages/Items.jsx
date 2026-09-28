import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useList from "../hooks/useList";
import useOptions from "../hooks/useOptions";
import ItemForm from "./ItemForm";
import { IconPlus } from "../components/Icons";
import { Badge, PageHead, Pagination, StockGauge, StockStatus, TableState } from "../components/UI";
import { fmtMoney, ITEM_TYPE_LABEL } from "../utils/format";

export default function Items() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const opts = useOptions(["categories", "locations"]);
  const list = useList("/items", {
    search: "", category_id: "", location_id: "", item_type: "", stock_status: params.get("stock_status") || "", sort: "name",
  });
  const [creating, setCreating] = useState(false);
  const f = list.filters;

  return (
    <>
      <PageHead title="Barang" subtitle="Semua barang inventaris beserta posisi stoknya.">
        <Link className="btn" to="/stock-opname">Stock opname</Link>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus /> Tambah barang</button>
      </PageHead>
      <div className="panel">
        <div className="toolbar">
          <input className="input search" placeholder="Cari kode atau nama barang" value={f.search} onChange={(e) => list.setFilter("search", e.target.value)} />
          <select className="input" value={f.category_id} onChange={(e) => list.setFilter("category_id", e.target.value)}>
            <option value="">Semua kategori</option>
            {(opts.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={f.location_id} onChange={(e) => list.setFilter("location_id", e.target.value)}>
            <option value="">Semua lokasi</option>
            {(opts.locations || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={f.item_type} onChange={(e) => list.setFilter("item_type", e.target.value)}>
            <option value="">Semua jenis</option><option value="consumable">Habis pakai</option><option value="loanable">Pinjam</option>
          </select>
          <select className="input" value={f.stock_status} onChange={(e) => list.setFilter("stock_status", e.target.value)}>
            <option value="">Semua status stok</option><option value="ok">Tersedia</option><option value="low">Terbatas</option><option value="out">Habis</option>
          </select>
          <select className="input" value={f.sort} onChange={(e) => list.setFilter("sort", e.target.value)} aria-label="Urutkan">
            <option value="name">Urut nama</option><option value="code">Urut kode</option><option value="stock">Stok terendah</option><option value="newest">Terbaru</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Kode</th><th>Barang</th><th>Lokasi</th><th>Jenis</th><th>Stok</th><th>Status</th><th className="right">Harga</th></tr></thead>
            <tbody>
              <TableState colSpan={7} loading={list.loading} error={list.error} empty={!list.data.length}
                emptyTitle="Tidak ada barang yang cocok" emptyText="Ubah filter atau tambah barang baru." />
              {!list.loading && list.data.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => navigate(`/items/${i.id}`)}>
                  <td className="code">{i.code}</td>
                  <td><div className="cell-title">{i.name}</div><div className="cell-sub">{i.category?.name}</div></td>
                  <td>{i.location?.name}</td>
                  <td><Badge tone="plain">{ITEM_TYPE_LABEL[i.item_type]}</Badge></td>
                  <td><StockGauge stock={i.stock} min={i.min_stock} unit={i.unit?.name} /></td>
                  <td><StockStatus status={i.stock_status} /></td>
                  <td className="right num">{fmtMoney(i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {creating && <ItemForm onClose={() => setCreating(false)} onSaved={(it) => navigate(`/items/${it.id}`)} />}
    </>
  );
}
