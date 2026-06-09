// Layout para páginas públicas (resultados ao vivo, página do torneio).
// Sem a navbar de administração — o conteúdo controla o seu próprio shell.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-svh bg-background">{children}</div>
}
