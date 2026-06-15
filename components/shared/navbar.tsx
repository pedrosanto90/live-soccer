'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, Trophy } from 'lucide-react'

import type { Profile } from '@/types/database'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { UserMenu } from '@/components/shared/user-menu'

const navLinks = [{ href: '/dashboard', label: 'Dashboard' }]

export function Navbar({ user }: { user: Profile | null }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="border-b bg-background">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Esquerda — logo + nome */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="text-sm font-medium">Live Soccer</span>
        </Link>

        {/* Centro — navegação (só desktop) */}
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

        {/* Direita — tema + utilizador + menu mobile */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu profile={user} />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </nav>

      {/* Menu lateral (mobile) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-2">
            {navLinks.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex min-h-[44px] items-center rounded-md px-3 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
