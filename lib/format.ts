// lib/format.ts — helper định dạng dữ liệu (PRD Section 15.7)

/** 2250000 → "2.250.000 đ" */
export function money(n: number | string | null | undefined): string {
  return (Number(n) || 0).toLocaleString('vi-VN') + ' đ'
}

/** ISO/Date → "dd/MM/yyyy HH:mm" theo GMT+7 */
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v.includes('T') ? v : v.replace(' ', 'T')) : v
  if (isNaN(d.getTime())) return String(v)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "2026-06-28" → "28/06/2026" */
export function fmtDay(v: string | null | undefined): string {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

/** Giá trị rỗng → em dash */
export function dash(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/** Lấy 1–2 chữ cái đầu từ tên KH cho initials avatar (PRD Section 15.17B) */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'
}

/** ISO → value cho <input type="datetime-local"> */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** value <input datetime-local> → ISO */
export function fromLocalInput(local: string): string {
  if (!local) return ''
  return new Date(local).toISOString()
}

/** Số tiền còn lại: đơn HUỶ → 0; ngược lại max(total − paid, 0) */
export function remaining(total: number, paid: number, status?: string): number {
  if (status === 'HUY') return 0
  return Math.max((Number(total) || 0) - (Number(paid) || 0), 0)
}
