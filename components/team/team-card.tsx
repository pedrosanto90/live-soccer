'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Eye, Trash2 } from 'lucide-react'

import { deleteTeam } from '@/lib/actions/teams'
import type { TeamWithCount } from '@/lib/queries/teams'
import { TIER_LABELS } from '@/lib/tiers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface TeamCardProps {
  team: TeamWithCount
  tournamentId: string
  isAdmin: boolean
  // Em torneios multi-escalão mostra o escalão da equipa como badge.
  multiTier?: boolean
}

export function TeamCard({
  team,
  tournamentId,
  isAdmin,
  multiTier = false,
}: TeamCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const base = `/tournaments/${tournamentId}/teams/${team.id}`
  const initials = team.short_name ?? team.name.slice(0, 2).toUpperCase()

  function goToTeam() {
    router.push(base)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTeam(team.id)
      if (result.success) {
        toast.success('Equipa apagada.')
        setConfirmDelete(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        data-testid="team-card"
        onClick={goToTeam}
        onKeyDown={(e) => {
          if (e.key === 'Enter') goToTeam()
        }}
        className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80"
      >
        <div
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border"
          style={{ background: team.color_primary }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: team.color_secondary }}
          >
            {initials}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{team.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {team.player_count} jogador(es)
            </p>
            {multiTier ? (
              <Badge variant="secondary" className="text-[10px]">
                {TIER_LABELS[team.tier]}
              </Badge>
            ) : null}
          </div>
        </div>

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Opções da equipa"
                data-testid="team-menu"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => router.push(base)}>
                <Eye className="size-4" />
                Ver equipa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push(`${base}/edit`)}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Apagar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar equipa</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres apagar “{team.name}”? Esta acção também
              remove todos os jogadores da equipa e não pode ser desfeita.
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
              Apagar equipa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
