'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { GripVertical, Info, Loader2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { z } from 'zod'

import {
  tournamentSchema,
  tiebreakCriterions,
  tiebreakLabels,
  type TournamentInput,
} from '@/lib/validations/tournament'
import { createTournament, updateTournament } from '@/lib/actions/tournaments'
import { TIERS, TIER_LABELS } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { TierDatePicker } from '@/components/tournament/tier-date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { Control } from 'react-hook-form'

interface TournamentFormProps {
  defaultValues?: Partial<TournamentInput>
  tournamentId?: string
}

// O input do schema tem campos opcionais (têm `.default()`); o output já os
// resolve. RHF usa os dois lados — input nos campos, output no submit.
type FormInput = z.input<typeof tournamentSchema>
type FormOutput = z.output<typeof tournamentSchema>
type FormControl = Control<FormInput, unknown, FormOutput>

const baseDefaults: TournamentInput = {
  name: '',
  description: '',
  visibility: 'public',
  starts_at: '',
  ends_at: '',
  match: {
    half_duration_minutes: 20,
    half_time_duration_minutes: 5,
    extra_time_duration_minutes: 5,
    max_fouls_per_team_per_half: 5,
    penalty_shootout_kicks: 5,
    third_place_match: false,
  },
  scoring: {
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  },
  cards: {
    yellow_cards_for_suspension: 3,
    red_card_suspension_matches: 1,
  },
  tiebreak_order: [...tiebreakCriterions],
  daily_schedule: [],
  multi_tier: false,
  tier_schedule: {},
}

type DayEntry = TournamentInput['daily_schedule'][number]

// Sentinela para "sem hora" no dropdown de fim (Select não aceita valor vazio).
const NO_TIME = '__none__'

// Opções de hora em formato 24h, em incrementos de 15 minutos (00:00–23:45).
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0')
  const m = String((i % 4) * 15).padStart(2, '0')
  return `${h}:${m}`
})

// Enumera os dias (YYYY-MM-DD) entre duas datas, inclusivo. Itera por string
// para evitar que o fuso horário desloque o dia. `end` vazio ⇒ torneio de 1 dia.
function enumerateDays(start: string, end?: string): string[] {
  if (!start) return []
  const last = end && end >= start ? end : start
  const days: string[] = []
  const cursor = new Date(`${start}T12:00:00`)
  const limit = new Date(`${last}T12:00:00`)
  while (cursor <= limit) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// Constrói o horário por dia a partir do intervalo de datas, preservando as
// horas já introduzidas para datas coincidentes.
function buildSchedule(
  start: string,
  end: string | undefined,
  existing: DayEntry[]
): DayEntry[] {
  const byDate = new Map(existing.map((e) => [e.date, e]))
  return enumerateDays(start, end).map(
    (date) => byDate.get(date) ?? { date, start: '', end: '' }
  )
}

// Formata uma data YYYY-MM-DD para pt-PT: "sáb., 4 jul.".
function formatDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

// Campo numérico reutilizável com sufixo e tooltip opcionais.
function NumberField({
  control,
  name,
  label,
  suffix,
  tooltip,
  min,
  max,
}: {
  control: FormControl
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any
  label: string
  suffix?: string
  tooltip?: string
  min?: number
  max?: number
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1.5">
            {label}
            {tooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground">
                    <Info className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            ) : null}
          </FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                className="w-24"
                value={Number.isNaN(field.value) ? '' : field.value}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
              {suffix ? (
                <span className="text-sm text-muted-foreground">{suffix}</span>
              ) : null}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Item arrastável da lista de critérios de desempate.
function SortableCriterion({ id }: { id: string }) {
  const isDraw = id === 'draw'
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDraw })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2',
        isDragging && 'opacity-60',
        isDraw && 'opacity-70'
      )}
    >
      <button
        type="button"
        className={cn(
          'cursor-grab touch-none text-muted-foreground active:cursor-grabbing',
          isDraw && 'cursor-not-allowed opacity-40'
        )}
        aria-label="Reordenar critério"
        disabled={isDraw}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="text-sm">{tiebreakLabels[id] ?? id}</span>
      {isDraw ? (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          Fixo
        </span>
      ) : null}
    </div>
  )
}

