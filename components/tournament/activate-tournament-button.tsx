'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Play } from 'lucide-react'

import { updateTournamentStatus } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'

export function ActivateTournamentButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function activate() {
    startTransition(async () => {
      const result = await updateTournamentStatus(tournamentId, 'active')
      if (result.success) {
        toast.success('Torneio activado.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button onClick={activate} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      Activar torneio
    </Button>
  )
}
