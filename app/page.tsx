import Link from 'next/link'
import { Trophy } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getPublicTournaments } from '@/lib/queries/tournaments'
import { parseTournamentFilters } from '@/lib/validations/tournament-search'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { HomeNavbar } from '@/components/shared/home-navbar'
import { TournamentSearch } from '@/components/home/tournament-search'
import { PublicTournamentCard } from '@/components/home/public-tournament-card'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filters = parseTournamentFilters(params)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [tournaments, profile] = await Promise.all([
    getPublicTournaments(filters),
    user
      ? supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ])

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.starts_after ||
      filters.starts_before
  )

  return (
    <div className="min-h-svh bg-background">
      <HomeNavbar profile={profile} />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Torneios de Futebol
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanha resultados, classificações e jogos em tempo real.
          </p>
        </div>

        {/* Pesquisa e filtros */}
        <TournamentSearch initialFilters={filters} />

        {/* Contador de resultados */}
        <p className="mb-4 text-xs text-muted-foreground">
          {tournaments.length} torneio(s) encontrado(s)
          {hasActiveFilters && ' para os filtros seleccionados'}
        </p>

        {/* Listagem */}
        {tournaments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <PublicTournamentCard
                key={tournament.id}
                tournament={tournament}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy />}
            title="Nenhum torneio encontrado"
            description={
              hasActiveFilters
                ? 'Tenta ajustar os filtros de pesquisa.'
                : 'Ainda não há torneios públicos disponíveis.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" asChild>
                  <Link href="/">Limpar filtros</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </main>
    </div>
  )
}
