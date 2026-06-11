import { cn } from '@/lib/utils'
import type { MatchTeamLite } from '@/lib/queries/matches'

interface TeamAvatarProps {
  team: MatchTeamLite
  // Sobrepõe o tamanho/tipografia (ex.: 'size-14 text-lg' no marcador grande).
  className?: string
}

// Distintivo da equipa com as suas cores e iniciais — usado nas listagens e
// no marcador. O tamanho por defeito é pequeno; passa `className` para crescer.
export function TeamAvatar({ team, className }: TeamAvatarProps) {
  const initials = team.short_name ?? team.name.slice(0, 2).toUpperCase()
  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border text-[10px] font-medium',
        className
      )}
      style={{ background: team.color_primary, color: team.color_secondary }}
    >
      {initials}
    </div>
  )
}
