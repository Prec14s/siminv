import { REQ_STATUS, STOCK_STATUS, TRX_LABEL, TRX_TONE } from "../utils/format";

export function Badge({ tone = "", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function RequestStatus({ status, overdue }) {
  if (overdue) return <Badge tone="out">Terlambat</Badge>;
  const [label, tone] = REQ_STATUS[status] || [status, ""];
  return <Badge tone={tone}>{label}</Badge>;
}

export function StockStatus({ status }) {
  const [label, tone] = STOCK_STATUS[status] || [status, ""];
  return <Badge tone={tone}>{label}</Badge>;
}

export function TrxType({ type }) {
  return <Badge tone={TRX_TONE[type]}>{TRX_LABEL[type] || type}</Badge>;
}

/** Gauge stok: isi bar menunjukkan stok, garis gelap menandai batas minimum. */
export function StockGauge({ stock, min, unit }) {
  const scale = Math.max(stock, min * 3, 1);
  const status = stock <= 0 ? "out" : stock <= min ? "low" : "ok";
  return (
    <div className={`gauge ${status}`} title={`Stok ${stock}, minimum ${min}`}>
      <div className="gauge-top">
        <span className="gauge-num">{stock}</span>
        <span className="gauge-unit">{unit}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min((stock / scale) * 100, 100)}%` }} />
        {min > 0 && <div className="gauge-min" style={{ left: `${(min / scale) * 100}%` }} />}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Pagination({ meta, page, setPage }) {
  if (!meta || !meta.total) return null;
  const from = (meta.page - 1) * meta.per_page + 1;
  const to = Math.min(meta.page * meta.per_page, meta.total);
  return (
    <div className="pager">
      <span>{from}–{to} dari {meta.total} data</span>
      <div className="btn-row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
        <span className="num">Hal. {meta.page} / {meta.pages || 1}</span>
        <button className="btn btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Berikutnya</button>
      </div>
    </div>
  );
}

export function TableState({ loading, error, empty, colSpan, emptyTitle = "Belum ada data", emptyText }) {
  if (loading) return <tr><td colSpan={colSpan}><div className="loading">Memuat data…</div></td></tr>;
  if (error) return <tr><td colSpan={colSpan}><div className="alert error" style={{ margin: 0 }}>{error}</div></td></tr>;
  if (empty) return (
    <tr><td colSpan={colSpan}><div className="empty"><strong>{emptyTitle}</strong>{emptyText}</div></td></tr>
  );
  return null;
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="btn-row">{children}</div>}
    </div>
  );
}
