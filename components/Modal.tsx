'use client'
// components/Modal.tsx — modal thay confirm() native (PRD Section 15.8)

import { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  children?: ReactNode
  onClose: () => void
  small?: boolean
}

export function Modal({ open, title, children, onClose, small }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={'modal anim-scale-in' + (small ? ' sm' : '')} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, body, confirmLabel = 'Xác nhận', danger, busy, onConfirm, onCancel,
}: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} small>
      {typeof body === 'string' ? <p className="muted" style={{ marginTop: 0 }}>{body}</p> : body}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Hủy bỏ</button>
        <button
          className={'btn' + (danger ? ' danger' : '')}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Đang xử lý…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
