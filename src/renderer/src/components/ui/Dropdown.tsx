import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface DropdownOption {
  value: string | number
  label: string
  hint?: string
}

interface Props {
  value: string | number
  options?: DropdownOption[]
  onChange: (value: string | number) => void
  placeholder?: string
  /** Show a filter box inside the popup — for long lists. */
  searchable?: boolean
  /**
   * Async-search mode: fetch options from the source (e.g. server) instead of
   * filtering `options` in memory. Receives the trimmed query ('' on open).
   */
  onSearch?: (query: string) => Promise<DropdownOption[]>
  /** Display fallback for the trigger when `value` is not in the current options. */
  selectedHint?: DropdownOption
  className?: string
}

export function Dropdown({
  value,
  options = [],
  onChange,
  placeholder = 'Choose…',
  searchable,
  onSearch,
  selectedHint,
  className = ''
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{
    top: number
    bottom: number
    left: number
    width: number
    maxH: number
    up: boolean
  } | null>(null)
  const [asyncOptions, setAsyncOptions] = useState<DropdownOption[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  const isAsync = !!onSearch
  const showFilter = searchable || isAsync

  const q = query.trim().toLowerCase()
  const filtered = isAsync
    ? asyncOptions
    : searchable && q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options
  const selected =
    options.find((o) => o.value === value) ??
    asyncOptions.find((o) => o.value === value) ??
    (selectedHint && selectedHint.value === value ? selectedHint : undefined)

  // Async mode: debounced fetch from source whenever open or query changes
  useEffect(() => {
    const search = onSearchRef.current
    if (!open || !search) return
    let stale = false
    setLoading(true)
    const t = setTimeout(() => {
      search(query.trim())
        .then((res) => {
          if (stale) return
          setAsyncOptions(res)
          setActive(0)
        })
        .catch(() => {
          if (!stale) setAsyncOptions([])
        })
        .finally(() => {
          if (!stale) setLoading(false)
        })
    }, 200)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [open, query])

  // Compute fixed position for the popup: flip up when not enough space below.
  // When flipped, anchor by BOTTOM edge so a short popup sits right above the
  // trigger (never leaves a big gap), and cap height by the real free space.
  const updatePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const POPUP_MAX = 260
    const GAP = 4
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const up = spaceBelow < POPUP_MAX && spaceAbove > spaceBelow
    const avail = (up ? spaceAbove : spaceBelow) - GAP - 8
    setPos({
      up,
      top: rect.bottom + GAP,
      bottom: window.innerHeight - rect.top + GAP,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - rect.width - 8),
      width: rect.width,
      maxH: Math.max(120, Math.min(POPUP_MAX, avail))
    })
  }, [])

  // Close on click outside / focus leaving
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onFocusOut = (e: FocusEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.relatedTarget as Node | null)) setOpen(false)
    }
    const onReposition = () => updatePos()
    document.addEventListener('mousedown', onDown)
    rootRef.current?.addEventListener('focusout', onFocusOut)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      rootRef.current?.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePos])

  // Focus filter box when opened + position popup
  useEffect(() => {
    if (open && showFilter) filterRef.current?.focus()
    if (open) {
      setActive(Math.max(0, filtered.findIndex((o) => o.value === value)))
      updatePos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = () => {
    const next = !open
    if (next) setQuery('')
    setOpen(next)
  }

  const pick = (v: string | number) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) pick(filtered[active].value)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm outline-none transition focus:ring-2 focus:ring-slate-200 ${
          open ? 'border-slate-500 ring-2 ring-slate-200' : 'border-slate-300 focus:border-slate-500'
        }`}
      >
        <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && (
        <div
          data-dropdown-popup=""
          className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{
            top: pos.up ? undefined : pos.top,
            bottom: pos.up ? pos.bottom : undefined,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxH
          }}
        >
          {showFilter && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search size={14} className="absolute top-2 left-2 text-slate-400" />
                <input
                  ref={filterRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  placeholder={isAsync ? 'Type to search…' : 'Type to filter…'}
                  className="w-full rounded-md border border-slate-200 bg-white py-1.5 pr-2 pl-7 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400"
                />
              </div>
            </div>
          )}

          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-sm text-slate-400">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            ) : (
              filtered.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => pick(o.value)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      o.value === value
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : i === active
                          ? 'bg-slate-50 text-slate-900'
                          : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      {o.label}
                      {o.hint && <span className="font-normal text-slate-400"> — {o.hint}</span>}
                    </span>
                    {o.value === value && <Check size={14} className="shrink-0 text-slate-700" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
