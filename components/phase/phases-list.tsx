'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, LayoutList } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { reorderPhases } from '@/lib/actions/phases'
import type { PhaseWithGroups } from '@/lib/queries/phases'
import type { Team as DrawTeam } from '@/lib/draw'
import type { Tier } from '@/lib/tiers'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { PhaseCard } from '@/components/phase/phase-card'
import { PhaseDialog } from '@/components/phase/phase-dialog'

interface PhasesListProps {
  tournamentId: string
  phases: PhaseWithGroups[]
  teams: (DrawTeam & { tier: Tier })[]
  isAdmin: boolean
  canManage: boolean
  multiTier?: boolean
}

export function PhasesList({
  tournamentId,
  phases,
  teams,
  isAdmin,
  canManage,
  multiTier = false,
}: PhasesListProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [items, setItems] = useState(phases)

  // Sincroniza com os dados do servidor após cada refresh, ajustando o estado
  // durante o render (padrão recomendado em vez de um efeito).
  const [prevPhases, setPrevPhases] = useState(phases)
  if (phases !== prevPhases) {
    setPrevPhases(phases)
    setItems(phases)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((p) => p.id === active.id)
    const newIndex = items.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)

    reorderPhases(
      tournamentId,
      next.map((p) => p.id)
    ).then((result) => {
      if (!result.success) {
        toast.error(result.error)
        setItems(items) // reverte
        router.refresh()
      }
    })
  }

  const addButton =
    isAdmin && canManage ? (
      <Button onClick={() => setCreateOpen(true)} data-testid="add-phase">
        <Plus className="size-4" />
        Adicionar fase
      </Button>
    ) : null

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fases"
        description="Define a estrutura competitiva do torneio."
      >
        {addButton}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={<LayoutList />}
          title="Ainda não há fases"
          description="Adiciona uma fase de grupos ou eliminatórias para começar."
          action={addButton ?? undefined}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {items.map((phase) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  tournamentId={tournamentId}
                  isAdmin={isAdmin}
                  teams={teams}
                  multiTier={multiTier}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PhaseDialog
        tournamentId={tournamentId}
        multiTier={multiTier}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
