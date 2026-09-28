import { useEffect, useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client";
import { useUI } from "../context/UIContext";
import useOptions from "../hooks/useOptions";
import Modal from "../components/Modal";
import { Field } from "../components/UI";

const EMPTY = { code: "", name: "", category_id: "", location_id: "", unit_id: "", item_type: "consumable",
  min_stock: 0, price: 0, description: "", initial_stock: 0 };

export default function ItemForm({ initial, onClose, onSaved }) {
  const { toast } = useUI();
  const opts = useOptions(["categories", "locations", "units"]);
  const editing = !!initial?.id;
  const [form, setForm] = useState(editing ? {
    ...initial, category_id: initial.category_id, location_id: initial.location_id, unit_id: initial.unit_id,
    description: initial.description || "",
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (!editing) api.get("/items/next-code").then(({ data }) => setForm((f) => ({ ...f, code: f.code || data.data.code }))).catch(() => {});
  }, [editing]);

  const save = async () => {
    setBusy(true); setErrors({});
    try {
      const res = editing ? await api.put(`/items/${initial.id}`, form) : await api.post("/items", form);
      toast(res.data.message);
      onSaved(res.data.data);
    } catch (e) { setErrors(fieldErrors(e)); toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const select = (k, list, label) => (
    <Field label={label} error={errors[k]}>
      <select className={`input ${errors[k] ? "invalid" : ""}`} value={form[k]} onChange={set(k)}>
        <option value="">Pilih {label.toLowerCase()}</option>
        {(list || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </Field>
  );

  return (
    <Modal wide title={editing ? `Ubah barang ${initial.code}` : "Tambah barang"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{editing ? "Simpan perubahan" : "Tambah barang"}</button></>}>
      <div className="form-grid">
        <Field label="Kode barang" error={errors.code} hint="Dibuat otomatis, boleh diubah.">
          <input className="input" value={form.code} onChange={set("code")} />
        </Field>
        <Field label="Nama barang" error={errors.name}><input className="input" value={form.name} onChange={set("name")} /></Field>
        {select("category_id", opts.categories, "Kategori")}
        {select("location_id", opts.locations, "Lokasi")}
        {select("unit_id", opts.units, "Satuan")}
        <Field label="Jenis barang" hint={form.item_type === "loanable" ? "Dapat dipinjam dan wajib dikembalikan." : "Berkurang permanen saat dikeluarkan."}>
          <select className="input" value={form.item_type} onChange={set("item_type")}>
            <option value="consumable">Habis pakai</option><option value="loanable">Pinjam</option>
          </select>
        </Field>
        <Field label="Stok minimum" error={errors.min_stock} hint="Sistem memberi peringatan saat stok mencapai angka ini.">
          <input className="input" type="number" min="0" value={form.min_stock} onChange={set("min_stock")} />
        </Field>
        <Field label="Harga satuan (Rp)" error={errors.price}>
          <input className="input" type="number" min="0" value={form.price} onChange={set("price")} />
        </Field>
        {!editing && (
          <Field label="Stok awal" error={errors.initial_stock} hint="Dicatat sebagai transaksi stok awal.">
            <input className="input" type="number" min="0" value={form.initial_stock} onChange={set("initial_stock")} />
          </Field>
        )}
        <Field label="Deskripsi" className="full"><textarea className="input" value={form.description} onChange={set("description")} /></Field>
        {editing && <div className="full alert" style={{ margin: 0 }}>Stok tidak dapat diubah di sini. Gunakan barang masuk, barang keluar, atau stock opname.</div>}
      </div>
    </Modal>
  );
}
