import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Media from '@/components/Media'
import './Masonry.css'

const BREAKPOINTS = ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)']
// Columns per breakpoint, widest screen first — capped by `maxColumns` below
// so however wide the screen gets, it never shows more than that per row.
const COLUMN_COUNTS = [5, 4, 3, 2]

function useColumns(maxColumns) {
  const getColumns = () => {
    if (typeof window === 'undefined') return 1
    const index = BREAKPOINTS.findIndex((query) => window.matchMedia(query).matches)
    const base = index === -1 ? 1 : COLUMN_COUNTS[index]
    return Math.min(base, maxColumns)
  }

  const [columns, setColumns] = useState(getColumns)

  useEffect(() => {
    const handler = () => setColumns(getColumns())
    const lists = BREAKPOINTS.map((query) => window.matchMedia(query))
    lists.forEach((mql) => mql.addEventListener('change', handler))
    return () => lists.forEach((mql) => mql.removeEventListener('change', handler))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxColumns])

  return columns
}

function useMeasureWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

// Unlike the reactbits reference (which expects a caller-supplied static
// height per item), our photos and videos have genuinely unpredictable
// dimensions — nothing is stored up front — so each item's real aspect
// ratio is measured before laying anything out.
function measureAspectRatio(item) {
  return new Promise((resolve) => {
    if (item.contentType?.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve(video.videoWidth / video.videoHeight || 1)
      video.onerror = () => resolve(1)
      video.src = item.url
    } else {
      const img = new Image()
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1)
      img.onerror = () => resolve(1)
      img.src = item.url
    }
  })
}

export default function Masonry({ items, gap = 16, maxColumns = 5, onReady, onItemClick }) {
  const columns = useColumns(maxColumns)
  const [containerRef, width] = useMeasureWidth()
  const [ratios, setRatios] = useState({})
  const [ready, setReady] = useState(false)
  const hasMounted = useRef(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)

    Promise.all(items.map(async (item) => [item.id, await measureAspectRatio(item)])).then((entries) => {
      if (cancelled) return
      setRatios(Object.fromEntries(entries))
      setReady(true)
      onReady?.()
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const { layout, height } = useMemo(() => {
    if (!width || !ready) return { layout: [], height: 0 }

    const columnWidth = (width - gap * (columns - 1)) / columns
    const colHeights = new Array(columns).fill(0)

    const layout = items.map((item) => {
      const col = colHeights.indexOf(Math.min(...colHeights))
      const x = col * (columnWidth + gap)
      const y = colHeights[col]
      const h = columnWidth / (ratios[item.id] || 1)
      colHeights[col] = y + h + gap

      return { ...item, x, y, w: columnWidth, h }
    })

    return { layout, height: Math.max(0, ...colHeights) - gap }
  }, [columns, items, ratios, ready, width, gap])

  useLayoutEffect(() => {
    layout.forEach((item, index) => {
      const selector = `[data-key="${item.id}"]`
      const target = { x: item.x, y: item.y, width: item.w, height: item.h }

      if (!hasMounted.current) {
        gsap.fromTo(
          selector,
          { opacity: 0, x: item.x, y: item.y + 40, width: item.w, height: item.h, filter: 'blur(10px)' },
          {
            opacity: 1,
            ...target,
            filter: 'blur(0px)',
            duration: 0.7,
            ease: 'power3.out',
            delay: index * 0.05,
          }
        )
      } else {
        gsap.to(selector, { ...target, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
      }
    })

    if (layout.length > 0) hasMounted.current = true
  }, [layout])

  return (
    <div ref={containerRef} className="masonry-list" style={{ height }}>
      {layout.map((item) => (
        <div key={item.id} data-key={item.id} className="masonry-item">
          {onItemClick ? (
            <button type="button" className="masonry-item-button" onClick={() => onItemClick(item)}>
              <div className="photo-thumb">
                <Media src={item.url} contentType={item.contentType} muted playsInline />
              </div>
            </button>
          ) : (
            <div className="photo-thumb">
              <Media src={item.url} contentType={item.contentType} controls playsInline />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
