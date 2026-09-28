import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import useList from "../hooks/useList";
import Modal from "../components/Modal";
import { Badge, Field, PageHead, Pagination, TableState, TrxType } from "../components/UI";
import { fmtDate, fmtDateTime, TRX_LABEL } from "../utils/format";

function TrxDetail({ id, onClose, onChanged }) {
  const { hasRole } = useAuth();
  const { toast } = useUI();
  const [t, setT] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => { api.get(`/transactions/${id}`).then(({ data }) => setT(data.data)).catch((e) => toast(errorMessage(e), "error")); }, [id, toast]);

  const cancel = async () => {
    try {
      const r = await api.post(`/transactions/${id}/cancel`, { reason });
      toast(r.data.message); onChanged();
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  const canCancel = t && hasRole("super_admin") && !t.is_cancelled && !t.request_id && t.type !== "reversal";

  return (
    <Modal wide title={t ? t.trx_number : "Detail transaksi"} onClose={onClose}
      footer={canCancel && (cancelling
        ? <><button className="btn" onClick={() => setCancelling(false)}>Batal</button>
            <button className="btn btn-danger" disabled={!reason.trim()} onClick={cancel}>Batalkan transaksi</button></>
        : <button className="btn" onClick={() => setCancelling(true)}>Batalkan transaksi ini</button>)}>
      {!t ? <div className="loading">Memuat…</div> : (
        <div className="stack">
          {t.is_cancelled && <div className="alert warn" style={{ margin: 0 }}>Transaksi ini sudah dibatalkan dengan transaksi pembalik.</div>}
          <dl className="dl">
            <dt>Tipe</dt><dd><TrxType type={t.type} /></dd>
            <dt>Tanggal</dt><dd>{fmtDate(t.trx_date)}</dd>
            {t.supplier && <><dt>Supplier</dt><dd>{t.supplier.name}</dd></>}
            {t.recipient && <><dt>Penerima</dt><dd>{t.recipient}</dd></>}
            <dt>No. referensi</dt><dd>{t.reference_no || "-"}</dd>
            <dt>Catatan</dt><dd>{t.notes || "-"}</dd>
            <dt>Dicatat oleh</dt><dd>{t.created_by?.name}, {fmtDateTime(t.created_at)}</dd>
          </dl>
          <div className="table-wrap panel">
            <table className="table">
              <thead><tr><th>Barang</th><th className="right">Perubahan</th><th className="right">Sebelum → sesudah</th><th>Alasan</th></tr></thead>
              <tbody>{t.details.map((d) => (
                <tr key={d.id}>
                  <td><div className="cell-title">{d.item.name}</div><div className="cell-sub">{d.item.code}</div></td>
                  <td className="right num" style={{ fontWeight: 700 }}>{d.quantity > 0 ? "+" : ""}{d.quantity} {d.item.unit}</td>
                  <td className="right num">{d.stock_before} → {d.stock_after}</td>
                  <td className="small">{d.reason || "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {cancelling && (
            <Field label="Alasan pembatalan" hint="Sistem akan membuat transaksi pembalik agar stok kembali seperti sebelumnya.">
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Transactions() {
  const [params, setParams] = useSearchParams();
  const list = useList("/transactions", { search: "", type: "", date_from: "", date_to: "" });
  const openId = params.get("open");
  const f = list.filters;

  return (
    <>
      <PageHead title="Riwayat transaksi" subtitle="Setiap perubahan stok tercatat di sini.">
        <Link className="btn" to="/transactions/new/in">Barang masuk</Link>
        <Link className="btn" to="/transactions/new/out">Barang keluar</Link>
      </PageHead>
      <div className="panel">
        <div className="toolbar">
          <input className="input search" placeholder="Cari no. transaksi, referensi, atau penerima" value={f.search} onChange={(e) => list.setFilter("search", e.target.value)} />
          <select className="input" value={f.type} onChange={(e) => list.setFilter("type", e.target.value)}>
            <option value="">Semua tipe</option>
            {Object.entries(TRX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" type="date" value={f.date_from} onChange={(e) => list.setFilter("date_from", e.target.value)} aria-label="Dari tanggal" />
          <input className="input" type="date" value={f.date_to} onChange={(e) => list.setFilter("date_to", e.target.value)} aria-label="Sampai tanggal" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>No. transaksi</th><th>Tanggal</th><th>Tipe</th><th>Supplier / penerima</th><th className="right">Jumlah barang</th><th>Petugas</th></tr></thead>
            <tbody>
              <TableState colSpan={6} loading={list.loading} error={list.error} empty={!list.data.length} />
              {!list.loading && list.data.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setParams({ open: t.id })}>
                  <td className="code">{t.trx_number} {t.is_cancelled && <Badge tone="plain">dibatalkan</Badge>}</td>
                  <td>{fmtDate(t.trx_date)}</td>
                  <td><TrxType type={t.type} /></td>
                  <td>{t.supplier?.name || t.recipient || "-"}</td>
                  <td className="right num">{t.total_items}</td>
                  <td>{t.created_by?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {openId && <TrxDetail id={openId} onClose={() => setParams({})} onChanged={() => { setParams({}); list.reload(); }} />}
    </>
  );
}
