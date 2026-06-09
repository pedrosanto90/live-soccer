import Link from 'next/link'
import { Trophy } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-surface-2 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Trophy className="size-4" />
        </span>
        <span className="text-lg font-medium tracking-tight">Live Soccer</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
