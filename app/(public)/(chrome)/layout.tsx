import Link from 'next/link'
import { Trophy } from 'lucide-react'

// Layout para páginas públicas com chrome — barra fina com link para a home.
// As páginas que precisam do header vivem neste route group; as full-bleed
// (ex. painel ao vivo para TV) ficam fora dele.
export default function PublicChromeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="size-3.5" />
            </span>
            Live Soccer
          </Link>
        </div>
      </div>
      {children}
    </>
  )
}
