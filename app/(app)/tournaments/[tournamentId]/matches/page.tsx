import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Plus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import {
  getMatchesByTournament,
  getRefereesByTournament,
  type MatchWithRelations,
} from '@/lib/queries/matches'
import { getPhasesByTournament } from '@/lib/queries/phases'
import type { MatchStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { MatchRow } from '@/components/match/match-row'
import { MatchFilters } from '@/components/match/match-filters'

export const metadata: Metadata = {
  title: 'Jogos · Live Soccer',
}

const VALID_STATUS: MatchStatus[] = [
  'scheduled',
  'in_progress',
  'half_time',
  'extra_time',
  'penalties',
  'finished',
  'cancelled',
]

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string }>
  searchParams: Promise<{ phase?: string; status?: string }>
}) {
  const { tournamentId } = await params
  const { phase, status } = await searchParams

  const statusFilter =
    status && VALID_STATUS.includes(status as MatchStatus)
      ? (status as MatchStatus)
      : undefined

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: membership } = await supabase
      .from('tournament_members')
      .select('role')
      .eq('tournament_id', tournamentId)
      .eq('profile_id', user.id)
      .maybeSingle()
    isAdmin = membership?.role === 'admin' || membership?.role === 'operator'
  }

  const [matches, phases, referees] = await Promise.all([
    getMatchesByTournament(tournamentId, {
      phase_id: phase,
      status: statusFilter,
      includeBracket: true,
    }),
    getPhasesByTournament(tournamentId),
    getRefereesByTournament(tournamentId),
  ])

  // Agrupa por fase (na ordem) e, dentro das fases de grupos, por grupo.
  const sections: { label: string; matches: MatchWithRelations[] }[] = []
  for (const ph of phases) {
    const phaseMatches = matches.filter((m) => m.phase.id === ph.id)
    if (phaseMatches.length === 0) continue

    if (ph.type === 'group' && ph.groups.length > 0) {
      for (const group of ph.groups) {
        const groupMatches = phaseMatches.filter((m) => m.group?.id === group.id)
        if (groupMatches.length > 0) {
          sections.push({ label: `${ph.name} · ${group.name}`, matches: groupMatches })
        }
      }
      const noGroup = phaseMatches.filter((m) => !m.group)
      if (noGroup.length > 0) sections.push({ label: ph.name, matches: noGroup })
    } else {
      sections.push({ label: ph.name, matches: phaseMatches })
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Jogos" description={`${matches.length} jogo(s)`}>
        {isAdmin ? (
          <Button asChild data-testid="add-match">
            <Link href={`/tournaments/${tournamentId}/matches/new`}>
              <Plus className="size-4" />
              Criar jogo
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <MatchFilters
        phases={phases.map((p) => ({ id: p.id, name: p.name }))}
        currentFilters={{ phase_id: phase, status: statusFilter }}
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={<Calendar />}
          title="Ainda não há jogos"
          description="Os jogos são criados automaticamente após o sorteio, ou podes criar manualmente."
        />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <Section key={section.label} title={section.label}>
              <div className="flex flex-col gap-2">
                {section.matches.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    tournamentId={tournamentId}
                    referees={referees}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}
    </div>
  )
}
