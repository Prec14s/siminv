export const ROLE_LABEL = { super_admin: "Super Admin", staff: "Staff", user: "User" };
export const ITEM_TYPE_LABEL = { consumable: "Habis pakai", loanable: "Pinjam" };
export const TRX_LABEL = {
  initial: "Stok awal", in: "Masuk", out: "Keluar", adjustment: "Penyesuaian",
  return: "Pengembalian", reversal: "Pembatalan",
};
export const TRX_TONE = { initial: "info", in: "ok", out: "out", adjustment: "low", return: "ok", reversal: "plain" };
export const REQ_TYPE_LABEL = { request: "Permintaan", loan: "Peminjaman" };
export const REQ_STATUS = {
  pending: ["Menunggu", "low"],
  approved: ["Disetujui", "info"],
  rejected: ["Ditolak", "out"],
  handed_over: ["Dipinjam", "primary"],
  returned: ["Dikembalikan", "ok"],
  completed: ["Selesai", "ok"],
  cancelled: ["Dibatalkan", "plain"],
};
export const STOCK_STATUS = { ok: ["Tersedia", "ok"], low: ["Terbatas", "low"], out: ["Habis", "out"] };
export const CONDITION_LABEL = { good: "Baik", damaged: "Ada yang rusak", lost: "Ada yang hilang" };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const dtFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtDate = (v) => (v ? dateFmt.format(new Date(v.length === 10 ? v + "T00:00:00" : v)) : "-");
export const fmtDateTime = (v) => (v ? dtFmt.format(new Date(v)) : "-");
export const fmtMoney = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v || 0);
export const fmtMoneyShort = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(v || 0);
export const fmtNum = (v) => new Intl.NumberFormat("id-ID").format(v || 0);
export const today = () => new Date().toLocaleDateString("en-CA");
export const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

export function timeAgo(v) {
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 604800) return `${Math.floor(s / 86400)} hari lalu`;
  return fmtDate(v);
}
