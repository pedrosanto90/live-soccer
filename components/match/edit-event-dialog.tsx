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
import { updateEvent } from '@/lib/actions/match-admin'
import type { MatchPlayerLite, MatchTeamLite } from '@/lib/queries/matches'
import type { MatchEvent } from '@/types/database'

const UNREGISTERED = '__unregistered__'

interface EditEventDialogProps {
  event: MatchEvent
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  players: { home: MatchPlayerLite[]; away: MatchPlayerLite[] }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (event: MatchEvent) => void
}

// Edita o jogador e o minuto de um evento já registado (a equipa e o tipo são
// fixos — alterá-los mexeria nos contadores). O componente é (re)montado a cada
// abertura via `key` no painel, por isso os estados iniciais já reflectem o
// evento.
export function EditEventDialog({
  event,
  homeTeam,
  awayTeam,
  players,
  open,
  onOpenChange,
  onSaved,
}: EditEventDialogProps) {
  const teamPlayers = event.team_id === homeTeam.id ? players.home : players.away
  const teamName = event.team_id === homeTeam.id ? homeTeam.name : awayTeam.name

  const [playerId, setPlayerId] = useState<string>(
    event.player_id && teamPlayers.some((p) => p.id === event.player_id)
      ? event.player_id
      : UNREGISTERED
  )
  const [playerName, setPlayerName] = useState(
    event.player_id ? '' : event.player_name ?? ''
  )
  const [minute, setMinute] = useState(Math.ceil(event.elapsed_secs / 60))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    const selected =
      playerId !== UNREGISTERED
        ? teamPlayers.find((p) => p.id === playerId)
        : undefined

    const res = await updateEvent(event.id, {
      player_id: selected?.id ?? null,
      player_name: selected?.name ?? (playerName.trim() || null),
      elapsed_secs: Math.max(0, minute) * 60,
    })
    setSubmitting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    onSaved(res.data.event)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
          <DialogDescription>{teamName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label htmlFor="edit-event-minute">Minuto</Label>
            <Input
              id="edit-event-minute"
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
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
