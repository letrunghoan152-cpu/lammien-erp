'use client'
// app/(dashboard)/users/page.tsx — Module 10: Nhân sự + Vai trò/Phân quyền + Cơ sở (Manager)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'
import Avatar from '@/components/Avatar'
import { CardSkeleton } from '@/components/Skeletons'
import { invalidateCache } from '@/lib/cache'
import { money, dash } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/roles'
import { AdminUser, RoleItem, PermissionItem, RolesListResponse, UsersListResponse, Location } from '@/lib/types'

type Tab = 'staff' | 'roles' | 'locations'

export default function UsersPage() {
  const { hasPerm, isManager } = useAuth()
  const canManage = hasPerm('salary.manage_config') || isManager
  const [tab, setTab] = useState<Tab>('staff')

  if (!canManage) {
    return (
      <div>
        <h1 className="h1">Nhân sự & Phân quyền</h1>
        <div className="card note-box danger">Bạn không có quyền truy cập trang này.</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="h1">Nhân sự & Phân quyền</h1>
      <p className="sub">Quản lý tài khoản, vai trò, ma trận quyền và cơ sở.</p>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={'btn sm ' + (tab === 'staff' ? '' : 'ghost')} onClick={() => setTab('staff')}>👤 Nhân sự</button>
        <button className={'btn sm ' + (tab === 'roles' ? '' : 'ghost')} onClick={() => setTab('roles')}>🔐 Phân quyền</button>
        <button className={'btn sm ' + (tab === 'locations' ? '' : 'ghost')} onClick={() => setTab('locations')}>🏢 Cơ sở</button>
      </div>
      {tab === 'staff' && <StaffTab />}
      {tab === 'roles' && (isManager ? <RolesTab /> : <div className="card note-box danger">Chỉ Manager được quản lý phân quyền.</div>)}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}

// ═══════════════════ TAB NHÂN SỰ ═══════════════════

const EMPTY_USER: Partial<AdminUser> = {
  name: '', email: '', role_id: '', location_ids: [], default_location_id: null,
  is_active: true, base_salary: 0, concept_rate_type: '', concept_rate_value: 0, hau_ky_rate_per_file: 0,
}

function StaffTab() {
  const toast = useToast()
  const [data, setData] = useState<UsersListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<AdminUser> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    gasApi<UsersListResponse>('users.list').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing) return
    setErr(''); setSaving(true)
    try {
      await gasApi('users.upsert', { data: editing })
      invalidateCache('all')
      toast(editing.user_id ? 'Đã cập nhật nhân sự' : 'Đã thêm nhân sự')
      setEditing(null); load()
    } catch (e) {
      setErr((e as GasError).message || 'Không thể lưu')
    } finally { setSaving(false) }
  }

  if (loading && !data) return <CardSkeleton lines={6} />
  const roles = data?.roles || []
  const locations = data?.locations || []

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="muted">{data?.users.length || 0} nhân sự</span>
        <button className="btn press" onClick={() => setEditing({ ...EMPTY_USER })}>+ Thêm nhân sự</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Cơ sở</th><th className="num">Lương cứng</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {(data?.users || []).map((u) => (
                <tr key={u.user_id} onClick={() => setEditing({ ...u })}>
                  <td>
                    <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                      <Avatar name={u.name} size="md" />
                      <div><div style={{ fontWeight: 600 }}>{u.name}</div><div className="dim" style={{ fontSize: 12 }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td>{u.role_name || ROLE_LABELS[u.role_id] || u.role_id}</td>
                  <td className="muted">{u.location_names.join(', ') || '—'}</td>
                  <td className="num">{u.base_salary ? money(u.base_salary) : '—'}</td>
                  <td>{u.is_active
                    ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Hoạt động</span>
                    : <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted-2)' }}>Ngừng</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.user_id ? 'Sửa nhân sự' : 'Thêm nhân sự'} onClose={() => setEditing(null)}>
        {editing && (
          <UserForm value={editing} roles={roles} locations={locations} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} saving={saving} err={err} />
        )}
      </Modal>
    </>
  )
}

function UserForm({ value, roles, locations, onChange, onSave, onCancel, saving, err }: {
  value: Partial<AdminUser>; roles: RoleItem[]; locations: Location[]
  onChange: (v: Partial<AdminUser>) => void; onSave: () => void; onCancel: () => void; saving: boolean; err: string
}) {
  const set = (patch: Partial<AdminUser>) => onChange({ ...value, ...patch })
  const locs = value.location_ids || []
  const toggleLoc = (id: string) => {
    const next = locs.includes(id) ? locs.filter((x) => x !== id) : [...locs, id]
    const def = next.includes(value.default_location_id || '') ? value.default_location_id : (next[0] || null)
    set({ location_ids: next, default_location_id: def })
  }
  return (
    <div>
      {err && <div className="note-box danger" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="grid-2">
        <div className="field"><label className="label">Tên *</label><input className="input" value={value.name || ''} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="field"><label className="label">Email Google *</label><input className="input" value={value.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="nhanvien@gmail.com" /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="label">Vai trò *</label>
          <select className="input" value={value.role_id || ''} onChange={(e) => set({ role_id: e.target.value })}>
            <option value="">— Chọn vai trò —</option>
            {roles.map((r) => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
          </select>
        </div>
        <div className="field"><label className="label">Trạng thái</label>
          <select className="input" value={value.is_active ? '1' : '0'} onChange={(e) => set({ is_active: e.target.value === '1' })}>
            <option value="1">Hoạt động</option><option value="0">Ngừng hoạt động</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">Cơ sở được làm</label>
        <div className="row" style={{ gap: 8 }}>
          {locations.map((l) => (
            <label key={l.location_id} className={'tag' + (locs.includes(l.location_id) ? ' active' : '')} style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={locs.includes(l.location_id)} onChange={() => toggleLoc(l.location_id)} style={{ marginRight: 6 }} />{l.name}
            </label>
          ))}
          {!locations.length && <span className="dim">Chưa có cơ sở — thêm ở tab Cơ sở.</span>}
        </div>
      </div>
      {locs.length > 1 && (
        <div className="field"><label className="label">Cơ sở mặc định</label>
          <select className="input" value={value.default_location_id || ''} onChange={(e) => set({ default_location_id: e.target.value })}>
            {locs.map((id) => <option key={id} value={id}>{locations.find((l) => l.location_id === id)?.name || id}</option>)}
          </select>
        </div>
      )}
      <div className="card" style={{ background: 'var(--panel-2)', marginTop: 4 }}>
        <div className="label" style={{ marginBottom: 8 }}>Cấu hình lương (để trống = dùng mặc định danh mục)</div>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 8 }}><label className="label">Lương cứng / tháng</label><input type="number" className="input" value={value.base_salary || 0} onChange={(e) => set({ base_salary: Number(e.target.value) })} /></div>
          <div className="field" style={{ marginBottom: 8 }}><label className="label">Kiểu lương concept</label>
            <select className="input" value={value.concept_rate_type || ''} onChange={(e) => set({ concept_rate_type: e.target.value })}>
              <option value="">— Mặc định danh mục —</option><option value="FIXED">Cố định (VND)</option><option value="PERCENT">% theo giá concept</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}><label className="label">Giá trị lương concept</label><input type="number" className="input" value={value.concept_rate_value || 0} onChange={(e) => set({ concept_rate_value: Number(e.target.value) })} disabled={!value.concept_rate_type} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label className="label">Rate hậu kỳ / file (Hậu Kỳ)</label><input type="number" className="input" value={value.hau_ky_rate_per_file || 0} onChange={(e) => set({ hau_ky_rate_per_file: Number(e.target.value) })} /></div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel} disabled={saving}>Hủy</button>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </div>
  )
}

// ═══════════════════ TAB PHÂN QUYỀN ═══════════════════

function RolesTab() {
  const toast = useToast()
  const [data, setData] = useState<RolesListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [newRole, setNewRole] = useState('')
  const [savingRole, setSavingRole] = useState(false)

  const load = useCallback(() => {
    gasApi<RolesListResponse>('roles.list').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const g: Record<string, PermissionItem[]> = {}
    ;(data?.permissions || []).forEach((p) => { (g[p.group] = g[p.group] || []).push(p) })
    return g
  }, [data])

  const toggle = (roleId: string, key: string, cur: boolean) => {
    if (!data) return
    const granted = !cur
    setData({ ...data, matrix: { ...data.matrix, [roleId]: { ...data.matrix[roleId], [key]: granted } } })
    gasApi('permissions.update', { role_id: roleId, permission_key: key, granted }).catch((e) => {
      setData((d) => d ? { ...d, matrix: { ...d.matrix, [roleId]: { ...d.matrix[roleId], [key]: cur } } } : d)
      toast((e as GasError).message || 'Không thể đổi quyền', 'error')
    })
  }

  const addRole = async () => {
    if (!newRole.trim()) return
    setSavingRole(true)
    try { await gasApi('roles.upsert', { data: { role_name: newRole.trim() } }); setNewRole(''); toast('Đã tạo vai trò'); load() }
    catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
    finally { setSavingRole(false) }
  }

  if (loading && !data) return <CardSkeleton lines={8} />
  const roles = data?.roles || []

  return (
    <>
      <div className="banner amber" style={{ marginBottom: 12 }}>
        <span>ℹ️</span><span>Tích/bỏ tích để cấp quyền. Thay đổi có hiệu lực khi nhân sự đăng nhập lại (quyền cache theo phiên). Quyền <b>role.manage / role.create</b> chỉ Manager.</span>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Tên vai trò mới (vd: Kế toán)" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <button className="btn" onClick={addRole} disabled={savingRole || !newRole.trim()}>+ Tạo vai trò</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 220 + roles.length * 90 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--panel-2)' }}>Quyền</th>
                {roles.map((r) => <th key={r.role_id} style={{ textAlign: 'center' }}>{r.role_name}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, perms]) => (
                <GroupRows key={group} group={group} colSpan={roles.length + 1}>
                  {perms.map((p) => (
                    <tr key={p.key} style={{ cursor: 'default' }}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--panel)' }}>
                        {p.label}<div className="dim" style={{ fontSize: 11 }}>{p.key}</div>
                      </td>
                      {roles.map((r) => {
                        const cur = !!data?.matrix[r.role_id]?.[p.key]
                        const locked = (p.key === 'role.manage' || p.key === 'role.create') && r.role_id !== 'manager'
                        return (
                          <td key={r.role_id} style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={cur} disabled={locked} onChange={() => toggle(r.role_id, p.key, cur)} style={{ width: 18, height: 18, cursor: locked ? 'not-allowed' : 'pointer' }} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function GroupRows({ group, colSpan, children }: { group: string; colSpan: number; children: React.ReactNode }) {
  return (
    <>
      <tr><td colSpan={colSpan} style={{ background: 'var(--panel-2)', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)' }}>{group}</td></tr>
      {children}
    </>
  )
}

// ═══════════════════ TAB CƠ SỞ ═══════════════════

function LocationsTab() {
  const toast = useToast()
  const [locs, setLocs] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Location> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    gasApi<{ locations: Location[] }>('locations.list', { include_inactive: true }).then((d) => setLocs(d.locations)).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.name) return
    setSaving(true)
    try { await gasApi('locations.upsert', { data: editing }); invalidateCache('all'); toast('Đã lưu cơ sở'); setEditing(null); load() }
    catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <CardSkeleton lines={4} />
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="muted">{locs.length} cơ sở</span>
        <button className="btn press" onClick={() => setEditing({ name: '', address: '', phone: '', is_active: true })}>+ Thêm cơ sở</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 480 }}>
            <thead><tr><th>Tên</th><th>Địa chỉ</th><th>SĐT</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {locs.map((l) => (
                <tr key={l.location_id} onClick={() => setEditing({ ...l })}>
                  <td style={{ fontWeight: 600 }}>{l.name}</td>
                  <td className="muted">{dash(l.address)}</td>
                  <td className="muted">{dash(l.phone)}</td>
                  <td>{l.is_active ? <span className="pill" style={{ background: 'rgba(94,125,62,.15)', color: 'var(--green)' }}>Đang mở</span> : <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted-2)' }}>Đóng</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} title={editing?.location_id ? 'Sửa cơ sở' : 'Thêm cơ sở'} onClose={() => setEditing(null)} small>
        {editing && (
          <div>
            <div className="field"><label className="label">Tên cơ sở *</label><input className="input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label className="label">Địa chỉ</label><input className="input" value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div className="field"><label className="label">SĐT</label><input className="input" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div className="field"><label className="label">Trạng thái</label>
              <select className="input" value={editing.is_active ? '1' : '0'} onChange={(e) => setEditing({ ...editing, is_active: e.target.value === '1' })}>
                <option value="1">Đang mở</option><option value="0">Tạm đóng</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditing(null)} disabled={saving}>Hủy</button>
              <button className="btn" onClick={save} disabled={saving || !editing.name}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
