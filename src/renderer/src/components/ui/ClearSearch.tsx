import { X } from 'lucide-react'

export function ClearSearch({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label="Clear search"
      title="Clear search"
      onClick={onClear}
      className="absolute top-1/2 right-2 z-10 -translate-y-1/2 cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      <X size={14} />
    </button>
  )
}
