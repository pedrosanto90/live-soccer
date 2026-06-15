'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Info, Loader2 } from 'lucide-react'
import type { z } from 'zod'
import type { Control } from 'react-hook-form'

import { teamSchema, type TeamInput } from '@/lib/validations/team'
import { createTeam, updateTeam } from '@/lib/actions/teams'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface TeamFormProps {
  tournamentId: string
  defaultValues?: Partial<TeamInput>
  teamId?: string
}

type FormInput = z.input<typeof teamSchema>
type FormOutput = z.output<typeof teamSchema>
type FormControlType = Control<FormInput, unknown, FormOutput>

const baseDefaults: TeamInput = {
  name: '',
  short_name: '',
  color_primary: '#000000',
  color_secondary: '#ffffff',
}

// Campo de cor (<input type="color">) ligado ao react-hook-form.
function ColorField({
  control,
  name,
  label,
}: {
  control: FormControlType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any
  label: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-8 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                value={field.value ?? '#000000'}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
              <span className="text-sm text-muted-foreground uppercase">
                {field.value}
              </span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function TeamForm({ tournamentId, defaultValues, teamId }: TeamFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(teamSchema),
    defaultValues: { ...baseDefaults, ...defaultValues },
  })

  const watchName = form.watch('name')
  const watchShortName = form.watch('short_name')
  const watchColorPrimary = form.watch('color_primary')
  const watchColorSecondary = form.watch('color_secondary')

  function onSubmit(values: FormOutput) {
    startTransition(async () => {
      if (teamId) {
        const result = await updateTeam(teamId, values)
        if (result.success) {
          toast.success('Equipa actualizada.')
          router.push(`/tournaments/${tournamentId}/teams`)
          router.refresh()
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await createTeam(tournamentId, values)
        if (result.success) {
          toast.success('Equipa adicionada.')
          router.push(`/tournaments/${tournamentId}/teams`)
          router.refresh()
        } else {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex.: Sporting CP"
                    data-testid="team-name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="short_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  Abreviatura
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground">
                        <Info className="size-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Usada no marcador e tabelas (ex: SCP, SLB)
                    </TooltipContent>
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    maxLength={5}
                    placeholder="SCP"
                    data-testid="team-short-name"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              control={form.control}
              name="color_primary"
              label="Cor principal (equipamento)"
            />
            <ColorField
              control={form.control}
              name="color_secondary"
              label="Cor secundária"
            />
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
            <div
              className="flex size-8 items-center justify-center rounded-md text-xs font-medium"
              style={{ background: watchColorPrimary, color: watchColorSecondary }}
            >
              {watchShortName || watchName?.slice(0, 2).toUpperCase() || 'EQ'}
            </div>
            <span className="text-sm">{watchName || 'Nome da equipa'}</span>
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
              data-testid="submit-button"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending
                ? 'A guardar...'
                : teamId
                  ? 'Guardar alterações'
                  : 'Adicionar equipa'}
            </Button>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  )
}
