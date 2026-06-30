import { BarChart2 } from 'lucide-react'

import {
  groupStandingsByTier,
  type PhaseStandings,
} from '@/lib/queries/standings'
import { Section } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { StandingsTableWrapper } from '@/components/standings/standings-table-wrapper'
import { TierSeparator } from '@/components/shared/tier-separator'
import type { TiebreakerCriterion } from '@/types/database'

interface StandingsViewProps {
  phases: PhaseStandings[]
  tiebreakOrder: TiebreakerCriterion[]
  qualifyingSpots?: number
  // Em torneios multi-escalão a classificação é separada por escalão (sem tabs),
  // tudo numa página vertical optimizada para projecção.
  multiTier?: boolean
}

// Tabelas de classificação de um conjunto de fases (de um torneio ou de um
// único escalão).
function PhasesStandings({
  phases,
  tiebreakOrder,
  qualifyingSpots,
}: Omit<StandingsViewProps, 'multiTier'>) {
  return (
    <div className="space-y-8">
      {phases.map((phase) => (
        <Section key={phase.phase.id} title={phase.phase.name}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {phase.groups.map((group) => (
              <div key={group.group.id}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.group.name}
                </p>
                <StandingsTableWrapper
                  groupId={group.group.id}
                  initialStandings={group.standings}
                  tiebreakOrder={tiebreakOrder}
                  qualifyingSpots={qualifyingSpots}
                />
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

// Renderiza as classificações por fase e grupo. Partilhado entre a página de
// admin e a página pública do torneio.
export function StandingsView({
  phases,
  tiebreakOrder,
  qualifyingSpots,
  multiTier = false,
}: StandingsViewProps) {
  const hasStandings = phases.some((p) =>
    p.groups.some((g) => g.standings.length > 0)
  )

  if (!hasStandings) {
    return (
      <EmptyState
        icon={<BarChart2 />}
        title="Ainda não há classificação"
        description="A classificação aparece após o sorteio e o início dos jogos."
      />
    )
  }

  if (multiTier) {
    const tiers = groupStandingsByTier(phases)
    return (
      <div className="space-y-10">
        {tiers.map((tier) => (
          <div key={tier.tier}>
            <TierSeparator label={tier.tierLabel} />
            <PhasesStandings
              phases={tier.phases}
              tiebreakOrder={tiebreakOrder}
              qualifyingSpots={qualifyingSpots}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <PhasesStandings
      phases={phases}
      tiebreakOrder={tiebreakOrder}
      qualifyingSpots={qualifyingSpots}
    />
  )
}