export function TournamentForm({
  defaultValues,
  tournamentId,
}: TournamentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: { ...baseDefaults, ...defaultValues },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const tiebreakOrder = form.watch('tiebreak_order')
  const schedule = form.watch('daily_schedule') ?? []
  const multiTier = form.watch('multi_tier') ?? false
  const tierSchedule = form.watch('tier_schedule') ?? {}

  // Valida os campos essenciais e abre o modal de horários, reconstruindo a
  // grelha de dias a partir das datas e preservando horas já introduzidas.
  async function openSchedule() {
    const ok = await form.trigger(['name', 'starts_at', 'ends_at'])
    const startDate = form.getValues('starts_at')
    if (!ok) return
    if (!startDate) {
      form.setError('starts_at', {
        type: 'manual',
        message: 'Define a data de início para configurar os horários.',
      })
      return
    }
    const endDate = form.getValues('ends_at')
    form.setValue('daily_schedule', buildSchedule(startDate, endDate, schedule), {
      shouldDirty: true,
    })
    setScheduleOpen(true)
  }

  function updateDay(index: number, patch: Partial<DayEntry>) {
    const next = schedule.map((d, i) => (i === index ? { ...d, ...patch } : d))
    form.setValue('daily_schedule', next, { shouldDirty: true })
  }

  // Submete só se todos os dias tiverem hora de início. A validação Zod cobre
  // isto, mas damos feedback imediato dentro do modal.
  function confirmSchedule() {
    const missing = schedule.some((d) => !d.start)
    if (missing) {
      toast.error('Define a hora de início de cada dia.')
      return
    }
    setScheduleOpen(false)
    form.handleSubmit(onSubmit)()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tiebreakOrder.indexOf(active.id as never)
    const newIndex = tiebreakOrder.indexOf(over.id as never)
    if (oldIndex === -1 || newIndex === -1) return

    let next = arrayMove(tiebreakOrder, oldIndex, newIndex)
    // 'draw' (sorteio) é sempre o último critério.
    next = [...next.filter((c) => c !== 'draw'), 'draw'] as typeof next
    form.setValue('tiebreak_order', next, { shouldDirty: true })
  }

  function onSubmit(values: FormOutput) {
    startTransition(async () => {
      if (tournamentId) {
        const result = await updateTournament(tournamentId, values)
        if (result.success) {
          toast.success('Torneio actualizado.')
          router.push(`/tournaments/${tournamentId}`)
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await createTournament(values)
        // Em caso de sucesso, a action redireciona e este código não corre.
        if (result && !result.success) {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <TooltipProvider>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void openSchedule()
          }}
          className="space-y-6"
        >
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger
                value="info"
                className="h-auto! whitespace-normal py-1.5 text-xs sm:text-sm"
              >
                Informações
              </TabsTrigger>
              <TabsTrigger
                value="match"
                className="h-auto! whitespace-normal py-1.5 text-xs sm:text-sm"
              >
                Configurações do jogo
              </TabsTrigger>
              <TabsTrigger
                value="scoring"
                className="h-auto! whitespace-normal py-1.5 text-xs sm:text-sm"
              >
                Pontuação e desempate
              </TabsTrigger>
              <TabsTrigger
                value="cards"
                className="h-auto! whitespace-normal py-1.5 text-xs sm:text-sm"
              >
                Regras de cartões
              </TabsTrigger>
            </TabsList>

            {/* Tab 1 — Informações */}
            <TabsContent value="info" className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Torneio de Verão"
                        data-testid="tournament-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Descrição opcional do torneio."
                        data-testid="tournament-description"
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
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibilidade</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">Público</SelectItem>
                        <SelectItem value="private">Privado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Torneios públicos são visíveis na página de resultados ao vivo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de fim</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Multi-escalão */}
              <FormField
                control={form.control}
                name="multi_tier"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Torneio multi-escalão</FormLabel>
                      <FormDescription>
                        Permite equipas de diferentes escalões com dias de jogo
                        separados.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {multiTier ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      Dias de jogo por escalão
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define em que dias cada escalão joga. Podes deixar em
                      branco se ainda não sabes.
                    </p>
                  </div>
                  {TIERS.map((tier) => (
                    <div
                      key={tier}
                      className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3"
                    >
                      <span className="w-24 flex-shrink-0 pt-1.5 text-sm">
                        {TIER_LABELS[tier]}
                      </span>
                      <TierDatePicker
                        value={tierSchedule[tier] ?? []}
                        onChange={(dates) =>
                          form.setValue(
                            'tier_schedule',
                            { ...tierSchedule, [tier]: dates },
                            { shouldDirty: true }
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </TabsContent>

            {/* Tab 2 — Configurações do jogo */}
            <TabsContent value="match" className="space-y-4 pt-2">
              <NumberField
                control={form.control}
                name="match.half_duration_minutes"
                label="Duração de cada parte"
                suffix="minutos"
                min={5}
                max={45}
              />
              <NumberField
                control={form.control}
                name="match.half_time_duration_minutes"
                label="Duração do intervalo"
                suffix="minutos"
                min={1}
                max={20}
              />
              <NumberField
                control={form.control}
                name="match.extra_time_duration_minutes"
                label="Duração do prolongamento"
                suffix="minutos"
                min={1}
                max={20}
              />
              <NumberField
                control={form.control}
                name="match.max_fouls_per_team_per_half"
                label="Máx. faltas por equipa por parte"
                tooltip="Ao atingir este limite, a equipa adversária tem direito a livre directo"
                min={1}
                max={10}
              />
              <NumberField
                control={form.control}
                name="match.penalty_shootout_kicks"
                label="Pontapés de penálti"
                min={3}
                max={10}
              />
              <FormField
                control={form.control}
                name="match.third_place_match"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Jogo de 3.º e 4.º lugar</FormLabel>
                      <FormDescription>
                        Disputa um jogo entre os perdedores das meias-finais
                        para definir o 3.º classificado.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* Tab 3 — Pontuação e desempate */}
            <TabsContent value="scoring" className="space-y-6 pt-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Pontuação</h3>
                <NumberField
                  control={form.control}
                  name="scoring.points_win"
                  label="Pontos por vitória"
                  min={1}
                  max={5}
                />
                <NumberField
                  control={form.control}
                  name="scoring.points_draw"
                  label="Pontos por empate"
                  min={0}
                  max={3}
                />
                <NumberField
                  control={form.control}
                  name="scoring.points_loss"
                  label="Pontos por derrota"
                  min={0}
                  max={2}
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Critérios de desempate</h3>
                  <p className="text-sm text-muted-foreground">
                    Arrasta para definir a ordem. O sorteio é sempre o último critério.
                  </p>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={tiebreakOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {tiebreakOrder.map((criterion) => (
                        <SortableCriterion key={criterion} id={criterion} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </TabsContent>

            {/* Tab 4 — Regras de cartões */}
            <TabsContent value="cards" className="space-y-4 pt-2">
              <NumberField
                control={form.control}
                name="cards.yellow_cards_for_suspension"
                label="Nº de amarelos para suspensão"
                tooltip="Acumulado de cartões amarelos no torneio que resulta em suspensão automática"
                min={1}
                max={10}
              />
              <NumberField
                control={form.control}
                name="cards.red_card_suspension_matches"
                label="Jogos de suspensão por vermelho directo"
                min={1}
                max={5}
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
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
              data-testid="submit-button"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending
                ? 'A guardar...'
                : tournamentId
                  ? 'Guardar alterações'
                  : 'Criar torneio'}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Horário do torneio</DialogTitle>
            <DialogDescription>
              Define a hora de início de cada dia. A hora prevista de fim dos
              jogos é opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {schedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Define as datas de início e fim para configurar os horários.
              </p>
            ) : (
              schedule.map((day, index) => (
                <div
                  key={day.date}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                >
                  <span className="text-sm font-medium capitalize">
                    {formatDayLabel(day.date)}
                  </span>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Início
                    </label>
                    <Select
                      value={day.start || undefined}
                      onValueChange={(value) =>
                        updateDay(index, { start: value })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="--:--" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Fim previsto
                    </label>
                    <Select
                      value={day.end ?? NO_TIME}
                      onValueChange={(value) =>
                        updateDay(index, {
                          end: value === NO_TIME ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="--:--" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TIME}>--:--</SelectItem>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setScheduleOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmSchedule}
              disabled={isPending || schedule.length === 0}
              data-testid="confirm-schedule-button"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {tournamentId ? 'Confirmar e guardar' : 'Confirmar e criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
