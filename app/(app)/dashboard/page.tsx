import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Trophy } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = {
  title: 'Dashboard · Live Soccer',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Segurança extra para além do layout/proxy.
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const name = profile?.name ?? user.email

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${name}`}
        description="Gere os teus torneios de futebol a partir daqui."
      >
        <Button asChild>
          <Link href="/tournaments/new">
            <Plus className="size-4" />
            Criar torneio
          </Link>
        </Button>
      </PageHeader>

      <div className="rounded-xl border-subtle bg-surface-1">
        <EmptyState
          icon={<Trophy />}
          title="Ainda não tens torneios"
          description="Cria o teu primeiro torneio para começares a organizar jogos e equipas."
          action={
            <Button asChild>
              <Link href="/tournaments/new">
                <Plus className="size-4" />
                Criar torneio
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}
