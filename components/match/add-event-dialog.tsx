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
import { addEvent } from '@/lib/actions/match-admin'
import type { MatchPlayerLite, MatchTeamLite } from '@/lib/queries/matches'
import type { EventType, Match, MatchEvent } from '@/types/database'

const UNREGISTERED = '__unregistered__'

// Tipos de evento que se registam por este diálogo (penáltis têm o seu próprio
// fluxo na série de grandes penalidades).
const EVENT_LABELS: { value: EventType; label: string }[] = [
  { value: 'goal', label: 'Golo' },
  { value: 'own_goal', label: 'Golo contra' },
  { value: 'foul', label: 'Falta' },
  { value: 'yellow_card', label: 'Cartão amarelo' },
  { value: 'red_card', label: 'Cartão vermelho' },
]

interface AddEventDialogProps {
  matchId: string
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  players: { home: MatchPlayerLite[]; away: MatchPlayerLite[] }
  // Pré-selecções ao abrir.
  teamId: string
  eventType: EventType
  currentElapsedSecs: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (payload: { event: MatchEvent; match: Match }) => void
}

export function AddEventDialog({
  matchId,
  homeTeam,
  awayTeam,
  players,
  teamId,
  eventType,
  currentElapsedSecs,
  open,
  onOpenChange,
  onAdded,
}: AddEventDialogProps) {
  const [type, setType] = useState<EventType>(eventType)
  const [team, setTeam] = useState<string>(teamId)
  const [playerId, setPlayerId] = useState<string>(UNREGISTERED)
  const [playerName, setPlayerName] = useState('')
  const [minute, setMinute] = useState(Math.ceil(currentElapsedSecs / 60))
  const [submitting, setSubmitting] = useState(false)

  // O componente é (re)montado a cada abertura (ver `key` no painel), por isso
  // os valores iniciais acima já reflectem as pré-selecções.
  const teamPlayers = team === homeTeam.id ? players.home : players.away

  async function handleSubmit() {
    setSubmitting(true)
    const selected =
      playerId !== UNREGISTERED
        ? teamPlayers.find((p) => p.id === playerId)
        : undefined

    const res = await addEvent(matchId, {
      team_id: team,
      event_type: type,
      player_id: selected?.id ?? null,
      player_name: selected?.name ?? (playerName.trim() || null),
      elapsed_secs: Math.max(0, minute) * 60,
    })
    setSubmitting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    onAdded(res.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registar evento</DialogTitle>
          <DialogDescription>
            Adiciona um golo, falta ou cartão ao jogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de evento</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_LABELS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
