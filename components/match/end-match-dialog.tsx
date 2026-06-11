'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { TournamentSettings } from '@/types/database'

type Outcome = 'finish' | 'extra_time' | 'penalties'

interface EndMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: TournamentSettings
  onChoose: (outcome: Outcome) => void
  // Esconde a opção de prolongamento (ex.: o empate persiste após o
  // prolongamento — só restam penáltis ou empate).
  allowExtra?: boolean
  pending?: boolean
}

// Mostrado quando um jogo termina empatado: deixa o operador escolher como
// prosseguir (empate, prolongamento ou penáltis).
export function EndMatchDialog({
  open,
  onOpenChange,
  settings,
  onChoose,
  allowExtra = true,
  pending,
}: EndMatchDialogProps) {
  const extraMinutes = settings.match.extra_time_duration_minutes
  const shootoutKicks = settings.match.penalty_shootout_kicks

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>O jogo terminou empatado</AlertDialogTitle>
          <AlertDialogDescription>Como pretendes prosseguir?</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-start py-3"
            disabled={pending}
            onClick={() => onChoose('finish')}
          >
            <span className="font-medium">Terminar em empate</span>
            <span className="text-xs text-muted-foreground">
              Regista o resultado como empate
            </span>
          </Button>

          {allowExtra && extraMinutes > 0 ? (
            <Button
              variant="outline"
              className="h-auto flex-col items-start py-3"
              disabled={pending}
              onClick={() => onChoose('extra_time')}
            >
              <span className="font-medium">Prolongamento</span>
              <span className="text-xs text-muted-foreground">
                {extraMinutes} min extra por parte
              </span>
            </Button>
          ) : null}

          <Button
            variant="outline"
            className="h-auto flex-col items-start py-3"
            disabled={pending}
            onClick={() => onChoose('penalties')}
          >
            <span className="font-medium">Penáltis</span>
            <span className="text-xs text-muted-foreground">
              Série de {shootoutKicks} pontapés
            </span>
          </Button>
        </div>

        <AlertDialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
