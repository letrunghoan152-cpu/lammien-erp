'use client'
// app/(dashboard)/salary/page.tsx — Phase 5: Bảng lương + Thưởng/Phạt

import { useCallback, useEffect, useState } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'
import { CardSkeleton } from '@/components/Skeletons'
import { money } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/roles'
import { SalaryListResponse, SalaryRow, BonusPenalty, BonusPenaltyListResponse } from '@/lib/types'

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Tab = 'salary' | 'bonus'

export default function SalaryPage() {
  const { hasPerm, isManager } = useAuth()
  const canView = hasPerm('salary.view_own') || hasPerm('salary.view_all') || isManager
  const canBonus = hasPerm('bonus_penalty.manage') || isManager
  const [tab, setTab] = useState<Tab>('salary')

  if (!canView) {
    return (
      <div>
        <h1 className="h1">Lương</h1>
        <div className="card note-box danger">Bạn không có quyền truy cập trang này.</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="h1">Lương</h1>
      <p className="sub">Bảng lương theo kỳ, chi tiết lương concept / add-on / thưởng − phạt.</p>
      {canBonus && (
        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          <button className={'btn sm ' + (tab === 'salary' ? '' : 'ghost')} onClick={() => setTab('salary')}>💳 Bảng lương</button>
          <button className={'btn sm ' + (tab === 'bonus' ? '' : 'ghost')} onClick={() => setTab('bonus')}>🎁 Thưởng / Phạt</button>
        </div>
      )}
      {tab === 'salary' ? <SalaryTab /> : <BonusTab />}
    </div>
  )
}

// ═══════════════════ BẢNG LƯƠNG ═══════════════════

function SalaryTab() {
  const toast = useToast()
  const [period, setPeriod] = useState(currentPeriod())
  const [data, setData] = useState<SalaryListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [detail, setDetail] = useState<SalaryRow | null>(null)

  const load = useCallback((per: string) => {
    setLoading(true)
    gasApi<SalaryListResponse>('salary.list', { period: per }).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(period) }, [period, load])

  const compute = async (lock: boolean) => {
    if (lock && !confirm('Chốt & khoá lương kỳ này? Sau khi khoá sẽ không tính lại được.')) return
    setComputing(true)
    try {
      await gasApi('salary.compute', { period, lock })
      toast(lock ? 'Đã chốt & khoá lương kỳ ' + period : 'Đã lưu snapshot lương kỳ ' + period)
      load(period)
    } catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
    finally { setComputing(false) }
  }

  const rows = data?.salary || []
  const totalGross = rows.reduce((s, r) => s + r.gross_total, 0)

  return (
    <>
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label className="label" style={{ marginBottom: 0 }}>Kỳ lương</label>
          <input type="month" className="input" style={{ width: 160 }} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        {data?.can_manage && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => compute(false)} disabled={computing}>{computing ? '…' : 'Lưu snapshot'}</button>
            <button className="btn sm" onClick={() => compute(true)} disabled={computing}>Chốt & khoá kỳ</button>
          </div>
        )}
      </div>

      {loading && !data ? <CardSkeleton lines={6} /> : (
        <>
          {data?.can_view_all && (
            <div className="row" style={{ gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <StatCard label="Số nhân sự" value={String(rows.length)} />
              <StatCard label="Tổng chi lương kỳ" value={money(totalGross)} />
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl" style={{ minWidth: 760 }}>
                <thead><tr>
                  <th>Nhân sự</th><th className="num">Lương cứng</th><th className="num">Concept</th>
                  <th className="num">Hậu kỳ</th><th className="num">Add-on</th><th className="num">Thưởng</th>
                  <th className="num">Phạt</th><th className="num">Thực nhận</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.staff_id} onClick={() => setDetail(r)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div className="dim" style={{ fontSize: 12 }}>{ROLE_LABELS[r.role_id] || r.role_id}{r.is_locked ? ' • 🔒 đã khoá' : ''}</div>
                      </td>
                      <td className="num">{money(r.base_salary)}</td>
                      <td className="num">{money(r.concept_total)}</td>
                      <td className="num">{money(r.hk_file_total)}</td>
                      <td className="num">{money(r.addon_total)}</td>
                      <td className="num" style={{ color: 'var(--green)' }}>{r.bonus_total ? '+' + money(r.bonus_total) : '—'}</td>
                      <td className="num" style={{ color: 'var(--red)' }}>{r.penalty_total ? '−' + money(r.penalty_total) : '—'}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{money(r.gross_total)}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="dim" style={{ textAlign: 'center', padding: 24 }}>Không có dữ liệu lương cho kỳ này.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={!!detail} title={detail ? 'Chi tiết lương — ' + detail.name : ''} onClose={() => setDetail(null)}>
        {detail && (
          <div>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="muted">Kỳ {period} · {ROLE_LABELS[detail.role_id] || detail.role_id}</span>
              <span style={{ fontWeight: 700 }}>{money(detail.gross_total)}</span>
            </div>
            <div className="card" style={{ background: 'var(--panel-2)', padding: 0 }}>
              <table className="tbl">
                <tbody>
                  <tr><td>Lương cứng</td><td className="num">{money(detail.base_salary)}</td></tr>
                  {detail.lines.map((l, i) => (
                    <tr key={i}><td>{l.label}</td><td className="num" style={{ color: l.amount < 0 ? 'var(--red)' : undefined }}>{l.amount < 0 ? '−' + money(-l.amount) : money(l.amount)}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}><td>Thực nhận</td><td className="num">{money(detail.gross_total)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="modal-actions"><button className="btn" onClick={() => setDetail(null)}>Đóng</button></div>
          </div>
        )}
      </Modal>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <div className="dim" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}

// ═══════════════════ THƯỞNG / PHẠT ═══════════════════

function BonusTab() {
  const toast = useToast()
  const [period, setPeriod] = useState(currentPeriod())
  const [data, setData] = useState<BonusPenaltyListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<BonusPenalty> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback((per: string) => {
    setLoading(true)
    gasApi<BonusPenaltyListResponse>('bonus_penalty.list', { period: per }).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(period) }, [period, load])

  const save = async () => {
    if (!editing?.staff_id) { setErr('Chọn nhân sự'); return }
    if (!editing?.amount || editing.amount <= 0) { setErr('Số tiền phải > 0'); return }
    setErr(''); setSaving(true)
    try {
      await gasApi('bonus_penalty.upsert', { data: editing })
      toast(editing.bp_id ? 'Đã cập nhật' : 'Đã thêm')
      setEditing(null); load(period)
    } catch (e) { setErr((e as GasError).message || 'Không thể lưu') }
    finally { setSaving(false) }
  }

  const remove = async (bp: BonusPenalty) => {
    if (!confirm('Xoá khoản này?')) return
    try {
      await gasApi('bonus_penalty.upsert', { data: { bp_id: bp.bp_id, _delete: true } })
      toast('Đã xoá'); load(period)
    } catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
  }

  const items = data?.items || []
  const staff = data?.staff || []

  return (
    <>
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label className="label" style={{ marginBottom: 0 }}>Kỳ</label>
          <input type="month" className="input" style={{ width: 160 }} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button className="btn press" onClick={() => setEditing({ staff_id: '', type: 'BONUS', amount: 0, note: '', date: period + '-01', order_id: '' })}>+ Thêm thưởng / phạt</button>
      </div>

      {loading && !data ? <CardSkeleton lines={4} /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead><tr><th>Nhân sự</th><th>Loại</th><th className="num">Số tiền</th><th>Ngày</th><th>Ghi chú</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.bp_id} onClick={() => setEditing({ ...it })} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{it.staff_name}</td>
                    <td>{it.type === 'BONUS'
                      ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Thưởng</span>
                      : <span className="pill" style={{ background: 'rgba(190,80,70,.15)', color: 'var(--red)' }}>Phạt</span>}</td>
                    <td className="num">{money(it.amount)}</td>
                    <td className="muted">{it.date}</td>
                    <td className="muted">{it.note || '—'}</td>
                    <td><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); remove(it) }}>Xoá</button></td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={6} className="dim" style={{ textAlign: 'center', padding: 24 }}>Chưa có khoản thưởng/phạt nào trong kỳ.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editing} title={editing?.bp_id ? 'Sửa thưởng / phạt' : 'Thêm thưởng / phạt'} onClose={() => setEditing(null)} small>
        {editing && (
          <div>
            {err && <div className="note-box danger" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="field"><label className="label">Nhân sự *</label>
              <select className="input" value={editing.staff_id || ''} onChange={(e) => setEditing({ ...editing, staff_id: e.target.value })}>
                <option value="">— Chọn nhân sự —</option>
                {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Loại</label>
                <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as BonusPenalty['type'] })}>
                  <option value="BONUS">Thưởng</option><option value="PENALTY">Phạt</option>
                </select>
              </div>
              <div className="field"><label className="label">Số tiền (đ)</label><input type="number" className="input" value={editing.amount || 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></div>
            </div>
            <div className="field"><label className="label">Ngày (quyết định kỳ tính)</label><input type="date" className="input" value={editing.date || ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></div>
            <div className="field"><label className="label">Ghi chú</label><input className="input" value={editing.note || ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Lý do thưởng/phạt" /></div>
            <div className="field"><label className="label">Gắn đơn (tuỳ chọn)</label><input className="input" value={editing.order_id || ''} onChange={(e) => setEditing({ ...editing, order_id: e.target.value })} placeholder="ORD-…" /></div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditing(null)} disabled={saving}>Hủy</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
