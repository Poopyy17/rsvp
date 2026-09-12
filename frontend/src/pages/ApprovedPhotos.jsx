import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Download, ImagePlus, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { getApprovedPhotos, uploadPhotos } from '@/api'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import SealBurst from '@/components/SealBurst'
import Media from '@/components/Media'
import Masonry from '@/components/Masonry'
import MediaPreviewDialog from '@/components/MediaPreviewDialog'
import PageLoader from '@/components/PageLoader'
import { useLoading } from '@/lib/loading-context'
import '../App.css'
import './Gallery.css'

const MAX_PHOTOS = 5
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 15 * 1024 * 1024

function validateFile(file) {
  const isImage = file.type.startsWith('image/') && file.type !== 'image/gif'
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    return { code: 'file-invalid-type', message: 'Only images (no GIFs) or videos are allowed.' }
  }
  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return { code: 'file-too-large', message: 'Images must be 10MB or smaller.' }
  }
  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return { code: 'file-too-large', message: 'Videos must be 15MB or smaller.' }
  }
  return null
}

export default function ApprovedPhotos() {
  const [approvedPhotos, setApprovedPhotos] = useState([])
  const [loadStatus, setLoadStatus] = useState('loading')
  const [masonryReady, setMasonryReady] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const [photos, setPhotos] = useState([])
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [open, setOpen] = useState(false)
  const { pendingId, run } = useLoading()
  const isSubmitting = pendingId === 'upload-submit'

  useEffect(() => {
    document.title = 'Approved Photos'
  }, [])

  useEffect(() => {
    let cancelled = false

    getApprovedPhotos()
      .then((images) => {
        if (!cancelled) {
          setApprovedPhotos(images)
          setLoadStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    setUploadStatus('idle')
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length
      if (room <= 0) return prev
      const additions = acceptedFiles.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }))
      return [...prev, ...additions]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    validator: validateFile,
    disabled: photos.length >= MAX_PHOTOS || isSubmitting,
  })

  function removePhoto(id) {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((photo) => photo.id !== id)
    })
  }

  function resetUpload() {
    setPhotos((prev) => {
      prev.forEach((photo) => URL.revokeObjectURL(photo.preview))
      return []
    })
    setUploadStatus('idle')
  }

  function handleOpenChange(next) {
    // Reset on the way IN, not on the way out — resetting while closing
    // would swap the confirmation screen for the empty form mid-close-
    // animation, flashing the form for an instant before the dialog fully
    // disappears. Resetting on open instead means the fresh form is
    // already in place before anything is visible.
    if (next && uploadStatus === 'success') {
      resetUpload()
    }
    setOpen(next)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (photos.length === 0) return

    await run('upload-submit', async () => {
      try {
        await uploadPhotos(photos.map(({ file }) => file))
        setUploadStatus('success')
      } catch {
        setUploadStatus('error')
      }
    })
  }

  async function handleDownload(photo) {
    try {
      const response = await fetch(photo.url)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = photo.originalName || `photo-${photo.id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error('Failed to download photo.')
    }
  }

  const isFull = photos.length >= MAX_PHOTOS

  return (
    <main className="gallery-page">
      <header className="gallery-topbar">
        <p className="gallery-topbar-label">Photo Gallery</p>
        <p className="gallery-topbar-title">Approved photos</p>
      </header>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <section className="gallery-main">
          {(loadStatus === 'loading' || (loadStatus === 'ready' && approvedPhotos.length > 0 && !masonryReady)) && (
            <PageLoader label="Loading photos…" />
          )}

          {loadStatus === 'error' && (
            <p className="gallery-status gallery-status--error">
              Couldn&rsquo;t load photos. Please try again later.
            </p>
          )}

          {loadStatus === 'ready' && approvedPhotos.length === 0 && (
            <div className="gallery-empty">
              <ImagePlus className="gallery-empty-icon" strokeWidth={1} aria-hidden="true" />
              <p className="gallery-empty-title">No approved photos yet</p>
              <p className="gallery-empty-hint">Be the first to share one.</p>
              <DialogTrigger className="fab fab--inline">
                <Plus className="fab-icon" aria-hidden="true" />
                <span className="fab-label">Upload Photos</span>
              </DialogTrigger>
            </div>
          )}

          {loadStatus === 'ready' && approvedPhotos.length > 0 && (
            <>
              <Masonry
                items={approvedPhotos}
                maxColumns={5}
                onReady={() => setMasonryReady(true)}
                onItemClick={(item) => setActiveId(item.id)}
              />

              <DialogTrigger className="fab">
                <Plus className="fab-icon" aria-hidden="true" />
                <span className="fab-label">Upload Photos</span>
              </DialogTrigger>
            </>
          )}
        </section>

        <DialogContent className="upload-dialog max-h-[85svh] overflow-y-auto">
          {uploadStatus === 'success' ? (
            <div className="card--confirmation">
              <SealBurst />
              <p className="confirmation-title">Thank you!</p>
              <p className="confirmation-body">
                Your photos have been submitted and are awaiting approval. Once approved, they&rsquo;ll
                appear here in the gallery.
              </p>
              <Button type="button" className="submit-button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Upload Photos</DialogTitle>
                <DialogDescription>
                  Drag and drop up to {MAX_PHOTOS} photos or videos to share with the family.
                  <br />
                  Accepted: images (JPG, PNG, HEIC, WEBP, etc. — no GIFs) up to 10MB, or videos (MP4,
                  MOV, etc.) up to 15MB.
                </DialogDescription>
              </DialogHeader>

              <form className="upload-form" onSubmit={handleSubmit}>
                <div
                  {...getRootProps({
                    className: `dropzone${isDragActive ? ' dropzone--active' : ''}${isFull ? ' dropzone--full' : ''}`,
                  })}
                >
                  <input {...getInputProps()} />
                  <p>
                    {isFull
                      ? 'Maximum of 5 files selected'
                      : isDragActive
                        ? 'Drop the files here'
                        : 'Drag & drop photos or videos here, or click to browse'}
                  </p>
                  <p className="dropzone-hint">
                    {photos.length}/{MAX_PHOTOS} selected
                  </p>
                </div>

                {fileRejections.length > 0 && (
                  <p className="upload-message upload-message--error">
                    {fileRejections[0].errors[0]?.message ?? 'That file can’t be uploaded.'}
                  </p>
                )}

                {photos.length > 0 && (
                  <ul className="photo-grid photo-grid--compact">
                    {photos.map((photo) => (
                      <li key={photo.id} className="photo-thumb">
                        <Media src={photo.preview} contentType={photo.file.type} muted playsInline />
                        <button
                          type="button"
                          className="photo-remove"
                          aria-label={`Remove ${photo.file.name}`}
                          disabled={pendingId !== null}
                          onClick={() => removePhoto(photo.id)}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {uploadStatus === 'error' && (
                  <p className="upload-message upload-message--error">
                    Something went wrong. Please try again.
                  </p>
                )}

                <Button type="submit" className="submit-button" disabled={photos.length === 0 || pendingId !== null}>
                  {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isSubmitting ? 'Uploading…' : 'Upload photos'}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MediaPreviewDialog
        items={approvedPhotos}
        activeId={activeId}
        onActiveIdChange={setActiveId}
        renderFloatingActions={(photo) => (
          <LoadingButton
            id={`download-${photo.id}`}
            type="button"
            variant="ghost"
            className="hover:bg-transparent hover:text-[inherit] hover:opacity-75 active:bg-transparent"
            onClick={() => handleDownload(photo)}
          >
            <Download aria-hidden="true" />
            Download
          </LoadingButton>
        )}
      />
    </main>
  )
}
