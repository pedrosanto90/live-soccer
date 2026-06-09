import type { Metadata } from 'next'

import { PageHeader } from '@/components/ui/page-header'
import { TournamentForm } from '@/components/tournament/tournament-form'

export const metadata: Metadata = {
  title: 'Criar torneio · Live Soccer',
}

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Criar torneio"
        description="Define as regras e configurações do teu torneio."
      />
      <TournamentForm />
    </div>
  )
}
