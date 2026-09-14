import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  CircleX,
  Download,
  ListFilter,
  RefreshCw,
} from 'lucide-react'
import { flexRender } from '@tanstack/react-table'
import { getCoreRowModel, getPaginationRowModel, legacyCreateColumnHelper, useLegacyTable } from '@tanstack/react-table/legacy'
import { getRsvps } from '@/api'
import { Button } from '@/components/ui/button'
import { ADMIN_ACCESS_CODE } from '@/lib/access-code'
import { useLoading } from '@/lib/loading-context'
import PageLoader from '@/components/PageLoader'
import PasswordGate from '@/components/PasswordGate'
import '../App.css'
import './Gallery.css'
import './Admin.css'
import './Guests.css'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// Names are stored as typed (so a resubmission's exact spelling wins), which
// means casing can end up inconsistent — e.g. someone resubmitting on mobile
// autocapitalize-off. Title-case it for display and export only.
function toTitleCase(value) {
  if (!value) return value
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

// Purok & Grupo is written "purok-grupo" (e.g. "4-6") — the filter only
// looks at the purok, the first number.
const PUROK_OPTIONS = [1, 2, 3, 4, 5, 6]

function firstPurokNumber(purokGrupo) {
  return Number.parseInt(purokGrupo?.split('-')[0], 10)
}

const ATTENDING_OPTIONS = [
  { value: 'yes', label: 'Attending' },
  { value: 'no', label: 'Declined' },
]

const REFRESH_ID = 'refresh-guests'

const columnHelper = legacyCreateColumnHelper()

const columns = [
  columnHelper.accessor('name', {
    header: () => <div className="col-center">Name</div>,
    cell: (info) => (
      <div className="col-center">{toTitleCase(info.getValue()) || <span className="cell-muted">Unnamed guest</span>}</div>
    ),
  }),
  columnHelper.accessor('purokGrupo', {
    header: () => <div className="col-center">Purok & Grupo</div>,
    cell: (info) => (
      <div className="col-center">
        {info.getValue() ? (
          <span className="badge-outline">{info.getValue()}</span>
        ) : (
          <span className="cell-muted">—</span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor('attending', {
    header: () => <div className="col-center">Attending</div>,
    cell: (info) => {
      const attending = info.getValue()
      return (
        <div className="col-center">
          <span className={`status-badge status-badge--${attending}`}>
            {attending === 'yes' ? <CircleCheck /> : <CircleX />}
            {attending === 'yes' ? 'Attending' : 'Declined'}
          </span>
        </div>
      )
    },
  }),
  columnHelper.accessor('createdAt', {
    header: () => <div className="col-center">Submitted</div>,
    cell: (info) => <div className="col-center">{formatDate(info.getValue())}</div>,
  }),
]

export default function Guests() {
  const [unlocked, setUnlocked] = useState(false)
  const [guests, setGuests] = useState([])
  const [status, setStatus] = useState('loading')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [purokFilters, setPurokFilters] = useState([])
  const [attendingFilters, setAttendingFilters] = useState([])
  const filterDetailsRef = useRef(null)
  const { pendingId, run } = useLoading()
  const refreshing = pendingId === REFRESH_ID

  useEffect(() => {
    document.title = 'Guests — Admin'
  }, [])

  useEffect(() => {
    // Native <details> only close on their own summary toggle — close them
    // on an outside click too, like any other dropdown.
    function handlePointerDown(event) {
      if (filterDetailsRef.current?.open && !filterDetailsRef.current.contains(event.target)) {
        filterDetailsRef.current.open = false
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    // Don't fetch (or render) any RSVPs until the access code is entered.
    if (!unlocked) return

    let cancelled = false

    getRsvps()
      .then((rsvps) => {
        if (!cancelled) {
          setGuests(rsvps)
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

  function handleRefresh() {
    run(REFRESH_ID, () =>
      getRsvps()
        .then((rsvps) => setGuests(rsvps))
        .catch(() => toast.error('Failed to refresh guests.'))
    )
  }

  const filteredGuests = useMemo(
    () =>
      guests.filter((guest) => {
        if (purokFilters.length > 0 && !purokFilters.includes(firstPurokNumber(guest.purokGrupo))) return false
        if (attendingFilters.length > 0 && !attendingFilters.includes(guest.attending)) return false
        return true
      }),
    [guests, purokFilters, attendingFilters]
  )

  // Declined guests don't count toward the guest tally — only those attending.
  const attendingGuestCount = guests.filter((guest) => guest.attending === 'yes').length
  const filteredAttendingGuestCount = filteredGuests.filter((guest) => guest.attending === 'yes').length

  const activeFilterLabels = [
    purokFilters.length > 0 && `Purok ${purokFilters.join(', ')}`,
    attendingFilters.length > 0 &&
      attendingFilters.map((value) => ATTENDING_OPTIONS.find((option) => option.value === value).label).join(', '),
  ].filter(Boolean)

  function resetPageIndex() {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  function togglePurokFilter(purok) {
    setPurokFilters((prev) => (prev.includes(purok) ? prev.filter((value) => value !== purok) : [...prev, purok]))
    resetPageIndex()
  }

  function resetPurokFilter() {
    setPurokFilters([])
    resetPageIndex()
  }

  function toggleAttendingFilter(value) {
    setAttendingFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
    resetPageIndex()
  }

  function resetAttendingFilter() {
    setAttendingFilters([])
    resetPageIndex()
  }

  function clearFilters() {
    setPurokFilters([])
    setAttendingFilters([])
    resetPageIndex()
  }

  async function handleExport() {
    try {
      // Loaded on demand — exceljs is large, and every visitor to the
      // public RSVP page (main.jsx bundles all pages together) would
      // otherwise download it just for this one admin-only button.
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Guests')

      worksheet.columns = [
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Purok & Grupo', key: 'purokGrupo', width: 14 },
        { header: 'Attending', key: 'attending', width: 12 },
        { header: 'Submitted', key: 'submitted', width: 14 },
      ]

      filteredGuests.forEach((guest) => {
        worksheet.addRow({
          name: toTitleCase(guest.name) || 'Unnamed guest',
          purokGrupo: guest.purokGrupo || '',
          attending: guest.attending === 'yes' ? 'Attending' : 'Declined',
          submitted: formatDate(guest.createdAt),
        })
      })

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'guests.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to export guests.')
    }
  }

  const table = useLegacyTable({
    data: filteredGuests,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const emptyFilterMessage = (
    <>
      No guests found for {activeFilterLabels.join(' · ')}.{' '}
      <Button type="button" variant="link" size="sm" onClick={clearFilters}>
        Clear filter
      </Button>
    </>
  )

  if (!unlocked) {
    return (
      <PasswordGate
        code={ADMIN_ACCESS_CODE}
        title="Admin Access"
        description="Enter the access code to view the guest list."
        onUnlock={() => setUnlocked(true)}
      />
    )
  }

  return (
    <main className="gallery-page">
      <header className="gallery-topbar">
        <p className="gallery-topbar-label">Guests</p>
        <p className="gallery-topbar-title">Admin</p>
      </header>

      <section className="gallery-main">
        {status === 'loading' && <PageLoader label="Loading guests…" />}

        {status === 'error' && (
          <p className="gallery-status gallery-status--error">
            Couldn&rsquo;t load guests. Please try again later.
          </p>
        )}

        {status === 'ready' && guests.length === 0 && (
          <div className="gallery-empty">
            <p className="gallery-empty-title">No RSVPs yet</p>
            <p className="gallery-empty-hint">Submitted RSVPs will show up here.</p>
          </div>
        )}

        {status === 'ready' && guests.length > 0 && (
          <>
            <div className="guests-toolbar">
              <button
                type="button"
                className="toolbar-dropdown-trigger"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh guests"
              >
                <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
                Refresh
              </button>

              <details ref={filterDetailsRef} className="toolbar-dropdown">
                <summary className="toolbar-dropdown-trigger">
                  <ListFilter aria-hidden="true" />
                  {activeFilterLabels.length > 0 ? activeFilterLabels.join(' · ') : 'Filter'}
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div className="toolbar-dropdown-menu toolbar-dropdown-menu--filters">
                  <p className="toolbar-dropdown-label">Purok</p>
                  <div className="chip-grid">
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={purokFilters.length === 0}
                      data-active={purokFilters.length === 0 || undefined}
                      onClick={resetPurokFilter}
                    >
                      All
                    </button>
                    {PUROK_OPTIONS.map((purok) => (
                      <button
                        key={purok}
                        type="button"
                        className="chip"
                        aria-pressed={purokFilters.includes(purok)}
                        data-active={purokFilters.includes(purok) || undefined}
                        onClick={() => togglePurokFilter(purok)}
                      >
                        {purok}
                      </button>
                    ))}
                  </div>

                  <p className="toolbar-dropdown-label">Attending</p>
                  <div className="segmented">
                    <button
                      type="button"
                      className="segmented-option"
                      aria-pressed={attendingFilters.length === 0}
                      data-active={attendingFilters.length === 0 || undefined}
                      onClick={resetAttendingFilter}
                    >
                      Everyone
                    </button>
                    {ATTENDING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="segmented-option"
                        aria-pressed={attendingFilters.includes(option.value)}
                        data-active={attendingFilters.includes(option.value) || undefined}
                        onClick={() => toggleAttendingFilter(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </details>

              <button type="button" className="toolbar-dropdown-trigger" onClick={handleExport}>
                <Download aria-hidden="true" />
                Export
              </button>
            </div>

            <div className="guests-table-frame">
              <div className="admin-table-wrap">
                <table className="admin-table guests-table">
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
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={table.getVisibleLeafColumns().length} className="guests-table-empty">
                          {emptyFilterMessage}
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="guests-cards">
              {table.getRowModel().rows.length === 0 ? (
                <p className="guests-cards-empty">{emptyFilterMessage}</p>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const guest = row.original
                  return (
                    <div key={row.id} className="guest-card" data-attending={guest.attending}>
                      <div className="guest-card-icon">{guest.purokGrupo || '—'}</div>
                      <div className="guest-card-body">
                        <p className="guest-card-name">{toTitleCase(guest.name) || 'Unnamed guest'}</p>
                        <p className="guest-card-date">{formatDate(guest.createdAt)}</p>
                      </div>
                      <span className={`status-badge status-badge--${guest.attending}`}>
                        {guest.attending === 'yes' ? <CircleCheck /> : <CircleX />}
                        {guest.attending === 'yes' ? 'Attending' : 'Declined'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="guests-footer">
              <p className="guests-footer-count">
                {filteredAttendingGuestCount} of {attendingGuestCount} guests
              </p>
              <div className="guests-footer-controls">
                <label className="guests-footer-page-size">
                  Rows per page
                  <select
                    value={table.state.pagination.pageSize}
                    onChange={(event) => table.setPageSize(Number(event.target.value))}
                  >
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <option key={pageSize} value={pageSize}>
                        {pageSize}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  Page {table.state.pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
                </span>
                <div className="guests-footer-buttons">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Go to first page"
                  >
                    <ChevronsLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label="Go to next page"
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                    aria-label="Go to last page"
                  >
                    <ChevronsRight />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
