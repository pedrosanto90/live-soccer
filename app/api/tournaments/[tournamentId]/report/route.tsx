import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'

import { createClient } from '@/lib/supabase/server'
import { TournamentReportDocument } from '@/components/pdf/tournament-report-document'
import { getTournamentReportData } from '@/lib/queries/tournament-report'

// `@react-pdf/renderer` corre apenas em Node.js (não em edge).
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params
  const supabase = await createClient()

  // Verificar autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Verificar acesso ao torneio
  const { data: member } = await supabase
    .from('tournament_members')
    .select('role')
    .eq('tournament_id', tournamentId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Carregar dados do torneio
  const data = await getTournamentReportData(tournamentId)
  if (!data) {
    return NextResponse.json({ error: 'Torneio não encontrado' }, { status: 404 })
  }

  // Verificar que o torneio está terminado
  if (data.tournament.status !== 'finished') {
    return NextResponse.json(
      { error: 'A ficha só está disponível após o fim do torneio' },
      { status: 400 }
    )
  }

  // Gerar PDF
  const pdfBuffer = await renderToBuffer(<TournamentReportDocument data={data} />)

  // Nome do ficheiro: ficha-torneio-[nome].pdf
  const slug = data.tournament.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const filename = `ficha-torneio-${slug}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
