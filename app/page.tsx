import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Trophy } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Trophy className="size-6" />
        </span>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-medium tracking-tight">Live Soccer</h1>
          <p className="max-w-md text-lg text-muted-foreground text-balance">
            Gere os teus torneios de futebol de forma simples e profissional.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/register">Começar agora</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </div>
    </div>
  )
}
