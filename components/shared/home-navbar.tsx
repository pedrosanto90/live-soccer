'use client'

import Link from 'next/link'
import { LayoutDashboard, Trophy } from 'lucide-react'

import type { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// Navbar pública da home — mais simples que a navbar da área de administração.
export function HomeNavbar({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
        {/* Esquerda — logo + nome */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="text-sm font-medium">Live Soccer</span>
        </Link>

        {/* Direita */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {profile ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1.5 size-3.5" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Registar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
