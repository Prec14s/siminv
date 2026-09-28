import { useEffect, useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useUI } from "../context/UIContext";
import { Field, PageHead } from "../components/UI";

export default function Settings() {
  const { toast } = useUI();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings").then(({ data }) => setForm(data.data)).catch((e) => toast(errorMessage(e), "error")); }, [toast]);

  const save = async () => {
    setBusy(true); setErrors({});
    try { const r = await api.put("/settings", form); setForm(r.data.data); toast(r.data.message); }
    catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  if (!form) return <div className="loading">Memuat pengaturan…</div>;
  return (
    <>
      <PageHead title="Pengaturan" subtitle="Berlaku untuk seluruh pengguna." />
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-body stack" style={{ gap: 16 }}>
          <Field label="Nama instansi" hint="Tampil di sidebar dan kop laporan.">
            <input className="input" value={form.institution_name} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} />
          </Field>
          <Field label="Durasi peminjaman maksimum (hari)" error={errors.max_loan_days}>
            <input className="input" type="number" min="1" value={form.max_loan_days} onChange={(e) => setForm({ ...form, max_loan_days: e.target.value })} style={{ maxWidth: 160 }} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.email_notifications === "true"} onChange={(e) => setForm({ ...form, email_notifications: e.target.checked ? "true" : "false" })} />
            Kirim notifikasi lewat email (memerlukan konfigurasi SMTP di server)
          </label>
        </div>
        <div className="modal-foot"><button className="btn btn-primary" disabled={busy} onClick={save}>Simpan pengaturan</button></div>
      </div>
    </>
  );
}
