import { forwardRef, type ButtonHTMLAttributes } from 'react'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'checked' | 'onChange' | 'role'> {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, disabled = false, className = '', 'aria-label': ariaLabel = 'Toggle', ...rest }, ref) => (
    <button
      ref={ref}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 cursor-pointer select-none
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${className}
      `}
      {...rest}
    >
      <span
        className={`
          relative inline-block w-11 h-6 rounded-full transition-colors duration-200
          ${checked ? 'bg-slate-900' : 'bg-slate-300'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow
            transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </span>
    </button>
  )
)

Switch.displayName = 'Switch'