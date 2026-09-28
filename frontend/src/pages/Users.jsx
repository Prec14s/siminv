import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import useList from "../hooks/useList";
import Modal from "../components/Modal";
import { IconPlus } from "../components/Icons";
import { Badge, Field, PageHead, Pagination, TableState } from "../components/UI";
import { fmtDateTime, ROLE_LABEL } from "../utils/format";

const EMPTY = { name: "", username: "", email: "", role: "user", division: "", password: "" };

function UserForm({ initial, onClose, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(initial || EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErrors({});
    try {
      const res = initial ? await api.put(`/users/${initial.id}`, form) : await api.post("/users", form);
      toast(res.data.message);
      onSaved();
    } catch (e) {
      setErrors(fieldErrors(e));
      toast(errorMessage(e), "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? "Ubah pengguna" : "Tambah pengguna"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{initial ? "Simpan perubahan" : "Tambah pengguna"}</button></>}>
      <div className="form-grid">
        <Field label="Nama lengkap" error={errors.name} className="full"><input className="input" value={form.name} onChange={set("name")} /></Field>
        <Field label="Username" error={errors.username}><input className="input" value={form.username} onChange={set("username")} /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Peran" error={errors.role}>
          <select className="input" value={form.role} onChange={set("role")}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Divisi"><input className="input" value={form.division || ""} onChange={set("division")} /></Field>
        {!initial && (
          <Field label="Password awal" error={errors.password} hint="Minimal 8 karakter. Minta pengguna menggantinya setelah login." className="full">
            <input className="input" type="text" value={form.password} onChange={set("password")} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function ResetPassword({ user, onClose }) {
  const { toast } = useUI();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: pwd });
      toast(`Password ${user.name} berhasil direset`);
      onClose();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Reset password: ${user.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || pwd.length < 8}>Reset password</button></>}>
      <Field label="Password baru" hint="Minimal 8 karakter. Sampaikan kepada pengguna secara langsung.">
        <input className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { toast, confirm } = useUI();
  const list = useList("/users", { search: "", role: "", status: "" });
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);

  const toggle = async (u) => {
    const ok = await confirm({
      title: u.is_active ? "Nonaktifkan akun?" : "Aktifkan akun?",
      message: u.is_active ? `${u.name} tidak akan bisa login sampai akunnya diaktifkan kembali. Riwayat datanya tetap tersimpan.` : `${u.name} akan bisa login kembali.`,
      confirmText: u.is_active ? "Nonaktifkan" : "Aktifkan", danger: u.is_active,
    });
    if (!ok) return;
    try {
      const res = await api.patch(`/users/${u.id}/status`, { is_active: !u.is_active });
      toast(res.data.message);
      list.reload();
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <>
      <PageHead title="Pengguna" subtitle="Kelola akun dan peran setiap orang yang memakai sistem.">
        <button className="btn btn-primary" onClick={() => setEditing({})}><IconPlus /> Tambah pengguna</button>
      </PageHead>
      <div className="panel">
        <div className="toolbar">
          <input className="input search" placeholder="Cari nama, username, atau email" value={list.filters.search}
            onChange={(e) => list.setFilter("search", e.target.value)} />
          <select className="input" value={list.filters.role} onChange={(e) => list.setFilter("role", e.target.value)}>
            <option value="">Semua peran</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" value={list.filters.status} onChange={(e) => list.setFilter("status", e.target.value)}>
            <option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nama</th><th>Peran</th><th>Divisi</th><th>Status</th><th>Login terakhir</th><th /></tr></thead>
            <tbody>
              <TableState colSpan={6} loading={list.loading} error={list.error} empty={!list.data.length} />
              {!list.loading && list.data.map((u) => (
                <tr key={u.id}>
                  <td><div className="cell-title">{u.name}</div><div className="cell-sub">{u.username} · {u.email}</div></td>
                  <td><Badge tone={u.role === "super_admin" ? "primary" : u.role === "staff" ? "info" : ""}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td>{u.division || "-"}</td>
                  <td>{u.is_active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="out">Nonaktif</Badge>}</td>
                  <td className="small">{fmtDateTime(u.last_login_at)}</td>
                  <td className="right">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-sm" onClick={() => setEditing(u)}>Ubah</button>
                      <button className="btn btn-sm" onClick={() => setResetting(u)}>Reset password</button>
                      {u.id !== me.id && (
                        <button className="btn btn-sm btn-ghost" onClick={() => toggle(u)}>{u.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      </div>
      {editing && <UserForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}
