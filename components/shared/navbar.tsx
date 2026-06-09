'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy } from 'lucide-react'

import type { Profile } from '@/types/database'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/shared/user-menu'

const navLinks = [
  { href: '/tournaments', label: 'Torneios' },
  { href: '/teams', label: 'Equipas' },
  { href: '/matches', label: 'Jogos' },
]

export function Navbar({ user }: { user: Profile | null }) {
  const pathname = usePathname()

  return (
    <header className="border-b bg-background">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        {/* Esquerda — logo + nome */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="text-sm font-medium">Live Soccer</span>
        </Link>

        {/* Centro — navegação */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Direita — tema + utilizador */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu profile={user} />
        </div>
      </nav>
    </header>
  )
}
