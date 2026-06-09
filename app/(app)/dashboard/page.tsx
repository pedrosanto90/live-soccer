import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Trophy } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getTournamentsByUser } from '@/lib/queries/tournaments'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { TournamentCard } from '@/components/tournament/tournament-card'

export const metadata: Metadata = {
  title: 'Dashboard · Live Soccer',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Segurança extra para além do layout/proxy.
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const name = profile?.name ?? user.email
  const tournaments = await getTournamentsByUser(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${name}`}
        description="Gere os teus torneios de futebol a partir daqui."
      >
        {tournaments.length > 0 ? (
          <Button asChild>
            <Link href="/tournaments/new">
              <Plus className="size-4" />
              Criar torneio
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border-subtle bg-surface-1">
          <EmptyState
            icon={<Trophy />}
            title="Ainda não tens torneios"
            description="Cria o teu primeiro torneio para começares a organizar jogos e equipas."
            action={
              <Button asChild>
                <Link href="/tournaments/new">
                  <Plus className="size-4" />
                  Criar torneio
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  )
}
