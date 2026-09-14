import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { flexRender } from '@tanstack/react-table'
import { getCoreRowModel, legacyCreateColumnHelper, useLegacyTable } from '@tanstack/react-table/legacy'
import { approvePhoto, deletePhoto, getAllPhotos, rejectPhoto } from '@/api'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useLoading } from '@/lib/loading-context'
import { ADMIN_ACCESS_CODE } from '@/lib/access-code'
import Media from '@/components/Media'
import MediaPreviewDialog from '@/components/MediaPreviewDialog'
import PageLoader from '@/components/PageLoader'
import PasswordGate from '@/components/PasswordGate'
import '../App.css'
import './Gallery.css'
import './Admin.css'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// Shared by the table row, the card view, and the preview dialog — each
// puts the same Approve/Reject/Delete trio in a differently-sized spot.
function PhotoActions({ photo, idPrefix, size, onApprove, onReject, onDelete, deleteDisabled }) {
  return (
    <div className="admin-actions">
      <LoadingButton
        id={`${idPrefix}-approve-${photo.id}`}
        type="button"
        size={size}
        onClick={() => onApprove(photo.id)}
        disabled={photo.status === 'approved'}
      >
        Approve
      </LoadingButton>
      <LoadingButton
        id={`${idPrefix}-reject-${photo.id}`}
        type="button"
        size={size}
        variant="outline"
        onClick={() => onReject(photo.id)}
        disabled={photo.status === 'rejected'}
      >
        Reject
      </LoadingButton>
      <Button
        type="button"
        size={size}
        variant="destructive"
        disabled={deleteDisabled}
        onClick={() => onDelete([photo.id])}
      >
        Delete
      </Button>
    </div>
  )
}

const columnHelper = legacyCreateColumnHelper()

