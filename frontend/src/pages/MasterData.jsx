import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useUI } from "../context/UIContext";
import useList from "../hooks/useList";
import Modal from "../components/Modal";
import { IconPlus } from "../components/Icons";
import { Badge, Field, PageHead, Pagination, TableState } from "../components/UI";

const KINDS = {
  categories: { label: "Kategori", fields: [["name", "Nama kategori"], ["description", "Deskripsi", "textarea"]] },
  locations: { label: "Lokasi", fields: [["name", "Nama ruang/rak"], ["description", "Keterangan", "textarea"]] },
  units: { label: "Satuan", fields: [["name", "Nama satuan"]] },
  suppliers: { label: "Supplier", fields: [["name", "Nama supplier"], ["contact", "Nama kontak"], ["phone", "Telepon"], ["address", "Alamat", "textarea"]] },
};

function MasterForm({ kind, initial, onClose, onSaved }) {
  const { toast } = useUI();
  const cfg = KINDS[kind];
  const [form, setForm] = useState(initial || { is_active: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = initial?.id ? await api.put(`/master/${kind}/${initial.id}`, form) : await api.post(`/master/${kind}`, form);
      toast(res.data.message);
      onSaved();
    } catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <Modal title={`${initial?.id ? "Ubah" : "Tambah"} ${cfg.label.toLowerCase()}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>Simpan</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        {cfg.fields.map(([k, label, type]) => (
          <Field key={k} label={label} error={errors[k]}>
            {type === "textarea"
              ? <textarea className="input" value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              : <input className="input" value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} autoFocus={k === "name"} />}
          </Field>
        ))}
        {initial?.id && (
          <label className="check"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif (dapat dipilih saat input barang)</label>
        )}
      </div>
    </Modal>
  );
}

function MasterTable({ kind }) {
  const { toast, confirm } = useUI();
  const cfg = KINDS[kind];
  const list = useList(`/master/${kind}`, { search: "" });
  const [editing, setEditing] = useState(null);
  const extra = cfg.fields.filter(([k]) => k !== "name");

  const remove = async (o) => {
    if (!(await confirm({ title: `Hapus ${o.name}?`, message: "Jika data ini sudah dipakai, sistem hanya akan menonaktifkannya.", confirmText: "Hapus", danger: true }))) return;
    try { const r = await api.delete(`/master/${kind}/${o.id}`); toast(r.data.message); list.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <div className="panel">
      <div className="toolbar">
        <input className="input search" placeholder={`Cari ${cfg.label.toLowerCase()}`} value={list.filters.search}
          onChange={(e) => list.setFilter("search", e.target.value)} />
        <button className="btn btn-primary" onClick={() => setEditing({})}><IconPlus /> Tambah {cfg.label.toLowerCase()}</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nama</th>{extra.map(([k, l]) => <th key={k}>{l}</th>)}<th>Status</th><th /></tr></thead>
          <tbody>
            <TableState colSpan={extra.length + 3} loading={list.loading} error={list.error} empty={!list.data.length} />
            {!list.loading && list.data.map((o) => (
              <tr key={o.id}>
                <td className="cell-title">{o.name}</td>
                {extra.map(([k]) => <td key={k}>{o[k] || "-"}</td>)}
                <td>{o.is_active ? <Badge tone="ok">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                <td className="right"><div className="btn-row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-sm" onClick={() => setEditing(o)}>Ubah</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => remove(o)}>Hapus</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination meta={list.meta} page={list.page} setPage={list.setPage} />
      {editing && <MasterForm kind={kind} initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </div>
  );
}

export default function MasterData() {
  const [tab, setTab] = useState("categories");
  return (
    <>
      <PageHead title="Master data" subtitle="Data referensi yang dipakai saat mencatat barang dan transaksi." />
      <div className="tabs">
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{v.label}</button>
        ))}
      </div>
      <MasterTable key={tab} kind={tab} />
    </>
  );
}
