import { useSearchParams } from "react-router-dom";
import useList from "../hooks/useList";
import RequestDetail from "../components/RequestDetail";
import { PageHead, Pagination, RequestStatus, TableState } from "../components/UI";
import { fmtDate, REQ_TYPE_LABEL } from "../utils/format";

const TABS = [
  ["pending", "Menunggu"], ["approved", "Siap diserahkan"], ["handed_over", "Sedang dipinjam"],
  ["overdue", "Terlambat"], ["", "Semua"],
];

export default function ManageRequests() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("status") ?? "pending";
  const list = useList("/requests", { status: initial, type: "", search: "" });
  const openId = params.get("id");

  const setTab = (s) => { list.setFilter("status", s); setParams(s ? { status: s } : {}); };
  const close = () => { const p = new URLSearchParams(params); p.delete("id"); setParams(p); };
  const open = (id) => { const p = new URLSearchParams(params); p.set("id", id); setParams(p); };

  return (
    <>
      <PageHead title="Kelola pengajuan" subtitle="Setujui, serahkan, dan catat pengembalian barang." />
      <div className="tabs">
        {TABS.map(([k, l]) => <button key={k} className={list.filters.status === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="panel">
        <div className="toolbar">
          <input className="input search" placeholder="Cari no. pengajuan atau keperluan" value={list.filters.search} onChange={(e) => list.setFilter("search", e.target.value)} />
          <select className="input" value={list.filters.type} onChange={(e) => list.setFilter("type", e.target.value)}>
            <option value="">Semua jenis</option><option value="request">Permintaan</option><option value="loan">Peminjaman</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>No. pengajuan</th><th>Pengaju</th><th>Jenis</th><th>Keperluan</th><th>Dibutuhkan</th><th>Kembali</th><th>Status</th></tr></thead>
            <tbody>
              <TableState colSpan={7} loading={list.loading} error={list.error} empty={!list.data.length} emptyTitle="Tidak ada pengajuan di sini" />
              {!list.loading && list.data.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => open(r.id)}>
                  <td className="code">{r.request_number}</td>
                  <td><div className="cell-title">{r.requester?.name}</div><div className="cell-sub">{r.requester?.division || "-"}</div></td>
                  <td>{REQ_TYPE_LABEL[r.type]}</td>
                  <td style={{ maxWidth: 260 }}>{r.purpose}</td>
                  <td>{fmtDate(r.needed_date)}</td>
                  <td>{r.type === "loan" ? fmtDate(r.return_due_date) : "-"}</td>
                  <td><RequestStatus status={r.status} overdue={r.is_overdue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {openId && <RequestDetail manage id={openId} onClose={close} onChanged={list.reload} />}
    </>
  );
}
