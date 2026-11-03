interface Props<T extends string | number | boolean> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

export function SegmentedToggle<T extends string | number | boolean>({ value, options, onChange, className = '' }: Props<T>) {
  return (
    <div className={`flex rounded-lg border border-slate-300 bg-white p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
