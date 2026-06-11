'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  scheduleMatchSchema,
  type ScheduleMatchInput,
} from '@/lib/validations/match'
import { scheduleMatch } from '@/lib/actions/matches'
import type { Match } from '@/types/database'
import type { MatchRefereeLite } from '@/lib/queries/matches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

type SchedulableMatch = Pick<Match, 'id' | 'scheduled_at' | 'venue' | 'referee_id'>

interface ScheduleDialogProps {
  match: SchedulableMatch
  referees: MatchRefereeLite[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NONE = 'none'

// Converte um ISO timestamptz para o formato exigido por <input
// type="datetime-local"> ("YYYY-MM-DDTHH:mm") em hora local.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDefaults(match: SchedulableMatch): ScheduleMatchInput {
  return {
    scheduled_at: toDatetimeLocal(match.scheduled_at),
    venue: match.venue ?? '',
    referee_id: match.referee_id ?? null,
  }
}

export function ScheduleDialog({
  match,
  referees,
  open,
  onOpenChange,
}: ScheduleDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ScheduleMatchInput>({
    resolver: zodResolver(scheduleMatchSchema),
    defaultValues: toDefaults(match),
  })

  useEffect(() => {
    if (open) form.reset(toDefaults(match))
  }, [open, match, form])

  function onSubmit(values: ScheduleMatchInput) {
    startTransition(async () => {
      const result = await scheduleMatch(match.id, values)
      if (result.success) {
        toast.success('Jogo agendado.')
        onOpenChange(false)
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
          <DialogTitle>Agendar jogo</DialogTitle>
          <DialogDescription>
            Define a data, o campo e o árbitro deste jogo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e hora</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      data-testid="schedule-datetime"
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
                      data-testid="schedule-venue"
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
                      <SelectTrigger className="w-full">
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

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="schedule-submit">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? 'A guardar...' : 'Agendar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
