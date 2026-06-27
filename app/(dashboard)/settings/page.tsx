'use client'
// app/(dashboard)/settings/page.tsx — Cài đặt hệ thống (Manager) — PRD Section 19

import { useEffect, useState } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { CardSkeleton } from '@/components/Skeletons'
import { invalidateCache } from '@/lib/cache'

interface FieldDef { key: string; label: string; hint?: string; type?: 'text' | 'number' | 'bool' }

const FIELDS: FieldDef[] = [
  { key: 'slot_times', label: 'Khung giờ cố định', hint: 'Danh sách giờ KH có mặt, phân cách dấu phẩy (vd: 08:00,10:00,12:00)' },
  { key: 'deadline_raw_days', label: 'Hạn gửi link raw (ngày)', hint: 'Số ngày sau ĐÃ CHỤP trước khi cảnh báo Photographer chậm gửi raw', type: 'number' },
  { key: 'deadline_hk_days', label: 'Hạn hậu kỳ (ngày)', hint: '0 = cảnh báo ngay khi quá deadline task hậu kỳ', type: 'number' },
  { key: 'deadline_ship_days', label: 'Hạn giao hàng (ngày)', hint: 'Số ngày sau CHỜ IN trước khi cảnh báo chậm giao', type: 'number' },
  { key: 'logo_url', label: 'Logo webapp (URL)', hint: 'Google Drive share link hoặc URL ảnh trực tiếp' },
  { key: 'email_alerts_enabled', label: 'Bật email cảnh báo', hint: 'Gửi email khi trễ deadline raw/hậu kỳ', type: 'bool' },
  { key: 'email_alert_recipient', label: 'Email nhận cảnh báo', hint: 'Email Manager nhận thông báo deadline' },
  { key: 'notification_expiry_days', label: 'Số ngày giữ thông báo', hint: 'Thông báo chưa đọc tự ẩn sau số ngày này', type: 'number' },
]

export default function SettingsPage() {
  const { isManager } = useAuth()
  const toast = useToast()
  const [vals, setVals] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [secretSaving, setSecretSaving] = useState(false)

  useEffect(() => {
    gasApi<Record<string, string>>('settings.get')
      .then((s) => setVals(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v ?? '')]))))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (!isManager) {
    return (
      <div>
        <h1 className="h1">Cài đặt hệ thống</h1>
        <div className="card note-box danger">Chỉ Manager được truy cập cài đặt hệ thống.</div>
      </div>
    )
  }

  const saveKey = async (key: string, value: string) => {
    setSavingKey(key)
    try {
      await gasApi('settings.update', { key, value })
      invalidateCache('all')
      toast('Đã lưu cài đặt')
    } catch (e) { toast((e as GasError).message || 'Không thể lưu', 'error') }
    finally { setSavingKey(null) }
  }

  const saveSecret = async () => {
    if (!secret.trim()) return
    setSecretSaving(true)
    try {
      await gasApi('settings.update', { key: 'webhook_secret', value: secret.trim() })
      toast('Đã cập nhật webhook secret'); setSecret('')
    } catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
    finally { setSecretSaving(false) }
  }

  if (loading) return (<div><h1 className="h1">Cài đặt hệ thống</h1><CardSkeleton lines={8} /></div>)

  return (
    <div>
      <h1 className="h1">Cài đặt hệ thống</h1>
      <p className="sub">Khung giờ, ngưỡng cảnh báo deadline, logo, email & webhook.</p>

      <div className="card">
        {FIELDS.map((f) => (
          <div className="field" key={f.key} style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 14 }}>
            <label className="label">{f.label}</label>
            {f.hint && <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>{f.hint}</div>}
            <div className="row" style={{ gap: 8 }}>
              {f.type === 'bool' ? (
                <select className="input" style={{ flex: 1 }} value={vals[f.key] === 'true' ? 'true' : 'false'} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
                  <option value="true">Bật</option><option value="false">Tắt</option>
                </select>
              ) : (
                <input className="input" style={{ flex: 1 }} type={f.type === 'number' ? 'number' : 'text'} value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              )}
              <button className="btn ghost" onClick={() => saveKey(f.key, vals[f.key] ?? '')} disabled={savingKey === f.key}>
                {savingKey === f.key ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🔑 Webhook secret</h3>
        <div className="dim" style={{ fontSize: 12.5, marginBottom: 8 }}>
          Khóa bí mật cho webhook từ webapp chọn ảnh (POST /webhook/photo-selected, photo-approved). Giá trị hiện tại không hiển thị vì lý do bảo mật — nhập giá trị mới để cập nhật.
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} type="password" placeholder="Nhập secret mới…" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <button className="btn" onClick={saveSecret} disabled={secretSaving || !secret.trim()}>{secretSaving ? 'Đang lưu…' : 'Cập nhật'}</button>
        </div>
      </div>
    </div>
  )
}
