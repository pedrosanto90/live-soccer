'use client'

import { useTransition } from 'react'
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
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="match">Configurações do jogo</TabsTrigger>
              <TabsTrigger value="scoring">Pontuação e desempate</TabsTrigger>
              <TabsTrigger value="cards">Regras de cartões</TabsTrigger>
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

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} data-testid="submit-button">
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
    </TooltipProvider>
  )
}
