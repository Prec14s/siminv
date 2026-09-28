import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { Field, PageHead } from "../components/UI";
import { ROLE_LABEL } from "../utils/format";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const [form, setForm] = useState({ name: user.name, email: user.email, division: user.division || "" });
  const [pwd, setPwd] = useState({ old_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState({});

  const saveProfile = async () => {
    setErrors({});
    try { const r = await api.put("/auth/me", form); setUser(r.data.data); toast(r.data.message); }
    catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); }
  };

  const savePwd = async () => {
    if (pwd.new_password !== pwd.confirm) { setErrors({ confirm: "Konfirmasi password tidak sama" }); return; }
    setErrors({});
    try {
      const r = await api.put("/auth/change-password", pwd);
      toast(r.data.message);
      setPwd({ old_password: "", new_password: "", confirm: "" });
    } catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); }
  };

  return (
    <>
      <PageHead title="Profil" subtitle={`${user.username} · ${ROLE_LABEL[user.role]}`} />
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Data diri</h2></div>
          <div className="panel-body stack" style={{ gap: 14 }}>
            <Field label="Nama lengkap" error={errors.name}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Divisi"><input className="input" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></Field>
          </div>
          <div className="modal-foot"><button className="btn btn-primary" onClick={saveProfile}>Simpan profil</button></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Ubah password</h2></div>
          <div className="panel-body stack" style={{ gap: 14 }}>
            <Field label="Password lama" error={errors.old_password}><input className="input" type="password" autoComplete="current-password" value={pwd.old_password} onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} /></Field>
            <Field label="Password baru" error={errors.new_password} hint="Minimal 8 karakter."><input className="input" type="password" autoComplete="new-password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} /></Field>
            <Field label="Ulangi password baru" error={errors.confirm}><input className="input" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
          </div>
          <div className="modal-foot"><button className="btn btn-primary" disabled={!pwd.old_password || !pwd.new_password} onClick={savePwd}>Ubah password</button></div>
        </div>
      </div>
    </>
  );
}
