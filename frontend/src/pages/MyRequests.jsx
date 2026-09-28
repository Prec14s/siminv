import { Link, useSearchParams } from "react-router-dom";
import useList from "../hooks/useList";
import RequestDetail from "../components/RequestDetail";
import { PageHead, Pagination, RequestStatus, TableState } from "../components/UI";
import { fmtDate, REQ_STATUS, REQ_TYPE_LABEL } from "../utils/format";

export default function MyRequests() {
  const [params, setParams] = useSearchParams();
  const list = useList("/requests", { mine: 1, status: "", type: "" });
  const openId = params.get("id");

  return (
    <>
      <PageHead title="Pengajuan saya" subtitle="Pantau status permintaan dan peminjaman yang Anda ajukan.">
        <Link className="btn btn-primary" to="/catalog">Buat pengajuan</Link>
      </PageHead>
      <div className="panel">
        <div className="toolbar">
          <select className="input" value={list.filters.type} onChange={(e) => list.setFilter("type", e.target.value)}>
            <option value="">Semua jenis</option><option value="request">Permintaan</option><option value="loan">Peminjaman</option>
          </select>
          <select className="input" value={list.filters.status} onChange={(e) => list.setFilter("status", e.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(REQ_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>No. pengajuan</th><th>Jenis</th><th>Keperluan</th><th>Dibutuhkan</th><th className="right">Barang</th><th>Status</th></tr></thead>
            <tbody>
              <TableState colSpan={6} loading={list.loading} error={list.error} empty={!list.data.length}
                emptyTitle="Belum ada pengajuan" emptyText="Buka katalog untuk mengajukan barang." />
              {!list.loading && list.data.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setParams({ id: r.id })}>
                  <td className="code">{r.request_number}</td>
                  <td>{REQ_TYPE_LABEL[r.type]}</td>
                  <td style={{ maxWidth: 280 }}>{r.purpose}</td>
                  <td>{fmtDate(r.needed_date)}</td>
                  <td className="right num">{r.total_items}</td>
                  <td><RequestStatus status={r.status} overdue={r.is_overdue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {openId && <RequestDetail id={openId} onClose={() => setParams({})} onChanged={list.reload} />}
    </>
  );
}
