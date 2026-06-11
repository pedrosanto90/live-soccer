'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Copy, Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TournamentShareProps {
  slug: string
}

// Botão "Partilhar" que abre um diálogo com o QR code e o link público do
// torneio. Pensado para o overview de admin.
export function TournamentShare({ slug }: TournamentShareProps) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicUrl = `${base}/t/${slug}`

  function handleCopy() {
    void navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado')
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="size-4" />
          Partilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Partilhar torneio</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com este link pode acompanhar os resultados e a
            classificação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 p-4">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={publicUrl} size={160} />
          </div>

          <div className="flex w-full max-w-xs items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
            <p className="flex-1 truncate text-xs text-muted-foreground">
              {publicUrl}
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              onClick={handleCopy}
              aria-label="Copiar link"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
