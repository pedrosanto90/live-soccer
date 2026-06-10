'use client'

import { useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { z } from 'zod'

import {
  playerSchema,
  positionLabels,
  type PlayerInput,
} from '@/lib/validations/team'
import { createPlayer, updatePlayer } from '@/lib/actions/teams'
import type { Player } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
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

// O dialog só precisa do subconjunto de campos editáveis (mais o id, para a
// edição) — o mesmo que a query getTeamById devolve para cada jogador.
export type EditablePlayer = Pick<
  Player,
  'id' | 'name' | 'number' | 'position' | 'is_active'
>

interface PlayerDialogProps {
  teamId: string
  player?: EditablePlayer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormInput = z.input<typeof playerSchema>
type FormOutput = z.output<typeof playerSchema>

const NONE = 'none'

function toDefaults(player?: EditablePlayer | null): PlayerInput {
  return {
    name: player?.name ?? '',
    number: player?.number ?? null,
    position: player?.position ?? null,
    is_active: player?.is_active ?? true,
  }
}

export function PlayerDialog({
  teamId,
  player,
  open,
  onOpenChange,
  onSuccess,
}: PlayerDialogProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(playerSchema),
    defaultValues: toDefaults(player),
  })

  // Repõe os valores sempre que o dialog abre (novo jogador vs. edição).
  useEffect(() => {
    if (open) form.reset(toDefaults(player))
  }, [open, player, form])

  function onSubmit(values: FormOutput) {
    startTransition(async () => {
      const result = player
        ? await updatePlayer(player.id, values)
        : await createPlayer(teamId, values)

      if (result.success) {
        toast.success(player ? 'Jogador actualizado.' : 'Jogador adicionado.')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {player ? 'Editar jogador' : 'Adicionar jogador'}
          </DialogTitle>
        </DialogHeader>

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
                      placeholder="Ex.: João Silva"
                      data-testid="player-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      placeholder="—"
                      data-testid="player-number"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : e.target.valueAsNumber
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posição</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sem posição" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem posição</SelectItem>
                      {Object.entries(positionLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel>Activo</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
              <Button type="submit" disabled={isPending} data-testid="player-submit">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? 'A guardar...' : player ? 'Guardar' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
