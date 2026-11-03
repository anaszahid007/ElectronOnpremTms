import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@shared/constants'
import { Dropdown } from './Dropdown'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-slate-700">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Prev
        </button>

        <span className="min-w-24 text-center text-sm text-slate-600">
          Page <span className="font-semibold">{page}</span> of {totalPages}
        </span>

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

interface PageSizeMenuProps {
  pageSize: number
  onChange: (pageSize: number) => void
}

export function PageSizeMenu({ pageSize, onChange }: PageSizeMenuProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
      Rows
      <Dropdown
        value={pageSize}
        options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        onChange={(v) => onChange(Number(v))}
        className="w-20"
      />
    </div>
  )
}
