'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Shuffle,
  Star,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  RefreshCw,
} from 'lucide-react'

import {
  randomDraw,
  seededDraw,
  generateGroupNames,
  validateDrawRequirements,
  type Team as DrawTeam,
  type DrawGroup,
} from '@/lib/draw'
import { runDraw } from '@/lib/actions/phases'
import type { DrawConfigInput } from '@/lib/validations/phase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DrawPanelProps {
  phaseId: string
  tournamentId: string
  teams: DrawTeam[]
}

type Mode = 'random' | 'seeded'

export function DrawPanel({ phaseId, teams }: DrawPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [mode, setMode] = useState<Mode>('random')
  const [numGroups, setNumGroups] = useState(2)
  const [teamsPerGroup, setTeamsPerGroup] = useState(3)
  const [seeds, setSeeds] = useState<(string | undefined)[]>([])
  const [preview, setPreview] = useState<DrawGroup[] | null>(null)

  const totalTeams = teams.length
  const required = numGroups * teamsPerGroup
  const requirements = useMemo(
    () => validateDrawRequirements(totalTeams, numGroups, teamsPerGroup),
    [totalTeams, numGroups, teamsPerGroup]
  )

  // IDs de cabeças de série já escolhidos (sem buracos).
  const seedIds: string[] = []
  for (const s of seeds) if (typeof s === 'string') seedIds.push(s)

  const seedsComplete =
    mode === 'random' ||
    (seeds.length === numGroups && seeds.every((s) => s != null))

  const canRun = requirements.valid && seedsComplete

  function setSeed(groupIndex: number, teamId: string) {
    setSeeds((prev) => {
      const next = [...prev]
      next.length = numGroups
      next[groupIndex] = teamId
      return next
    })
    setPreview(null)
  }

  // Opções disponíveis para uma posição de cabeça de série (exclui as já
  // escolhidas noutros grupos).
  function seedOptions(groupIndex: number): DrawTeam[] {
    const taken = new Set(seeds.filter((_, i) => i !== groupIndex))
    return teams.filter((t) => !taken.has(t.id))
  }

  function buildPreview(): DrawGroup[] | null {
    const groupNames = generateGroupNames(numGroups)
    try {
      if (mode === 'seeded') {
        const seedTeams = seeds
          .map((id) => teams.find((t) => t.id === id))
          .filter((t): t is DrawTeam => t != null)
        return seededDraw(teams, seedTeams, numGroups, teamsPerGroup, groupNames)
      }
      return randomDraw(teams, numGroups, teamsPerGroup, groupNames)
    } catch {
      return null
    }
  }

  function handlePreview() {
    if (!canRun) return
    const result = buildPreview()
    if (!result) {
      toast.error('Não foi possível pré-visualizar o sorteio.')
      return
    }
    setPreview(result)
  }

  function handleRunDraw() {
    if (!canRun) return
    const config: DrawConfigInput = {
      mode,
      num_groups: numGroups,
      teams_per_group: teamsPerGroup,
      seeds: mode === 'seeded' ? seedIds : undefined,
    }

    startTransition(async () => {
      const result = await runDraw(phaseId, config)
      if (result.success) {
        toast.success(
          `Sorteio efectuado — ${result.data.matches_created} jogo(s) gerado(s).`
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const seedIdsForPreview = new Set(mode === 'seeded' ? seedIds : [])

  return (
    <div className="flex flex-col gap-4 border-t border-border p-4">
      <Section title="Configuração do sorteio">
        <div className="flex flex-col gap-4">
          {/* Modo */}
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={mode === 'random'}
              icon={<Shuffle className="size-4" />}
              label="Aleatório"
              onClick={() => {
                setMode('random')
                setPreview(null)
              }}
            />
            <ModeButton
              active={mode === 'seeded'}
              icon={<Star className="size-4" />}
              label="Cabeças de série"
              onClick={() => {
                setMode('seeded')
                setPreview(null)
              }}
            />
          </div>

          {/* Estrutura */}
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Nº de grupos"
              value={numGroups}
              min={1}
              max={16}
              testid="draw-num-groups"
              onChange={(v) => {
                setNumGroups(v)
                setPreview(null)
              }}
            />
            <NumberField
              label="Equipas por grupo"
              value={teamsPerGroup}
              min={2}
              max={8}
              testid="draw-teams-per-group"
              onChange={(v) => {
                setTeamsPerGroup(v)
                setPreview(null)
              }}
            />
          </div>

          {/* Validação em tempo real */}
          {requirements.valid ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle className="size-3.5" />
              Pronto para sortear — {required} equipas em {numGroups} grupo(s).
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="size-3.5" />
              {requirements.error} (necessárias {required}, disponíveis{' '}
              {totalTeams})
            </p>
          )}

          {/* Cabeças de série */}
          {mode === 'seeded' ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Cabeças de série
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: numGroups }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {generateGroupNames(numGroups)[i]}
                    </span>
                    <Select
                      value={seeds[i] ?? ''}
                      onValueChange={(v) => setSeed(i, v)}
                    >
                      <SelectTrigger
                        className="w-full"
                        data-testid={`draw-seed-${i}`}
                      >
                        <SelectValue placeholder="Escolher equipa" />
                      </SelectTrigger>
                      <SelectContent>
                        {seedOptions(i).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      {/* Pré-visualização */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRun || isPending}
          onClick={handlePreview}
          data-testid="draw-preview"
        >
          <Eye className="size-3.5" />
          Pré-visualizar sorteio
        </Button>
        {preview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canRun || isPending}
            onClick={handlePreview}
          >
            <RefreshCw className="size-3.5" />
            Ressortear
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((group, gi) => (
            <div
              key={gi}
              className="rounded-md border border-border bg-surface-2 p-3"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.name}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2">
                    <span className="text-sm">{team.name}</span>
                    {seedIdsForPreview.has(team.id) ? (
                      <Star className="ml-auto size-3 text-warning" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Footer */}
      <Button
        type="button"
        className="w-full"
        disabled={!canRun || isPending}
        onClick={handleRunDraw}
        data-testid="draw-run"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? 'A sortear...' : 'Executar sorteio'}
      </Button>
    </div>
  )
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border bg-surface-2 hover:bg-muted'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  testid,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  testid: string
  onChange: (value: number) => void
}) {
  // Estado local em string para permitir o campo vazio durante a edição. O
  // clamp ao intervalo [min, max] só acontece no blur — assim dá para apagar e
  // reescrever o número livremente. Quando o valor muda por fora (ex.: clamp
  // noutro campo) ressincroniza o draft durante o render.
  const [draft, setDraft] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(String(value))
  }

  function commit() {
    const n = Number(draft)
    const clamped = Number.isNaN(n) ? value : Math.min(max, Math.max(min, n))
    onChange(clamped)
    setDraft(String(clamped))
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        data-testid={testid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    </label>
  )
}
