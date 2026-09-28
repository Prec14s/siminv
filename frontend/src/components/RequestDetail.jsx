import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import Modal from "./Modal";
import { Field, RequestStatus } from "./UI";
import { CONDITION_LABEL, fmtDate, fmtDateTime, REQ_TYPE_LABEL } from "../utils/format";

/** Detail pengajuan. Untuk Staff/Super Admin (manage=true) menampilkan aksi sesuai status. */
export default function RequestDetail({ id, manage = false, onClose, onChanged }) {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const [r, setR] = useState(null);
  const [mode, setMode] = useState(null); // approve | reject | return
  const [qty, setQty] = useState({});
  const [ret, setRet] = useState({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(() => api.get(`/requests/${id}`).then(({ data }) => {
    setR(data.data);
    setQty(Object.fromEntries(data.data.items.map((i) => [i.id, i.qty_requested])));
    setRet(Object.fromEntries(data.data.items.map((i) => [i.id, { qty_good: i.qty_approved || 0, qty_damaged: 0, qty_lost: 0 }])));
  }).catch((e) => { toast(errorMessage(e), "error"); closeRef.current(); }), [id, toast]);

  useEffect(() => { load(); }, [load]);

  const act = async (path, body, needConfirm) => {
    if (needConfirm && !(await confirm(needConfirm))) return;
    setBusy(true);
    try {
      const res = await api.post(`/requests/${id}/${path}`, body || {});
      toast(res.data.message);
      setMode(null); setText("");
      await load();
      onChanged?.();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  if (!r) return <Modal title="Detail pengajuan" onClose={onClose}><div className="loading">Memuat…</div></Modal>;

  const isOwner = r.requester?.id === user.id;
  const showApproved = r.items.some((i) => i.qty_approved !== null);
  const retValid = r.items.every((i) => !i.qty_approved || ["qty_good", "qty_damaged", "qty_lost"].reduce((s, k) => s + Number(ret[i.id]?.[k] || 0), 0) === i.qty_approved);

  let footer = null;
  if (mode === "approve") footer = <><button className="btn" onClick={() => setMode(null)}>Kembali</button><button className="btn btn-primary" disabled={busy} onClick={() => act("approve", { notes: text, items: r.items.map((i) => ({ id: i.id, qty_approved: Number(qty[i.id]) })) })}>Setujui pengajuan</button></>;
  else if (mode === "reject") footer = <><button className="btn" onClick={() => setMode(null)}>Kembali</button><button className="btn btn-danger" disabled={busy || !text.trim()} onClick={() => act("reject", { reason: text })}>Tolak pengajuan</button></>;
  else if (mode === "return") footer = <><button className="btn" onClick={() => setMode(null)}>Kembali</button><button className="btn btn-primary" disabled={busy || !retValid} onClick={() => act("return", { notes: text, items: r.items.map((i) => ({ id: i.id, ...Object.fromEntries(Object.entries(ret[i.id]).map(([k, v]) => [k, Number(v)])) })) })}>Simpan pengembalian</button></>;
  else if (manage && r.status === "pending") footer = <><button className="btn" onClick={() => setMode("reject")}>Tolak</button><button className="btn btn-primary" onClick={() => setMode("approve")}>Tinjau dan setujui</button></>;
  else if (manage && r.status === "approved") footer = <button className="btn btn-primary" disabled={busy} onClick={() => act("handover", null, { title: "Serahkan barang?", message: "Stok akan berkurang sesuai jumlah yang disetujui.", confirmText: "Serahkan barang" })}>Serahkan barang</button>;
  else if (manage && r.status === "handed_over" && r.type === "loan") footer = <button className="btn btn-primary" onClick={() => setMode("return")}>Catat pengembalian</button>;
  else if (isOwner && r.status === "pending") footer = <button className="btn btn-danger" disabled={busy} onClick={() => act("cancel", null, { title: "Batalkan pengajuan?", message: "Pengajuan yang dibatalkan tidak dapat diaktifkan kembali.", confirmText: "Batalkan pengajuan", danger: true })}>Batalkan pengajuan</button>;

  return (
    <Modal wide title={r.request_number} onClose={onClose} footer={footer}>
      <div className="stack">
        {r.is_overdue && <div className="alert error" style={{ margin: 0 }}>Peminjaman ini melewati tanggal kembali ({fmtDate(r.return_due_date)}).</div>}
        {r.status === "approved" && !manage && <div className="alert" style={{ margin: 0 }}>Pengajuan disetujui. Silakan ambil barang di petugas inventaris.</div>}
        <dl className="dl">
          <dt>Status</dt><dd><RequestStatus status={r.status} overdue={r.is_overdue} /></dd>
          <dt>Jenis</dt><dd>{REQ_TYPE_LABEL[r.type]}</dd>
          <dt>Pengaju</dt><dd>{r.requester?.name}{r.requester?.division ? `, ${r.requester.division}` : ""}</dd>
          <dt>Keperluan</dt><dd>{r.purpose}</dd>
          <dt>Tanggal dibutuhkan</dt><dd>{fmtDate(r.needed_date)}</dd>
          {r.type === "loan" && <><dt>Rencana kembali</dt><dd>{fmtDate(r.return_due_date)}</dd></>}
          {r.rejection_reason && <><dt>Alasan ditolak</dt><dd>{r.rejection_reason}</dd></>}
          {r.staff_notes && <><dt>Catatan petugas</dt><dd style={{ whiteSpace: "pre-line" }}>{r.staff_notes}</dd></>}
        </dl>

        <div className="panel table-wrap">
          <table className="table">
            <thead><tr>
              <th>Barang</th><th className="right">Diminta</th>
              {(showApproved || mode === "approve") && <th className="right">Disetujui</th>}
              {manage && r.status === "pending" && <th className="right">Stok tersedia</th>}
              {mode === "return" && <><th>Baik</th><th>Rusak</th><th>Hilang</th></>}
              {r.status === "returned" && <th>Kondisi kembali</th>}
            </tr></thead>
            <tbody>{r.items.map((i) => (
              <tr key={i.id}>
                <td><div className="cell-title">{i.item.name}</div><div className="cell-sub">{i.item.code}</div></td>
                <td className="right num">{i.qty_requested} {i.item.unit}</td>
                {mode === "approve"
                  ? <td className="right"><input className="input qty-input" type="number" min="0" max={i.qty_requested} value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} /></td>
                  : showApproved && <td className="right num">{i.qty_approved ?? "-"}</td>}
                {manage && r.status === "pending" && <td className="right num" style={{ color: i.item.stock < i.qty_requested ? "var(--out)" : undefined }}>{i.item.stock}</td>}
                {mode === "return" && ["qty_good", "qty_damaged", "qty_lost"].map((k) => (
                  <td key={k}><input className="input qty-input" type="number" min="0" disabled={!i.qty_approved} value={ret[i.id]?.[k] ?? 0} onChange={(e) => setRet({ ...ret, [i.id]: { ...ret[i.id], [k]: e.target.value } })} /></td>
                ))}
                {r.status === "returned" && <td>{i.qty_approved ? CONDITION_LABEL[i.return_condition] : "-"}</td>}
              </tr>
            ))}</tbody>
          </table>
        </div>

        {mode === "approve" && <Field label="Catatan untuk pengaju (opsional)" hint="Kurangi jumlah untuk menyetujui sebagian."><input className="input" value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {mode === "reject" && <Field label="Alasan penolakan" hint="Alasan akan dikirim ke pengaju."><textarea className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {mode === "return" && <>
          {!retValid && <div className="alert warn" style={{ margin: 0 }}>Jumlah baik + rusak + hilang harus sama dengan jumlah yang dipinjam.</div>}
          <Field label="Catatan pengembalian (opsional)" hint="Hanya barang kondisi baik yang kembali ke stok."><input className="input" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        </>}

        <ul className="timeline small">
          <li>Diajukan {fmtDateTime(r.created_at)}</li>
          {r.approved_at && <li>{r.status === "rejected" ? "Ditolak" : "Disetujui"} oleh {r.approver?.name}, {fmtDateTime(r.approved_at)}</li>}
          {r.handed_over_at && <li>Barang diserahkan {fmtDateTime(r.handed_over_at)}</li>}
          {r.returned_at && <li>Barang dikembalikan {fmtDateTime(r.returned_at)}</li>}
          {r.status === "cancelled" && <li>Dibatalkan oleh pengaju</li>}
        </ul>
      </div>
    </Modal>
  );
}
