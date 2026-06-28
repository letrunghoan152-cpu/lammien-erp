'use client'
// app/(dashboard)/catalog/page.tsx — Phase 4: Quản lý Dịch vụ / Add-on / Voucher

import { useCallback, useEffect, useState } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'
import { CardSkeleton } from '@/components/Skeletons'
import { invalidateCache } from '@/lib/cache'
import { money, fmtDay } from '@/lib/format'
import { CatalogManageResponse, Service, AddonCatalog, Voucher } from '@/lib/types'

type Tab = 'services' | 'addons' | 'vouchers'

export default function CatalogPage() {
  const { hasPerm, isManager } = useAuth()
  const canView = hasPerm('service_catalog.view') || isManager
  const [tab, setTab] = useState<Tab>('services')
  const [data, setData] = useState<CatalogManageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    gasApi<CatalogManageResponse>('catalog.manageList').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (canView) load() }, [canView, load])

  if (!canView) {
    return (
      <div>
        <h1 className="h1">Danh mục</h1>
        <div className="card note-box danger">Bạn không có quyền truy cập trang này.</div>
      </div>
    )
  }

  const can = data?.can

  return (
    <div>
      <h1 className="h1">Danh mục</h1>
      <p className="sub">Quản lý dịch vụ, add-on và voucher của studio.</p>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={'btn sm ' + (tab === 'services' ? '' : 'ghost')} onClick={() => setTab('services')}>📸 Dịch vụ</button>
        <button className={'btn sm ' + (tab === 'addons' ? '' : 'ghost')} onClick={() => setTab('addons')}>🧩 Add-on</button>
        {(can?.vouchers || (data?.vouchers?.length ?? 0) > 0) &&
          <button className={'btn sm ' + (tab === 'vouchers' ? '' : 'ghost')} onClick={() => setTab('vouchers')}>🎟️ Voucher</button>}
      </div>

      {loading && !data ? <CardSkeleton lines={6} /> : (
        <>
          {tab === 'services' && <ServicesTab data={data!} reload={load} />}
          {tab === 'addons' && <AddonsTab data={data!} reload={load} />}
          {tab === 'vouchers' && <VouchersTab data={data!} reload={load} />}
        </>
      )}
    </div>
  )
}

// ═══════════════════ DỊCH VỤ ═══════════════════

const EMPTY_SERVICE: Partial<Service> = {
  name: '', description: '', suggested_price: 0, duration_minutes: 60, includes_print: false,
  print_spec: '', sample_photo_urls: [], cover_photo_url: null, is_active: true,
  default_photographer_salary: 0, default_mua_salary: 0, default_hau_ky_rate_per_file: 0,
  default_support_salary: 0, default_sale_commission_pct: 0,
}

