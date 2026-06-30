'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TierDatePickerProps {
  value: string[]
  onChange: (dates: string[]) => void
}

// Formata uma data YYYY-MM-DD para pt-PT: "sáb., 14 jun.".
function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

// Selecciona múltiplas datas para um escalão. As datas escolhidas aparecem como
// badges removíveis, sempre ordenadas cronologicamente e sem duplicados.
export function TierDatePicker({ value, onChange }: TierDatePickerProps) {
  const [draft, setDraft] = useState('')

  function add() {
    if (!draft || value.includes(draft)) {
      setDraft('')
      return
    }
    onChange([...value, draft].sort())
    setDraft('')
  }

  function remove(date: string) {
    onChange(value.filter((d) => d !== date))
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-40"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Adicionar
        </Button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((date) => (
            <Badge key={date} variant="secondary" className="capitalize">
              {formatDate(date)}
              <button
                type="button"
                onClick={() => remove(date)}
                aria-label={`Remover ${date}`}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
