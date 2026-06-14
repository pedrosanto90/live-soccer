import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { getTournamentBySlug } from '@/lib/queries/tournaments'
import { getMatchesByTournament } from '@/lib/queries/matches'
import { getStandingsByTournament } from '@/lib/queries/standings'
import { getKnockoutBrackets } from '@/lib/queries/bracket'
import { formatDate } from '@/lib/utils'
import { Section } from '@/components/ui/section'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { CalendarDays } from 'lucide-react'
import { PublicMatchRow } from '@/components/match/public-match-row'
import { StandingsView } from '@/components/standings/standings-view'
import { BracketViewWrapper } from '@/components/bracket/bracket-view-wrapper'
import type { TournamentSettings } from '@/types/database'

const LIVE_STATUSES = ['in_progress', 'half_time', 'extra_time', 'penalties']
const QUALIFYING_SPOTS = 2

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) return {}

  const description =
    tournament.description ??
    `Acompanha os resultados e classificação de ${tournament.name}`

  return {
    title: `${tournament.name} | Live Soccer`,
    description,
    openGraph: {
      title: tournament.name,
      description:
        tournament.description ?? `Resultados ao vivo de ${tournament.name}`,
      type: 'website',
    },
  }
}

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await getTournamentBySlug(slug)
  if (!tournament || tournament.visibility !== 'public') {
    notFound()
  }

  const [matches, phases, brackets] = await Promise.all([
    getMatchesByTournament(tournament.id),
    getStandingsByTournament(tournament.id),
    getKnockoutBrackets(tournament.id),
  ])

  const liveMatches = matches.filter((m) => LIVE_STATUSES.includes(m.status))
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled')
  const finishedMatches = matches.filter((m) => m.status === 'finished')

  const settings = tournament.settings as TournamentSettings

  return (
    <div>
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {tournament.logo_url ? (
            <Image
              src={tournament.logo_url}
              alt={tournament.name}
              width={48}
              height={48}
              className="mb-3 rounded-md"
            />
          ) : null}
          <h1 className="text-2xl font-medium">{tournament.name}</h1>
          {tournament.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {tournament.description}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <StatusBadge status={tournament.status} />
            {tournament.starts_at ? (
              <p className="text-xs text-muted-foreground">
                {formatDate(tournament.starts_at)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList>
            <TabsTrigger value="matches">Jogos</TabsTrigger>
            <TabsTrigger value="standings">Classificação</TabsTrigger>
            {brackets.length > 0 ? (
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="matches" className="mt-6 space-y-8">
            {liveMatches.length === 0 &&
            upcomingMatches.length === 0 &&
            finishedMatches.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title="Ainda não há jogos"
                description="Os jogos aparecem aqui assim que forem criados."
              />
            ) : null}

            {liveMatches.length > 0 ? (
              <Section title="Em curso">
                <div className="space-y-2">
                  {liveMatches.map((match) => (
                    <PublicMatchRow key={match.id} match={match} />
                  ))}
                </div>
              </Section>
            ) : null}

            {upcomingMatches.length > 0 ? (
              <Section title="Próximos jogos">
                <div className="space-y-2">
                  {upcomingMatches.map((match) => (
                    <PublicMatchRow key={match.id} match={match} />
                  ))}
                </div>
              </Section>
            ) : null}

            {finishedMatches.length > 0 ? (
              <Section title="Resultados">
                <div className="space-y-2">
                  {finishedMatches.map((match) => (
                    <PublicMatchRow key={match.id} match={match} />
                  ))}
                </div>
              </Section>
            ) : null}
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            <StandingsView
              phases={phases}
              tiebreakOrder={settings.tiebreak_order}
              qualifyingSpots={QUALIFYING_SPOTS}
            />
          </TabsContent>

          {brackets.length > 0 ? (
            <TabsContent value="bracket" className="mt-6 space-y-8">
              {brackets.map((phase) => (
                <Section key={phase.id} title={phase.name}>
                  <BracketViewWrapper
                    phaseId={phase.id}
                    initialMatches={phase.matches}
                    isAdmin={false}
                  />
                </Section>
              ))}
            </TabsContent>
          ) : null}
        </Tabs>
      </main>
    </div>
  )
}
