// Separador visual de escalão para os ecrãs (classificação, bracket, jogos)
// que mostram todos os escalões numa só página vertical, sem tabs.
export function TierSeparator({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <h2 className="px-3 text-lg font-medium">{label}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
