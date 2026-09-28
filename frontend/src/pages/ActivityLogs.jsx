import { useEffect, useState } from "react";
import api from "../api/client";
import useList from "../hooks/useList";
import Modal from "../components/Modal";
import { PageHead, Pagination, TableState } from "../components/UI";
import { fmtDateTime } from "../utils/format";

export default function ActivityLogs() {
  const list = useList("/activity-logs", { user_id: "", action: "", date_from: "", date_to: "" }, { perPage: 20 });
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(null);
  const f = list.filters;

  useEffect(() => { api.get("/users", { params: { per_page: 100 } }).then(({ data }) => setUsers(data.data)).catch(() => {}); }, []);

  return (
    <>
      <PageHead title="Log aktivitas" subtitle="Jejak setiap aksi penting. Log tidak dapat diubah atau dihapus." />
      <div className="panel">
        <div className="toolbar">
          <select className="input" value={f.user_id} onChange={(e) => list.setFilter("user_id", e.target.value)}>
            <option value="">Semua pengguna</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="input search" placeholder="Cari aksi, contoh: APPROVE" value={f.action} onChange={(e) => list.setFilter("action", e.target.value)} />
          <input className="input" type="date" value={f.date_from} onChange={(e) => list.setFilter("date_from", e.target.value)} aria-label="Dari tanggal" />
          <input className="input" type="date" value={f.date_to} onChange={(e) => list.setFilter("date_to", e.target.value)} aria-label="Sampai tanggal" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Objek</th><th>Alamat IP</th></tr></thead>
            <tbody>
              <TableState colSpan={5} loading={list.loading} error={list.error} empty={!list.data.length} />
              {!list.loading && list.data.map((l) => (
                <tr key={l.id} className={l.old_data || l.new_data ? "clickable" : ""} onClick={() => (l.old_data || l.new_data) && setOpen(l)}>
                  <td className="small">{fmtDateTime(l.created_at)}</td>
                  <td>{l.user?.name || "-"}</td>
                  <td className="code">{l.action}</td>
                  <td>{l.entity ? `${l.entity}${l.entity_id ? ` #${l.entity_id}` : ""}` : "-"}</td>
                  <td className="small muted">{l.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {open && (
        <Modal wide title={open.action} onClose={() => setOpen(null)}>
          <div className="grid-2">
            <div><h3 style={{ marginBottom: 8 }}>Sebelum</h3><pre className="panel small" style={{ padding: 12, overflow: "auto", margin: 0 }}>{JSON.stringify(open.old_data, null, 2) || "-"}</pre></div>
            <div><h3 style={{ marginBottom: 8 }}>Sesudah</h3><pre className="panel small" style={{ padding: 12, overflow: "auto", margin: 0 }}>{JSON.stringify(open.new_data, null, 2) || "-"}</pre></div>
          </div>
        </Modal>
      )}
    </>
  );
}
