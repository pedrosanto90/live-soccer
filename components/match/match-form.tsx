'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'

import { matchSchema, type MatchInput } from '@/lib/validations/match'
import { createMatch, updateMatch } from '@/lib/actions/matches'
import type { PhaseType } from '@/types/database'
import type { MatchRefereeLite } from '@/lib/queries/matches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Section } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

export interface MatchFormPhase {
  id: string
  name: string
  type: PhaseType
  groups: { id: string; name: string }[]
}

export interface MatchFormTeam {
  id: string
  name: string
}

interface MatchFormProps {
  tournamentId: string
  phases: MatchFormPhase[]
  teams: MatchFormTeam[]
  referees: MatchRefereeLite[]
  defaultValues?: Partial<MatchInput>
  matchId?: string
}

const NONE = 'none'

// Converte um ISO timestamptz para o formato de <input type="datetime-local">.
function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function MatchForm({
  tournamentId,
  phases,
  teams,
  referees,
  defaultValues,
  matchId,
}: MatchFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Override de configurações — gerido fora do RHF e injectado no submit.
  const overrideMatch = defaultValues?.settings_override?.match
  const [useTournamentSettings, setUseTournamentSettings] = useState(
    !overrideMatch
  )
  const [showSettings, setShowSettings] = useState(false)
  const [halfDuration, setHalfDuration] = useState(
    overrideMatch?.half_duration_minutes ?? 20
  )
  const [maxFouls, setMaxFouls] = useState(
    overrideMatch?.max_fouls_per_team_per_half ?? 5
  )

  const form = useForm<MatchInput>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      phase_id: defaultValues?.phase_id ?? '',
      group_id: defaultValues?.group_id ?? null,
      home_team_id: defaultValues?.home_team_id ?? '',
      away_team_id: defaultValues?.away_team_id ?? '',
      referee_id: defaultValues?.referee_id ?? null,
      venue: defaultValues?.venue ?? '',
      scheduled_at: toDatetimeLocal(defaultValues?.scheduled_at),
    },
  })

  const selectedPhaseId = form.watch('phase_id')
  const homeTeamId = form.watch('home_team_id')
  const awayTeamId = form.watch('away_team_id')

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId)
  const showGroup = selectedPhase?.type === 'group' && selectedPhase.groups.length > 0

  function onSubmit(values: MatchInput) {
    const payload: MatchInput = {
      ...values,
      group_id: showGroup ? values.group_id || null : null,
      settings_override: useTournamentSettings
        ? null
        : {
            match: {
              half_duration_minutes: halfDuration,
              max_fouls_per_team_per_half: maxFouls,
            },
          },
    }

    startTransition(async () => {
      const result = matchId
        ? await updateMatch(matchId, payload)
        : await createMatch(tournamentId, payload)

      if (result.success) {
        toast.success(matchId ? 'Jogo actualizado.' : 'Jogo criado.')
        router.push(`/tournaments/${tournamentId}/matches`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Jogo">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="phase_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => {
                      field.onChange(v)
                      // Ao mudar de fase, o grupo deixa de ser válido.
                      form.setValue('group_id', null)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="match-phase">
                        <SelectValue placeholder="Escolhe a fase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showGroup ? (
              <FormField
                control={form.control}
                name="group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="match-group">
                          <SelectValue placeholder="Sem grupo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem grupo</SelectItem>
                        {selectedPhase?.groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="home_team_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipa da casa</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="match-home-team">
                          <SelectValue placeholder="Escolhe a equipa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams
                          .filter((t) => t.id !== awayTeamId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="away_team_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipa de fora</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="match-away-team">
                          <SelectValue placeholder="Escolhe a equipa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams
                          .filter((t) => t.id !== homeTeamId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Section>

        <Section title="Agendamento" description="Opcional — podes agendar mais tarde.">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e hora</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      data-testid="match-datetime"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Pavilhão Municipal"
                      data-testid="match-venue"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Árbitro</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="match-referee">
                        <SelectValue placeholder="Sem árbitro" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem árbitro</SelectItem>
                      {referees.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            Configurações
            <ChevronDown
              className={`size-4 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            />
          </button>

          {showSettings ? (
            <div className="space-y-4 border-t border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Usar configurações do torneio</p>
                  <p className="text-xs text-muted-foreground">
                    As restantes configurações são herdadas do torneio.
                  </p>
                </div>
                <Switch
                  checked={useTournamentSettings}
                  onCheckedChange={setUseTournamentSettings}
                  data-testid="match-use-tournament-settings"
                />
              </div>

              {!useTournamentSettings ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Duração de cada parte (min)
                    </label>
                    <Input
                      type="number"
                      min={5}
                      max={45}
                      value={halfDuration}
                      onChange={(e) => setHalfDuration(e.target.valueAsNumber || 0)}
                      data-testid="match-half-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Máx. faltas por equipa / parte
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxFouls}
                      onChange={(e) => setMaxFouls(e.target.valueAsNumber || 0)}
                      data-testid="match-max-fouls"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isPending}
            data-testid="match-submit"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? 'A guardar...' : matchId ? 'Guardar alterações' : 'Criar jogo'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
