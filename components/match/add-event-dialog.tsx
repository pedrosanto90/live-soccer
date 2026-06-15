'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addEvent, addFoul } from '@/lib/actions/match-admin'
import type { MatchPlayerLite, MatchTeamLite } from '@/lib/queries/matches'
import type { EventType, Match, MatchEvent } from '@/types/database'

const UNREGISTERED = '__unregistered__'
const NO_CARD = 'none'

// Modo do diálogo: registo de golo ou de falta. Cada um mostra opções próprias.
export type EventDialogMode = 'goal' | 'foul'

// Opções de golo: golo normal (default) ou penálti convertido. Ambos contam
// para o marcador.
const GOAL_TYPES: { value: EventType; label: string }[] = [
  { value: 'goal', label: 'Golo' },
  { value: 'penalty_scored', label: 'Penálti' },
]

// Cartão associado a uma falta. O default é sem cartão.
const CARD_OPTIONS: { value: string; label: string }[] = [
  { value: NO_CARD, label: 'Sem cartão' },
  { value: 'yellow_card', label: 'Cartão amarelo' },
  { value: 'red_card', label: 'Cartão vermelho' },
]

interface AddEventDialogProps {
  mode: EventDialogMode
  matchId: string
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  players: { home: MatchPlayerLite[]; away: MatchPlayerLite[] }
  // Pré-selecção da equipa ao abrir.
  teamId: string
  currentElapsedSecs: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Eventos criados (golo, ou falta + cartão opcional) e o jogo actualizado.
  onAdded: (payload: { events: MatchEvent[]; match: Match }) => void
}

export function AddEventDialog({
  mode,
  matchId,
  homeTeam,
  awayTeam,
  players,
  teamId,
  currentElapsedSecs,
  open,
  onOpenChange,
  onAdded,
}: AddEventDialogProps) {
  const [goalType, setGoalType] = useState<EventType>('goal')
  const [card, setCard] = useState<string>(NO_CARD)
  const [team, setTeam] = useState<string>(teamId)
  const [playerId, setPlayerId] = useState<string>(UNREGISTERED)
  const [playerName, setPlayerName] = useState('')
  const [minute, setMinute] = useState(Math.ceil(currentElapsedSecs / 60))
  const [submitting, setSubmitting] = useState(false)

  // O componente é (re)montado a cada abertura (ver `key` no painel), por isso
  // os valores iniciais acima já reflectem as pré-selecções.
  const teamPlayers = team === homeTeam.id ? players.home : players.away
  const isGoal = mode === 'goal'

  async function handleSubmit() {
    setSubmitting(true)
    const selected =
      playerId !== UNREGISTERED
        ? teamPlayers.find((p) => p.id === playerId)
        : undefined
    const resolvedPlayerId = selected?.id ?? null
    const resolvedPlayerName = selected?.name ?? (playerName.trim() || null)
    const elapsed = Math.max(0, minute) * 60

    if (isGoal) {
      const res = await addEvent(matchId, {
        team_id: team,
        event_type: goalType,
        player_id: resolvedPlayerId,
        player_name: resolvedPlayerName,
        elapsed_secs: elapsed,
      })
      setSubmitting(false)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      onAdded({ events: [res.data.event], match: res.data.match })
      onOpenChange(false)
      return
    }

    const res = await addFoul(matchId, {
      team_id: team,
      player_id: resolvedPlayerId,
      player_name: resolvedPlayerName,
      card: card === NO_CARD ? null : (card as 'yellow_card' | 'red_card'),
      elapsed_secs: elapsed,
    })
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    const events = res.data.card ? [res.data.foul, res.data.card] : [res.data.foul]
    onAdded({ events, match: res.data.match })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isGoal ? 'Registar golo' : 'Registar falta'}</DialogTitle>
          <DialogDescription>
            {isGoal
              ? 'Indica o tipo de golo e quem o marcou.'
              : 'Indica quem cometeu a falta e, se aplicável, o cartão.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isGoal ? (
            <div className="space-y-1.5">
              <Label>Tipo de golo</Label>
              <Select
                value={goalType}
                onValueChange={(v) => setGoalType(v as EventType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Cartão</Label>
              <Select value={card} onValueChange={setCard}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Equipa</Label>
            <Select
              value={team}
              onValueChange={(v) => {
                setTeam(v)
                setPlayerId(UNREGISTERED)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={homeTeam.id}>{homeTeam.name}</SelectItem>
                <SelectItem value={awayTeam.id}>{awayTeam.name}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Jogador</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNREGISTERED}>Não registado</SelectItem>
                {teamPlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.number != null ? `#${p.number} ` : ''}
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {playerId === UNREGISTERED ? (
              <Input
                placeholder="Nome do jogador (opcional)"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-minute">Minuto</Label>
            <Input
              id="event-minute"
              type="number"
              min={0}
              max={99}
              className="w-24"
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
