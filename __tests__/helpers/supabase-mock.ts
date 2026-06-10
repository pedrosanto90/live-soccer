import { vi } from 'vitest'

// Constrói um mock de cliente Supabase para os testes de integração das
// Server Actions. Um único "builder" encadeável serve todas as chamadas a
// from(); como as actions usam terminais distintos (single vs maybeSingle),
// basta configurar o resultado de cada terminal.
//
// Uso:
//   const supabase = makeSupabaseMock({
//     user: { id: 'user-1' },
//     maybeSingle: { data: null },          // ex.: slug único
//     single: { data: { id: 'x' } },        // ex.: insert().select().single()
//   })
//   vi.mocked(createClient).mockResolvedValueOnce(supabase as never)
type Terminal = { data: unknown; error?: unknown }

export function makeSupabaseMock(opts: {
  user?: Record<string, unknown> | null
  single?: Terminal
  maybeSingle?: Terminal
  // Sequências para actions que atingem o mesmo terminal mais do que uma vez
  // (ex.: updateTournamentStatus → membership.maybeSingle() e depois
  // tournament.maybeSingle()). Têm precedência sobre os terminais simples.
  singleSeq?: Terminal[]
  maybeSingleSeq?: Terminal[]
  insertError?: unknown
  deleteError?: unknown
  updateError?: unknown
  authError?: unknown
  signIn?: { error?: unknown }
  signUp?: { data?: unknown; error?: unknown }
} = {}) {
  const single = vi.fn()
  if (opts.singleSeq) {
    for (const r of opts.singleSeq) single.mockResolvedValueOnce(r)
  }
  single.mockResolvedValue(opts.single ?? { data: null, error: null })

  const maybeSingle = vi.fn()
  if (opts.maybeSingleSeq) {
    for (const r of opts.maybeSingleSeq) maybeSingle.mockResolvedValueOnce(r)
  }
  maybeSingle.mockResolvedValue(opts.maybeSingle ?? { data: null, error: null })

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    // update().eq() é aguardado directamente em updateTournamentStatus.
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single,
    maybeSingle,
  }

  // `delete()` é encadeado com `.eq()` antes de ser aguardado, por isso eq()
  // tem de continuar a devolver o builder (que é, ele próprio, "aguardável"
  // via o mock de delete acima quando aplicável).
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
        error: opts.authError ?? null,
      }),
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: {}, error: opts.signIn?.error ?? null }),
      signUp: vi.fn().mockResolvedValue({
        data: opts.signUp?.data ?? { user: null, session: null },
        error: opts.signUp?.error ?? null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => builder),
    _builder: builder,
  }
}
