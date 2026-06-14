// Layout base para páginas públicas. Sem chrome — apenas o fundo da página.
// O header fica no route group (chrome); páginas full-bleed (ex. painel da TV)
// ficam directamente sob (public) e não o herdam.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-svh bg-background">{children}</div>
}
