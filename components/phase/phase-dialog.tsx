'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Grid3x3, GitMerge } from 'lucide-react'
import type { z } from 'zod'

import {
  phaseSchema,
  phaseTypeLabels,
  type PhaseInput,
} from '@/lib/validations/phase'
import { createPhase, updatePhase } from '@/lib/actions/phases'
import { cn } from '@/lib/utils'
import type { PhaseType, TournamentPhase } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type EditablePhase = Pick<TournamentPhase, 'id' | 'name' | 'type'>

interface PhaseDialogProps {
  tournamentId: string
  phase?: EditablePhase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type FormInput = z.input<typeof phaseSchema>
type FormOutput = z.output<typeof phaseSchema>

const typeOptions: { value: PhaseType; icon: typeof Grid3x3 }[] = [
  { value: 'group', icon: Grid3x3 },
  { value: 'knockout', icon: GitMerge },
]

function toDefaults(phase?: EditablePhase | null): PhaseInput {
  return {
    name: phase?.name ?? phaseTypeLabels.group,
    type: phase?.type ?? 'group',
    order_index: 0,
  }
}

export function PhaseDialog({
  tournamentId,
  phase,
  open,
  onOpenChange,
  onSuccess,
}: PhaseDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(phaseSchema),
    defaultValues: toDefaults(phase),
  })

  useEffect(() => {
    if (open) form.reset(toDefaults(phase))
  }, [open, phase, form])

  const type = form.watch('type')

  // Sugere o nome ao trocar de tipo, desde que o nome ainda seja uma sugestão
  // (não foi personalizado pelo utilizador).
  function selectType(next: PhaseType) {
    const currentName = form.getValues('name')
    const isSuggested = Object.values(phaseTypeLabels).includes(currentName)
    form.setValue('type', next, { shouldDirty: true })
    if (!currentName || isSuggested) {
      form.setValue('name', phaseTypeLabels[next], { shouldDirty: true })
    }
  }

  function onSubmit(values: FormOutput) {
    startTransition(async () => {
      const result = phase
        ? await updatePhase(phase.id, values)
        : await createPhase(tournamentId, values)

      if (result.success) {
        toast.success(phase ? 'Fase actualizada.' : 'Fase criada.')
        onOpenChange(false)
        onSuccess?.()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase ? 'Editar fase' : 'Adicionar fase'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={() => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {typeOptions.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        data-testid={`phase-type-${value}`}
                        onClick={() => selectType(value)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                          type === value
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border bg-surface-2 hover:bg-muted'
                        )}
                      >
                        <Icon className="size-4" />
                        <span>{phaseTypeLabels[value]}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Fase de Grupos"
                      data-testid="phase-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="phase-submit">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? 'A guardar...' : phase ? 'Guardar' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
