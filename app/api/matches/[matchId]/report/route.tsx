import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'

import { createClient } from '@/lib/supabase/server'
import { MatchReportDocument } from '@/components/pdf/match-report-document'
import { getMatchReportData } from '@/lib/queries/match-report'

// `@react-pdf/renderer` corre apenas em Node.js (não em edge).
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  const supabase = await createClient()

  // Verificar autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Carregar dados do jogo
  const data = await getMatchReportData(matchId)
  if (!data) {
    return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  }

  // Verificar que o jogo está terminado
  if (data.match.status !== 'finished') {
    return NextResponse.json(
      { error: 'A ficha só está disponível após o fim do jogo' },
      { status: 400 }
    )
  }

  // Verificar acesso ao torneio
  const { data: member } = await supabase
    .from('tournament_members')
    .select('role')
    .eq('tournament_id', data.match.tournament_id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Gerar PDF
  const pdfBuffer = await renderToBuffer(<MatchReportDocument data={data} />)

  // Nome do ficheiro: ficha-jogo-[equipa-casa]-vs-[equipa-fora]-[data].pdf
  const slug = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `ficha-jogo-${slug(data.homeTeam.name)}-vs-${slug(
    data.awayTeam.name
  )}-${dateStr}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
