import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

// Utilizador autenticado do request corrente. Envolto em `cache()` para que
// múltiplas chamadas dentro da mesma passagem de render (layout + página, checks
// de defense-in-depth) partilhem um único round-trip à auth do Supabase.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
