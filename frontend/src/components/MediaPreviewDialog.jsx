import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import Media from '@/components/Media'
import './MediaPreviewDialog.css'

// A photo/video preview modal with Previous/Next navigation across `items`,
// shared by the admin table and the public approved gallery. `renderActions`
// is optional — the admin page uses it to inject Approve/Reject/Delete
// buttons rendered inline below the media. `renderFloatingActions` is
// optional too — the approved gallery uses it for a Download button shown
// as a floating bar. It's rendered as a sibling of DialogContent (not
// nested inside it) because DialogContent has a CSS transform, which would
// otherwise make it the containing block for a `position: fixed` child and
// break the "pinned to the viewport" effect.
export default function MediaPreviewDialog({
  items,
  activeId,
  onActiveIdChange,
  renderActions,
  renderFloatingActions,
}) {
  const activeIndex = items.findIndex((item) => item.id === activeId)
  const activeItem = activeIndex === -1 ? null : items[activeIndex]
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex !== -1 && activeIndex < items.length - 1

  function goTo(offset) {
    const nextItem = items[activeIndex + offset]
    if (nextItem) onActiveIdChange(nextItem.id)
  }

  useEffect(() => {
    if (!activeItem) return
    function handleKeyDown(event) {
      if (event.key === 'ArrowLeft') goTo(-1)
      if (event.key === 'ArrowRight') goTo(1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem, activeIndex])

  return (
    <Dialog open={Boolean(activeItem)} onOpenChange={(next) => !next && onActiveIdChange(null)}>
      <DialogContent className="media-preview-dialog max-h-[90svh] overflow-y-auto">
        {activeItem && (
          <>
            <div className="preview-media-wrap">
              <button
                type="button"
                className="preview-nav preview-nav--prev"
                onClick={() => goTo(-1)}
                disabled={!hasPrev}
                aria-label="Previous"
              >
                <ChevronLeft aria-hidden="true" />
              </button>

              <Media
                key={activeItem.id}
                src={activeItem.url}
                contentType={activeItem.contentType}
                className="media-preview-image"
                controls
                playsInline
              />

              <button
                type="button"
                className="preview-nav preview-nav--next"
                onClick={() => goTo(1)}
                disabled={!hasNext}
                aria-label="Next"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            {renderActions?.(activeItem)}
          </>
        )}
      </DialogContent>

      {activeItem && renderFloatingActions && (
        <div className="preview-floating-actions">{renderFloatingActions(activeItem)}</div>
      )}
    </Dialog>
  )
}
