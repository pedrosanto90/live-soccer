'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Ban,
  RotateCcw,
  Users,
} from 'lucide-react'

import { positionLabels } from '@/lib/validations/team'
import { deletePlayer, togglePlayerActive } from '@/lib/actions/teams'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PlayerDialog, type EditablePlayer } from '@/components/team/player-dialog'

interface PlayerListProps {
  players: EditablePlayer[]
  teamId: string
  isAdmin: boolean
}

export function PlayerList({ players, teamId, isAdmin }: PlayerListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EditablePlayer | null>(null)
  const [toRemove, setToRemove] = useState<EditablePlayer | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(player: EditablePlayer) {
    setEditing(player)
    setDialogOpen(true)
  }

  function handleToggle(player: EditablePlayer) {
    startTransition(async () => {
      const result = await togglePlayerActive(player.id)
      if (result.success) {
        toast.success(
          result.data.is_active ? 'Jogador reactivado.' : 'Jogador suspenso.'
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!toRemove) return
    startTransition(async () => {
      const result = await deletePlayer(toRemove.id)
      if (result.success) {
        toast.success('Jogador removido.')
        setToRemove(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      {isAdmin ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate} data-testid="add-player">
            <Plus className="size-3.5" />
            Adicionar jogador
          </Button>
        </div>
      ) : null}

      {players.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Sem jogadores"
          description="Adiciona os jogadores que compõem o plantel desta equipa."
        />
      ) : (
        <div data-testid="player-list">
          {players.map((player) => (
            <div
              key={player.id}
              data-testid="player-row"
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-0"
            >
              <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                {player.number ?? '—'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{player.name}</span>
                  {!player.is_active ? (
                    <Badge variant="secondary" className="text-2xs">
                      Suspenso
                    </Badge>
                  ) : null}
                </p>
                {player.position ? (
                  <p className="text-xs text-muted-foreground">
                    {positionLabels[player.position]}
                  </p>
                ) : null}
              </div>

              {isAdmin ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Opções do jogador"
                      data-testid="player-menu"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(player)}>
                      <Pencil className="size-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleToggle(player)}
                      disabled={isPending}
                    >
                      {player.is_active ? (
                        <>
                          <Ban className="size-4" />
                          Suspender
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-4" />
                          Reactivar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setToRemove(player)}
                    >
                      <Trash2 className="size-4" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {isAdmin ? (
        <PlayerDialog
          teamId={teamId}
          player={editing}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      <AlertDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover jogador</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres remover “{toRemove?.name}”? Esta acção
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isPending}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