function ServicesTab({ data, reload }: { data: CatalogManageResponse; reload: () => void }) {
  const toast = useToast()
  const canEdit = data.can.services
  const canSalary = data.can.salary
  const [editing, setEditing] = useState<Partial<Service> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!editing?.name) { setErr('Thiếu tên dịch vụ'); return }
    setErr(''); setSaving(true)
    try {
      await gasApi('services.upsert', { data: editing })
      invalidateCache('services'); invalidateCache('all')
      toast(editing.service_id ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ')
      setEditing(null); reload()
    } catch (e) { setErr((e as GasError).message || 'Không thể lưu') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="muted">{data.services.length} dịch vụ</span>
        {canEdit && <button className="btn press" onClick={() => setEditing({ ...EMPTY_SERVICE })}>+ Thêm dịch vụ</button>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr>
              <th>Dịch vụ</th><th className="num">Giá tham khảo</th><th className="num">Thời lượng</th>
              <th>In ảnh</th>{canSalary && <th className="num">Lương PG</th>}<th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {data.services.map((s) => (
                <tr key={s.service_id} onClick={() => canEdit && setEditing({ ...s })} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.description && <div className="dim" style={{ fontSize: 12 }}>{s.description}</div>}
                  </td>
                  <td className="num">{money(s.suggested_price)}</td>
                  <td className="num">{s.duration_minutes} phút</td>
                  <td>{s.includes_print ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Có</span> : <span className="dim">—</span>}</td>
                  {canSalary && <td className="num">{money(s.default_photographer_salary || 0)}</td>}
                  <td>{s.is_active
                    ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Hoạt động</span>
                    : <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted-2)' }}>Ẩn</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.service_id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={() => setEditing(null)}>
        {editing && (
          <ServiceForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} saving={saving} err={err} canSalary={canSalary} />
        )}
      </Modal>
    </>
  )
}

function ServiceForm({ value, onChange, onSave, onCancel, saving, err, canSalary }: {
  value: Partial<Service>; onChange: (v: Partial<Service>) => void; onSave: () => void
  onCancel: () => void; saving: boolean; err: string; canSalary: boolean
}) {
  const set = (patch: Partial<Service>) => onChange({ ...value, ...patch })
  return (
    <div>
      {err && <div className="note-box danger" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="field"><label className="label">Tên dịch vụ *</label><input className="input" value={value.name || ''} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="field"><label className="label">Mô tả</label><input className="input" value={value.description || ''} onChange={(e) => set({ description: e.target.value })} /></div>
      <div className="grid-2">
        <div className="field"><label className="label">Giá tham khảo (đ)</label><input type="number" className="input" value={value.suggested_price || 0} onChange={(e) => set({ suggested_price: Number(e.target.value) })} /></div>
        <div className="field"><label className="label">Thời lượng (phút)</label><input type="number" className="input" value={value.duration_minutes || 0} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="label">Có in ảnh?</label>
          <select className="input" value={value.includes_print ? '1' : '0'} onChange={(e) => set({ includes_print: e.target.value === '1' })}>
            <option value="0">Không</option><option value="1">Có</option>
          </select>
        </div>
        <div className="field"><label className="label">Quy cách in</label><input className="input" value={value.print_spec || ''} onChange={(e) => set({ print_spec: e.target.value })} placeholder="VD: Album 20x30" disabled={!value.includes_print} /></div>
      </div>
      <div className="field"><label className="label">Ảnh bìa (URL)</label><input className="input" value={value.cover_photo_url || ''} onChange={(e) => set({ cover_photo_url: e.target.value || null })} placeholder="https://…" /></div>
      <div className="field"><label className="label">Ảnh mẫu (URL, cách nhau bằng dấu phẩy)</label>
        <input className="input" value={(value.sample_photo_urls || []).join(', ')} onChange={(e) => set({ sample_photo_urls: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="https://…, https://…" />
      </div>

      {canSalary && (
        <div className="card" style={{ background: 'var(--panel-2)', marginTop: 4 }}>
          <div className="label" style={{ marginBottom: 8 }}>Lương mặc định theo dịch vụ (concept 1; concept 2+ tính 50%)</div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 8 }}><label className="label">Lương Photographer / concept</label><input type="number" className="input" value={value.default_photographer_salary || 0} onChange={(e) => set({ default_photographer_salary: Number(e.target.value) })} /></div>
            <div className="field" style={{ marginBottom: 8 }}><label className="label">Lương MUA / concept</label><input type="number" className="input" value={value.default_mua_salary || 0} onChange={(e) => set({ default_mua_salary: Number(e.target.value) })} /></div>
          </div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 8 }}><label className="label">Lương Support / concept</label><input type="number" className="input" value={value.default_support_salary || 0} onChange={(e) => set({ default_support_salary: Number(e.target.value) })} /></div>
            <div className="field" style={{ marginBottom: 8 }}><label className="label">Rate Hậu kỳ / file (đ)</label><input type="number" className="input" value={value.default_hau_ky_rate_per_file || 0} onChange={(e) => set({ default_hau_ky_rate_per_file: Number(e.target.value) })} /></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label className="label">% hoa hồng Sale trên giá concept</label><input type="number" className="input" value={value.default_sale_commission_pct || 0} onChange={(e) => set({ default_sale_commission_pct: Number(e.target.value) })} /></div>
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}><label className="label">Trạng thái</label>
        <select className="input" value={value.is_active ? '1' : '0'} onChange={(e) => set({ is_active: e.target.value === '1' })}>
          <option value="1">Hoạt động</option><option value="0">Ẩn (ngừng bán)</option>
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel} disabled={saving}>Hủy</button>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </div>
  )
}

// ═══════════════════ ADD-ON ═══════════════════

const ADDON_CATEGORIES = [
  { value: 'PRINT', label: 'In ảnh / Album (PRINT)' },
  { value: 'MUA_PRODUCT', label: 'Sản phẩm MUA (nails, lens…)' },
  { value: 'GOODS', label: 'Hàng hoá khác (GOODS)' },
  { value: 'CANVAS', label: 'Canvas' },
  { value: 'FRAME', label: 'Khung ảnh' },
]
const COMMISSION_ROLES = [{ value: '', label: '— Không —' }, { value: 'SALE', label: 'Sale' }, { value: 'MUA', label: 'MUA' }]

function AddonsTab({ data, reload }: { data: CatalogManageResponse; reload: () => void }) {
  const toast = useToast()
  const canCost = data.can.cost
  const canAddAny = data.can.addons || data.can.addon_mua
  const [editing, setEditing] = useState<Partial<AddonCatalog> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const canEditRow = (a: Partial<AddonCatalog>) => data.can.addons || (data.can.addon_mua && a.category === 'MUA_PRODUCT')

  const save = async () => {
    if (!editing?.name) { setErr('Thiếu tên add-on'); return }
    if (!editing?.category) { setErr('Chọn loại add-on'); return }
    setErr(''); setSaving(true)
    try {
      await gasApi('addons.upsert', { data: editing })
      invalidateCache('services'); invalidateCache('all')
      toast(editing.addon_id ? 'Đã cập nhật add-on' : 'Đã thêm add-on')
      setEditing(null); reload()
    } catch (e) { setErr((e as GasError).message || 'Không thể lưu') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="muted">{data.addons.length} add-on</span>
        {canAddAny && <button className="btn press" onClick={() => setEditing({ name: '', category: data.can.addons ? 'PRINT' : 'MUA_PRODUCT', sell_price: 0, cost_price: 0, commission_type: 'NONE', commission_value: 0, commission_role: '', is_active: true })}>+ Thêm add-on</button>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr>
              <th>Add-on</th><th>Loại</th>{canCost && <th className="num">Giá nhập</th>}<th className="num">Giá bán</th>
              <th>Hoa hồng</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {data.addons.map((a) => {
                const editable = canEditRow(a)
                return (
                  <tr key={a.addon_id} onClick={() => editable && setEditing({ ...a })} style={{ cursor: editable ? 'pointer' : 'default' }}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td className="muted">{ADDON_CATEGORIES.find((c) => c.value === a.category)?.label || a.category}</td>
                    {canCost && <td className="num">{money(a.cost_price || 0)}</td>}
                    <td className="num">{money(a.sell_price)}</td>
                    <td className="muted">{a.commission_type === 'NONE' || !a.commission_role ? '—' :
                      `${a.commission_role}: ${a.commission_type === 'PERCENT' ? a.commission_value + '%' : money(a.commission_value)}`}</td>
                    <td>{a.is_active
                      ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Hoạt động</span>
                      : <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted-2)' }}>Ẩn</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.addon_id ? 'Sửa add-on' : 'Thêm add-on'} onClose={() => setEditing(null)}>
        {editing && <AddonForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} saving={saving} err={err} canCost={canCost} restrictMua={!data.can.addons} />}
      </Modal>
    </>
  )
}

function AddonForm({ value, onChange, onSave, onCancel, saving, err, canCost, restrictMua }: {
  value: Partial<AddonCatalog>; onChange: (v: Partial<AddonCatalog>) => void; onSave: () => void
  onCancel: () => void; saving: boolean; err: string; canCost: boolean; restrictMua: boolean
}) {
  const set = (patch: Partial<AddonCatalog>) => onChange({ ...value, ...patch })
  const cats = restrictMua ? ADDON_CATEGORIES.filter((c) => c.value === 'MUA_PRODUCT') : ADDON_CATEGORIES
  return (
    <div>
      {err && <div className="note-box danger" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="field"><label className="label">Tên add-on *</label><input className="input" value={value.name || ''} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="field"><label className="label">Loại *</label>
        <select className="input" value={value.category || ''} onChange={(e) => set({ category: e.target.value })} disabled={restrictMua}>
          {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid-2">
        {canCost && <div className="field"><label className="label">Giá nhập (đ)</label><input type="number" className="input" value={value.cost_price || 0} onChange={(e) => set({ cost_price: Number(e.target.value) })} /></div>}
        <div className="field"><label className="label">Giá bán (đ)</label><input type="number" className="input" value={value.sell_price || 0} onChange={(e) => set({ sell_price: Number(e.target.value) })} /></div>
      </div>
      <div className="card" style={{ background: 'var(--panel-2)' }}>
        <div className="label" style={{ marginBottom: 8 }}>Hoa hồng nhân sự</div>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 8 }}><label className="label">Kiểu</label>
            <select className="input" value={value.commission_type || 'NONE'} onChange={(e) => set({ commission_type: e.target.value })}>
              <option value="NONE">Không</option><option value="PERCENT">% theo giá bán</option><option value="FIXED">Khoán (đ/sp)</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 8 }}><label className="label">Giá trị</label><input type="number" className="input" value={value.commission_value || 0} onChange={(e) => set({ commission_value: Number(e.target.value) })} disabled={value.commission_type === 'NONE'} /></div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label className="label">Trả cho vai trò</label>
          <select className="input" value={value.commission_role || ''} onChange={(e) => set({ commission_role: e.target.value })} disabled={value.commission_type === 'NONE'}>
            {COMMISSION_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}><label className="label">Trạng thái</label>
        <select className="input" value={value.is_active ? '1' : '0'} onChange={(e) => set({ is_active: e.target.value === '1' })}>
          <option value="1">Hoạt động</option><option value="0">Ẩn</option>
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel} disabled={saving}>Hủy</button>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </div>
  )
}

// ═══════════════════ VOUCHER ═══════════════════

function VouchersTab({ data, reload }: { data: CatalogManageResponse; reload: () => void }) {
  const toast = useToast()
  const canEdit = data.can.vouchers
  const [editing, setEditing] = useState<Partial<Voucher> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!editing?.code) { setErr('Thiếu mã voucher'); return }
    if (!editing?.value || editing.value <= 0) { setErr('Giá trị phải > 0'); return }
    setErr(''); setSaving(true)
    try {
      await gasApi('vouchers.upsert', { data: editing })
      invalidateCache('services'); invalidateCache('all')
      toast(editing.voucher_id ? 'Đã cập nhật voucher' : 'Đã thêm voucher')
      setEditing(null); reload()
    } catch (e) { setErr((e as GasError).message || 'Không thể lưu') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="muted">{data.vouchers.length} voucher</span>
        {canEdit && <button className="btn press" onClick={() => setEditing({ code: '', type: 'PERCENT', value: 0, valid_from: '', valid_until: '', max_uses: null, used_count: 0 })}>+ Thêm voucher</button>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr><th>Mã</th><th>Loại</th><th className="num">Giá trị</th><th>Hiệu lực</th><th className="num">Đã dùng</th></tr></thead>
            <tbody>
              {data.vouchers.map((v) => (
                <tr key={v.voucher_id} onClick={() => canEdit && setEditing({ ...v })} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  <td style={{ fontWeight: 600 }}>{v.code}</td>
                  <td className="muted">{v.type === 'PERCENT' ? 'Giảm %' : 'Giảm tiền'}</td>
                  <td className="num">{v.type === 'PERCENT' ? v.value + '%' : money(v.value)}</td>
                  <td className="muted">{v.valid_from || v.valid_until ? `${fmtDay(v.valid_from)} → ${fmtDay(v.valid_until)}` : 'Không giới hạn'}</td>
                  <td className="num">{v.used_count}{v.max_uses != null ? ` / ${v.max_uses}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.voucher_id ? 'Sửa voucher' : 'Thêm voucher'} onClose={() => setEditing(null)} small>
        {editing && (
          <div>
            {err && <div className="note-box danger" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="grid-2">
              <div className="field"><label className="label">Mã *</label><input className="input" value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="VD: GIAM10" /></div>
              <div className="field"><label className="label">Loại</label>
                <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as Voucher['type'] })}>
                  <option value="PERCENT">Giảm %</option><option value="FIXED_AMOUNT">Giảm tiền (đ)</option>
                </select>
              </div>
            </div>
            <div className="field"><label className="label">Giá trị {editing.type === 'PERCENT' ? '(%)' : '(đ)'}</label><input type="number" className="input" value={editing.value || 0} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} /></div>
            <div className="grid-2">
              <div className="field"><label className="label">Hiệu lực từ</label><input type="date" className="input" value={editing.valid_from || ''} onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })} /></div>
              <div className="field"><label className="label">Đến hết</label><input type="date" className="input" value={editing.valid_until || ''} onChange={(e) => setEditing({ ...editing, valid_until: e.target.value })} /></div>
            </div>
            <div className="field"><label className="label">Giới hạn lượt dùng (để trống = không giới hạn)</label><input type="number" className="input" value={editing.max_uses ?? ''} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value === '' ? null : Number(e.target.value) })} /></div>
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
