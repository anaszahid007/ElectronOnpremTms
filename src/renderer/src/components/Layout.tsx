import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, LogOut, Settings, User, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import brandLogo from '@/assets/images/brand_logo_round.png'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [shopName, setShopName] = useState('Tailor Manager')

  useEffect(() => {
    api.settings
      .get()
      .then((s) => setShopName(s.shopName?.trim() || 'Tailor Manager'))
      .catch(() => {})
  }, [pathname])

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200">
        <div className="flex items-center gap-3 px-5 py-6">
          <img
            src={brandLogo}
            alt="Tailor Manager logo"
            className="h-16 w-16 shrink-0 rounded-full bg-white p-1 object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{shopName}</p>
            <p className="text-xs text-slate-400">Tailor Manager</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-4 py-4">
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <User size={16} />
            </div>
            <span className="truncate text-sm font-medium text-white">{user?.username}</span>
          </div>
          <button
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
