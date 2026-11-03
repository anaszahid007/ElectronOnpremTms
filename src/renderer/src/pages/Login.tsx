import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import brandLogo from '@/assets/images/brand_logo_round.png'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await login(username, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <img
            src={brandLogo}
            alt="Tailor Manager logo"
            className="h-32 w-32 rounded-full object-cover"
          />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Tailor Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your shop</p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