export default function AdminPhotos() {
  const [unlocked, setUnlocked] = useState(false)
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [activeId, setActiveId] = useState(null)
  const [deleteTargetIds, setDeleteTargetIds] = useState(null)
  const [rowSelection, setRowSelection] = useState({})
  const { pendingId, run } = useLoading()

  useEffect(() => {
    document.title = 'Photo Gallery — Admin'
  }, [])

  useEffect(() => {
    // Don't fetch (or render) any photos until the access code is entered.
    if (!unlocked) return

    let cancelled = false

    getAllPhotos()
      .then((images) => {
        if (!cancelled) {
          setPhotos(images)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [unlocked])

  const handleApprove = useCallback(async (id) => {
    try {
      const updated = await approvePhoto(id)
      setPhotos((prev) => prev.map((photo) => (photo.id === id ? updated : photo)))
      toast.success('Photo approved.')
    } catch {
      toast.error('Failed to approve photo.')
    }
  }, [])

  const handleReject = useCallback(async (id) => {
    try {
      const updated = await rejectPhoto(id)
      setPhotos((prev) => prev.map((photo) => (photo.id === id ? updated : photo)))
      toast.success('Photo rejected.')
    } catch {
      toast.error('Failed to reject photo.')
    }
  }, [])

  async function handleBatchApprove() {
    const ids = Object.keys(rowSelection)
    try {
      const updates = await Promise.all(ids.map((id) => approvePhoto(id)))
      const updatesById = new Map(updates.map((photo) => [photo.id, photo]))
      setPhotos((prev) => prev.map((photo) => updatesById.get(photo.id) ?? photo))
      setRowSelection({})
      toast.success(`${ids.length} photo${ids.length === 1 ? '' : 's'} approved.`)
    } catch {
      toast.error('Failed to approve photos.')
    }
  }

  async function handleBatchReject() {
    const ids = Object.keys(rowSelection)
    try {
      const updates = await Promise.all(ids.map((id) => rejectPhoto(id)))
      const updatesById = new Map(updates.map((photo) => [photo.id, photo]))
      setPhotos((prev) => prev.map((photo) => updatesById.get(photo.id) ?? photo))
      setRowSelection({})
      toast.success(`${ids.length} photo${ids.length === 1 ? '' : 's'} rejected.`)
    } catch {
      toast.error('Failed to reject photos.')
    }
  }

  async function confirmDelete() {
    const ids = deleteTargetIds
    setDeleteTargetIds(null)

    // Settle each delete independently — with a batch, one failure (e.g. a
    // transient S3 error) must not hide the others that actually succeeded.
    const results = await Promise.allSettled(ids.map((id) => deletePhoto(id)))
    const deletedIds = ids.filter((_, i) => results[i].status === 'fulfilled')
    const failedCount = results.length - deletedIds.length

    if (deletedIds.length > 0) {
      setPhotos((prev) => prev.filter((photo) => !deletedIds.includes(photo.id)))
      setActiveId((current) => (deletedIds.includes(current) ? null : current))
      setRowSelection((prev) => {
        const next = { ...prev }
        deletedIds.forEach((id) => delete next[id])
        return next
      })
    }

    if (failedCount === 0) {
      toast.success(`${deletedIds.length} photo${deletedIds.length === 1 ? '' : 's'} deleted.`)
    } else if (deletedIds.length === 0) {
      toast.error('Failed to delete photo(s).')
    } else {
      toast.error(`${deletedIds.length} deleted, ${failedCount} failed. Try again for the rest.`)
    }
  }

  const selectedCount = Object.keys(rowSelection).length

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="admin-checkbox"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all photos"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="admin-checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select photo"
          />
        ),
      }),
      columnHelper.display({
        id: 'photo',
        header: 'Photo',
        cell: ({ row }) => (
          <button type="button" className="admin-thumb-button" onClick={() => setActiveId(row.original.id)}>
            <Media
              src={row.original.url}
              contentType={row.original.contentType}
              className="admin-thumb"
              muted
              playsInline
            />
          </button>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <span className={`status-badge status-badge--${info.getValue()}`}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Uploaded',
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <PhotoActions
            photo={row.original}
            idPrefix="row"
            size="sm"
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={setDeleteTargetIds}
            deleteDisabled={pendingId !== null}
          />
        ),
      }),
    ],
    [handleApprove, handleReject, pendingId]
  )

  const table = useLegacyTable({
    data: photos,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  })

  if (!unlocked) {
    return (
      <PasswordGate
        code={ADMIN_ACCESS_CODE}
        title="Admin Access"
        description="Enter the access code to view the photo queue."
        onUnlock={() => setUnlocked(true)}
      />
    )
  }

  return (
    <main className="gallery-page">
      <header className="gallery-topbar">
        <p className="gallery-topbar-label">Photo Gallery</p>
        <p className="gallery-topbar-title">Admin</p>
      </header>

      <section className="gallery-main">
        {status === 'loading' && <PageLoader label="Loading photos…" />}

        {status === 'error' && (
          <p className="gallery-status gallery-status--error">
            Couldn&rsquo;t load photos. Please try again later.
          </p>
        )}

        {status === 'ready' && photos.length === 0 && (
          <div className="gallery-empty">
            <p className="gallery-empty-title">No photos yet</p>
            <p className="gallery-empty-hint">Submitted photos will show up here for review.</p>
          </div>
        )}

        {status === 'ready' && photos.length > 0 && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className={row.getIsSelected() ? 'admin-row--selected' : undefined}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="photo-cards">
              {photos.map((photo) => (
                <div key={photo.id} className="photo-card">
                  <div className="photo-card-media">
                    <input
                      type="checkbox"
                      className="admin-checkbox photo-card-checkbox"
                      checked={Boolean(rowSelection[photo.id])}
                      onChange={() =>
                        setRowSelection((prev) => {
                          const next = { ...prev }
                          if (next[photo.id]) delete next[photo.id]
                          else next[photo.id] = true
                          return next
                        })
                      }
                      aria-label="Select photo"
                    />
                    <button type="button" className="admin-thumb-button" onClick={() => setActiveId(photo.id)}>
                      <Media src={photo.url} contentType={photo.contentType} className="admin-thumb" muted playsInline />
                    </button>
                  </div>
                  <div className="photo-card-body">
                    <div className="photo-card-meta">
                      <span className={`status-badge status-badge--${photo.status}`}>{photo.status}</span>
                      <p className="photo-card-date">{formatDate(photo.createdAt)}</p>
                    </div>
                    <PhotoActions
                      photo={photo}
                      idPrefix="card"
                      size="sm"
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDelete={setDeleteTargetIds}
                      deleteDisabled={pendingId !== null}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <MediaPreviewDialog
        items={photos}
        activeId={activeId}
        onActiveIdChange={setActiveId}
        renderActions={(photo) => (
          <PhotoActions
            photo={photo}
            idPrefix="preview"
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={setDeleteTargetIds}
            deleteDisabled={pendingId !== null}
          />
        )}
      />

      {selectedCount > 0 && (
        <div className="batch-bar">
          <span className="batch-bar-count">{selectedCount} selected</span>
          <div className="admin-actions">
            <LoadingButton id="batch-approve" type="button" size="sm" onClick={handleBatchApprove}>
              Approve
            </LoadingButton>
            <LoadingButton
              id="batch-reject"
              type="button"
              size="sm"
              variant="outline"
              onClick={handleBatchReject}
            >
              Reject
            </LoadingButton>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pendingId !== null}
              onClick={() => setDeleteTargetIds(Object.keys(rowSelection))}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTargetIds?.length)}
        onOpenChange={(next) => !next && setDeleteTargetIds(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTargetIds?.length === 1 ? 'this photo' : `${deleteTargetIds?.length} photos`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTargetIds?.length === 1 ? 'it' : 'them'} from storage. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingId !== null}
              onClick={() => run('confirm-delete', confirmDelete)}
            >
              {pendingId === 'confirm-delete' && <Loader2 className="animate-spin" aria-hidden="true" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
