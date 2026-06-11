'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GitMerge, RefreshCw, Loader2 } from 'lucide-react'

import {
  getBracketSection,
  generateKnockoutBracket,
  resetKnockoutBracket,
} from '@/lib/actions/bracket'
import type { BracketSection } from '@/lib/queries/bracket'
import { Button } from '@/components/ui/button'
import { BracketViewWrapper } from './bracket-view-wrapper'

interface KnockoutSectionProps {
  phaseId: string
  tournamentId: string
  isAdmin: boolean
}

// Corpo expandido de uma fase de eliminatórias. Carrega o estado do bracket
// on-demand (server action) e mostra ou o botão de geração com as equipas
// apuradas, ou o bracket já gerado (com opção de refazer enquanto nenhum jogo
// tiver começado).
export function KnockoutSection({
  phaseId,
  tournamentId,
  isAdmin,
}: KnockoutSectionProps) {
  const router = useRouter()
  const [section, setSection] = useState<BracketSection | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    getBracketSection(phaseId).then((s) => {
      if (active) setSection(s)
    })
    return () => {
      active = false
    }
  }, [phaseId])

  function reload() {
    getBracketSection(phaseId).then(setSection)
    router.refresh()
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateKnockoutBracket(phaseId)
      if (result.success) {
        toast.success('Bracket gerado.')
        reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetKnockoutBracket(phaseId)
      if (result.success) {
        toast.success('Bracket removido.')
        reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (!section) {
    return (
      <div className="flex items-center justify-center border-t border-border p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    )
  }

  if (section.generated) {
    // Refazer só faz sentido para admin e enquanto nada começou — o action
    // valida-o, mas escondê-lo durante a jogabilidade evita ruído.
    const canReset =
      isAdmin && section.matches.every((m) => m.status === 'scheduled')
    return (
      <div className="border-t border-border p-4">
        <BracketViewWrapper
          phaseId={phaseId}
          initialMatches={section.matches}
          isAdmin={isAdmin}
          tournamentId={tournamentId}
        />
        {canReset ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleReset}
            disabled={isPending}
          >
            <RefreshCw className="size-3.5" />
            Refazer bracket
          </Button>
        ) : null}
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <p className="border-t border-border p-4 text-sm text-muted-foreground">
        O quadro de eliminatórias é preenchido após a fase de grupos.
      </p>
    )
  }

  return (
    <div className="border-t border-border p-4">
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-center text-sm text-muted-foreground">
          Gera o bracket a partir das equipas apuradas da fase de grupos.
        </p>
        {section.qualified.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            {section.qualified.length} equipa(s) apurada(s):{' '}
            {section.qualified.map((t) => t.team_name).join(', ')}
          </p>
        ) : (
          <p className="text-center text-xs text-warning">
            Ainda não há equipas apuradas suficientes.
          </p>
        )}
        <Button
          onClick={handleGenerate}
          disabled={isPending || section.qualified.length < 2}
        >
          <GitMerge className="size-4" />
          Gerar bracket
        </Button>
      </div>
    </div>
  )
}
