import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Field } from "../components/UI";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.password) { setError("Isi username/email dan password."); return; }
    setBusy(true);
    try {
      await login(form.username.trim(), form.password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-side">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><span /><span /><span /></div>
          <div className="brand-name">SIMINV</div>
        </div>
        <div>
          <div className="shelves" aria-hidden>
            <div className="shelf"><span style={{ width: "78%" }} /></div>
            <div className="shelf"><span style={{ width: "22%" }} /></div>
            <div className="shelf"><span style={{ width: "56%" }} /></div>
            <div className="shelf"><span style={{ width: "91%" }} /></div>
          </div>
          <h1>Setiap barang tercatat, setiap perpindahan tercatat.</h1>
          <p>Pantau stok, catat barang masuk dan keluar, serta ajukan permintaan atau peminjaman barang di satu tempat.</p>
        </div>
        <div className="small" style={{ color: "#7f909b" }}>Sistem Informasi Inventaris</div>
      </div>
      <div className="login-main">
        <form className="login-card" onSubmit={submit} noValidate>
          <div>
            <h1>Masuk</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>Gunakan akun yang diberikan oleh Super Admin.</p>
          </div>
          {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
          <Field label="Username atau email">
            <input className="input" autoFocus autoComplete="username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <button className="btn btn-primary" style={{ height: 40 }} disabled={busy}>
            {busy ? "Memproses…" : "Masuk"}
          </button>
          <div className="demo-accounts">
            Akun contoh (password <b>password123</b>): superadmin, staff, user
          </div>
        </form>
      </div>
    </div>
  );
}
