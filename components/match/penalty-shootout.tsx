'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useMatch } from '@/contexts/match-context'
import type { LiveAction } from '@/hooks/use-match-broadcast'
import { addPenaltyKick, finishMatch } from '@/lib/actions/match-admin'
import { getNextPenaltyKick, isPenaltySeriesComplete, cn } from '@/lib/utils'
import type { MatchPlayerLite, MatchTeamLite } from '@/lib/queries/matches'
import type { TournamentSettings } from '@/types/database'

const UNREGISTERED = '__unregistered__'

interface PenaltyShootoutProps {
  matchId: string
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  players: { home: MatchPlayerLite[]; away: MatchPlayerLite[] }
  settings: TournamentSettings
  isAdmin: boolean
  // Despacha localmente e transmite para os painéis públicos (vem do painel).
  onApply: (action: LiveAction) => void
}

export function PenaltyShootout({
  matchId,
  homeTeam,
  awayTeam,
  players,
  settings,
  isAdmin,
  onApply,
}: PenaltyShootoutProps) {
  const { state } = useMatch()
  const { penalties } = state
  const [playerId, setPlayerId] = useState<string>(UNREGISTERED)
  const [pending, setPending] = useState(false)

  const totalKicks = settings.match.penalty_shootout_kicks
  const next = getNextPenaltyKick(penalties, homeTeam.id, awayTeam.id)
  const complete = isPenaltySeriesComplete(penalties, totalKicks)

  const homeScored = penalties.filter(
    (p) => p.team_id === homeTeam.id && p.scored
  ).length
  const awayScored = penalties.filter(
    (p) => p.team_id === awayTeam.id && p.scored
  ).length

  const nextTeam = next.teamId === homeTeam.id ? homeTeam : awayTeam
  const nextPlayers = next.teamId === homeTeam.id ? players.home : players.away

  async function register(scored: boolean) {
    setPending(true)
    const selected =
      playerId !== UNREGISTERED
        ? nextPlayers.find((p) => p.id === playerId)
        : undefined

    const res = await addPenaltyKick(matchId, {
      team_id: next.teamId,
      player_id: selected?.id ?? null,
      player_name: selected?.name ?? null,
      scored,
    })
    setPending(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    onApply({ type: 'PENALTY_ADDED', payload: res.data.kick })
    onApply({ type: 'MATCH_UPDATED', payload: res.data.match })
    setPlayerId(UNREGISTERED)
  }

  async function handleFinish() {
    setPending(true)
    const res = await finishMatch(matchId, 'finish')
    setPending(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    onApply({ type: 'MATCH_UPDATED', payload: res.data })
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Grandes penalidades
      </p>

      {/* Placar da série */}
      <div className="grid grid-cols-3 items-center gap-2 text-center">
        <p className="truncate text-sm font-medium">{homeTeam.name}</p>
        <p className="text-3xl font-medium tabular-nums">
          {homeScored} — {awayScored}
        </p>
        <p className="truncate text-sm font-medium">{awayTeam.name}</p>
      </div>

      {/* Histórico de pontapés por equipa */}
      <div className="grid grid-cols-2 gap-3">
        {[homeTeam, awayTeam].map((team) => (
          <div key={team.id} className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {team.short_name ?? team.name}
            </p>
            <div className="flex flex-wrap gap-1">
              {penalties
                .filter((p) => p.team_id === team.id)
                .map((p) => (
                  <span
                    key={p.id}
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-xs font-medium',
                      p.scored
                        ? 'bg-success-bg text-success'
                        : 'bg-danger-bg text-danger'
                    )}
                    title={p.player_name ?? undefined}
                  >
                    {p.scored ? '✓' : '✗'}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && !complete ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm">
            Próximo: <span className="font-medium">{nextTeam.name}</span> · pontapé{' '}
            {next.kickOrder}
          </p>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNREGISTERED}>Não registado</SelectItem>
              {nextPlayers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-success text-white hover:bg-success/90"
              disabled={pending}
              onClick={() => register(true)}
            >
              Marcou
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => register(false)}
            >
              Falhou
            </Button>
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <Button
          variant={complete ? 'default' : 'outline'}
          className="w-full"
          disabled={pending}
          onClick={handleFinish}
        >
          Terminar jogo
        </Button>
      ) : null}
    </div>
  )
}
