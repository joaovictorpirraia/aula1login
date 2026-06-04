'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, TrendingUp, Kanban, Settings } from 'lucide-react'
import { signOut } from '@/app/login/actions'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/clientes',       label: 'Clientes',       icon: Users },
  { href: '/pipeline',       label: 'Pipeline',       icon: TrendingUp },
  { href: '/kanban',         label: 'Kanban',         icon: Kanban },
  { href: '/configuracoes',  label: 'Configurações',  icon: Settings },
]

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-gray-800">CRM Vendas</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </aside>
  )
}
