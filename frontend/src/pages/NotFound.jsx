import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="panel"><div className="empty">
      <strong>Halaman tidak ditemukan</strong>
      <p>Alamat yang Anda buka tidak ada.</p>
      <Link className="btn" to="/">Kembali ke dashboard</Link>
    </div></div>
  );
}
