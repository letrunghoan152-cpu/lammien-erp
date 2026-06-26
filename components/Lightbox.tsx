'use client'
// components/Lightbox.tsx — xem ảnh fullscreen (PRD Section 15.17)

import { useEffect, useState } from 'react'

interface Props {
  urls: string[]
  startIndex: number
  onClose: () => void
}

export function Lightbox({ urls, startIndex, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % urls.length)
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [urls.length, onClose])

  if (!urls.length) return null

  return (
    <div className="lightbox anim-fade-in" onClick={onClose}>
      <button className="lb-btn lb-close" onClick={onClose}>✕</button>
      {urls.length > 1 && (
        <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + urls.length) % urls.length) }}>‹</button>
      )}
      <img src={urls[idx]} alt="" onClick={(e) => e.stopPropagation()} />
      {urls.length > 1 && (
        <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % urls.length) }}>›</button>
      )}
    </div>
  )
}

/** Gallery thumbnail mở lightbox khi click */
export function PhotoGallery({ urls, thumbClass = 'thumb' }: { urls: string[]; thumbClass?: string }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(0)
  if (!urls?.length) return null
  return (
    <>
      <div className="thumbs">
        {urls.map((u, i) => (
          <img
            key={i} src={u} alt="" className={thumbClass}
            onClick={() => { setStart(i); setOpen(true) }}
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
          />
        ))}
      </div>
      {open && <Lightbox urls={urls} startIndex={start} onClose={() => setOpen(false)} />}
    </>
  )
}
