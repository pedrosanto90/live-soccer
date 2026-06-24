import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

import type { MatchReportData, ReportPlayer } from '@/lib/queries/match-report'
import type { EventType, MatchEvent, PlayerPosition } from '@/types/database'

// ─── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 35,
    color: '#1a1a1a',
  },

  // Cabeçalho
  header: {
    borderBottom: '2 solid #1a1a1a',
    paddingBottom: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  headerSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  headerMeta: { fontSize: 8, color: '#555', marginTop: 2 },

  // Resultado
  resultSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
    padding: 10,
    border: '1 solid #ddd',
    borderRadius: 4,
    backgroundColor: '#f9f9f9',
  },
  teamName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'center',
  },
  score: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    marginHorizontal: 16,
    minWidth: 60,
    textAlign: 'center',
  },
  scoreExtra: { fontSize: 8, color: '#555', textAlign: 'center', marginTop: 2 },

  // Tabelas
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 10,
    paddingBottom: 3,
    borderBottom: '1 solid #ccc',
  },
  table: { width: '100%' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottom: '0.5 solid #eee',
  },
  tableRowAlt: { backgroundColor: '#f5f5f5' },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableCell: { fontSize: 8 },

  // Larguras de colunas — tabela de jogadores
  colNumber: { width: '8%' },
  colName: { width: '42%' },
  colPos: { width: '12%' },
  colGoals: { width: '10%', textAlign: 'center' },
  colFouls: { width: '10%', textAlign: 'center' },
  colCards: { width: '18%', textAlign: 'center' },

  // Larguras de colunas — tabela de eventos
  colTime: { width: '12%' },
  colEventType: { width: '22%' },
  colTeam: { width: '28%' },
  colPlayer: { width: '38%' },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 35,
    right: 35,
    borderTop: '1 solid #ccc',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: { fontSize: 7, color: '#888' },
  signatureLine: {
    borderTop: '1 solid #1a1a1a',
    marginTop: 16,
    paddingTop: 3,
    width: 200,
    textAlign: 'center',
  },
})

// ─── Funções auxiliares ────────────────────────────────────────────────────

function formatTime(elapsedSecs: number): string {
  const min = Math.ceil(elapsedSecs / 60)
  return `${min}'`
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

const EVENT_LABELS: Record<EventType, string> = {
  goal: 'Golo',
  own_goal: 'Golo Contra',
  foul: 'Falta',
  yellow_card: 'Cartão Amarelo',
  red_card: 'Cartão Vermelho',
  penalty_scored: 'Penálti (Marcado)',
  penalty_missed: 'Penálti (Falhado)',
}

function getEventLabel(type: EventType): string {
  return EVENT_LABELS[type] ?? type
}

const POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: 'GR',
  defender: 'DEF',
  midfielder: 'MED',
  forward: 'AV',
}

function getPositionLabel(pos: PlayerPosition | null): string {
  return pos ? (POSITION_LABELS[pos] ?? pos) : '—'
}

// ─── Componentes auxiliares ────────────────────────────────────────────────

function formatCards(yellows: number, reds: number): string {
  if (yellows === 0 && reds === 0) return '—'
  return [yellows > 0 ? `${yellows}A` : '', reds > 0 ? `${reds}V` : '']
    .filter(Boolean)
    .join(' ')
}

function PlayerTable({
  teamName,
  teamId,
  teamGoals,
  players,
  events,
  foulsH1,
  foulsH2,
}: {
  teamName: string
  teamId: string
  teamGoals: number
  players: ReportPlayer[]
  events: MatchEvent[]
  foulsH1: number
  foulsH2: number
}) {
  // Calcular stats por jogador a partir dos eventos
  const playerStats = players.map((player) => {
    const playerEvents = events.filter((e) => e.player_id === player.id)
    const goals = playerEvents.filter((e) => e.event_type === 'goal').length
    const ownGoals = playerEvents.filter((e) => e.event_type === 'own_goal').length
    const fouls = playerEvents.filter((e) => e.event_type === 'foul').length
    const yellows = playerEvents.filter((e) => e.event_type === 'yellow_card').length
    const reds = playerEvents.filter((e) => e.event_type === 'red_card').length
    return { ...player, goals: goals + ownGoals, fouls, yellows, reds }
  })

  // Totais da equipa a partir dos eventos. Os jogos podem ser registados ao nível
  // da equipa (sem jogador associado), por isso os totais vêm sempre dos eventos
  // do jogo e não da soma das linhas de jogadores.
  const teamEvents = events.filter((e) => e.team_id === teamId)
  const totalFouls = foulsH1 + foulsH2
  const totalYellows = teamEvents.filter((e) => e.event_type === 'yellow_card').length
  const totalReds = teamEvents.filter((e) => e.event_type === 'red_card').length

  return (
    <View>
      <Text style={styles.sectionTitle}>{teamName}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colNumber]}>N.º</Text>
          <Text style={[styles.tableHeaderText, styles.colName]}>Nome</Text>
          <Text style={[styles.tableHeaderText, styles.colPos]}>Pos.</Text>
          <Text style={[styles.tableHeaderText, styles.colGoals]}>Golos</Text>
          <Text style={[styles.tableHeaderText, styles.colFouls]}>Faltas</Text>
          <Text style={[styles.tableHeaderText, styles.colCards]}>Cartões</Text>
        </View>
        {playerStats.length > 0 ? (
          playerStats.map((player, i) => (
            <View
              key={player.id}
              style={[styles.tableRow, ...(i % 2 === 1 ? [styles.tableRowAlt] : [])]}
            >
              <Text style={[styles.tableCell, styles.colNumber]}>
                {player.number ?? '—'}
              </Text>
              <Text style={[styles.tableCell, styles.colName]}>{player.name}</Text>
              <Text style={[styles.tableCell, styles.colPos]}>
                {getPositionLabel(player.position)}
              </Text>
              <Text style={[styles.tableCell, styles.colGoals]}>
                {player.goals || '—'}
              </Text>
              <Text style={[styles.tableCell, styles.colFouls]}>
                {player.fouls || '—'}
              </Text>
              <Text style={[styles.tableCell, styles.colCards]}>
                {formatCards(player.yellows, player.reds)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1, color: '#888' }]}>
              Sem jogadores registados — eventos registados ao nível da equipa.
            </Text>
          </View>
        )}
        {/* Totais da equipa (sempre a partir dos eventos do jogo) */}
        <View style={[styles.tableRow, { backgroundColor: '#f0f0f0' }]}>
          <Text style={[styles.tableCell, styles.colNumber]} />
          <Text
            style={[styles.tableCell, styles.colName, { fontFamily: 'Helvetica-Bold' }]}
          >
            Totais da equipa
          </Text>
          <Text style={[styles.tableCell, styles.colPos]} />
          <Text
            style={[styles.tableCell, styles.colGoals, { fontFamily: 'Helvetica-Bold' }]}
          >
            {teamGoals}
          </Text>
          <Text
            style={[styles.tableCell, styles.colFouls, { fontFamily: 'Helvetica-Bold' }]}
          >
            {totalFouls}
          </Text>
          <Text
            style={[styles.tableCell, styles.colCards, { fontFamily: 'Helvetica-Bold' }]}
          >
            {formatCards(totalYellows, totalReds)}
          </Text>
        </View>
        <View style={[styles.tableRow, { backgroundColor: '#f0f0f0', paddingTop: 0 }]}>
          <Text style={[styles.tableCell, { flex: 1, color: '#555' }]}>
            Faltas — 1.ª parte: {foulsH1} · 2.ª parte: {foulsH2}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────

export function MatchReportDocument({ data }: { data: MatchReportData }) {
  const {
    match,
    tournament,
    phase,
    group,
    homeTeam,
    awayTeam,
    referee,
    homePlayers,
    awayPlayers,
    events,
    penalties,
  } = data

  const hasExtra = match.home_score_extra > 0 || match.away_score_extra > 0
  const hasPenalties = match.home_penalties > 0 || match.away_penalties > 0
  const generatedAt = formatDateTime(new Date().toISOString())

  return (
    <Document
      title={`Ficha de Jogo — ${homeTeam.name} vs ${awayTeam.name}`}
      author="Futsal Manager"
      subject="Ficha de Jogo Futsal"
      creator="Futsal Manager"
    >
      <Page size="A4" style={styles.page}>
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{tournament.name}</Text>
          <Text style={styles.headerSubtitle}>FICHA DE JOGO — FUTSAL</Text>
          <Text style={styles.headerMeta}>
            {phase.name}
            {group ? ` · ${group.name}` : ''}
          </Text>
          {match.scheduled_at && (
            <Text style={styles.headerMeta}>
              Data: {formatDateTime(match.scheduled_at)}
            </Text>
          )}
          {match.venue && <Text style={styles.headerMeta}>Local: {match.venue}</Text>}
          {referee && <Text style={styles.headerMeta}>Árbitro: {referee.name}</Text>}
        </View>

        {/* RESULTADO */}
        <View style={styles.resultSection}>
          <Text style={styles.teamName}>{homeTeam.name}</Text>
          <View>
            <Text style={styles.score}>
              {match.home_score} — {match.away_score}
            </Text>
            {hasExtra && (
              <Text style={styles.scoreExtra}>
                Prolong.: {match.home_score_extra} — {match.away_score_extra}
              </Text>
            )}
            {hasPenalties && (
              <Text style={styles.scoreExtra}>
                Penáltis: {match.home_penalties} — {match.away_penalties}
              </Text>
            )}
          </View>
          <Text style={styles.teamName}>{awayTeam.name}</Text>
        </View>

        {/* TABELAS DE JOGADORES */}
        <PlayerTable
          teamName={`EQUIPA DA CASA — ${homeTeam.name}`}
          teamId={homeTeam.id}
          teamGoals={match.home_score}
          players={homePlayers}
          events={events}
          foulsH1={match.home_fouls_h1}
          foulsH2={match.home_fouls_h2}
        />

        <PlayerTable
          teamName={`EQUIPA DE FORA — ${awayTeam.name}`}
          teamId={awayTeam.id}
          teamGoals={match.away_score}
          players={awayPlayers}
          events={events}
          foulsH1={match.away_fouls_h1}
          foulsH2={match.away_fouls_h2}
        />

        {/* REGISTO DE EVENTOS */}
        {events.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>REGISTO DE EVENTOS</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colTime]}>Tempo</Text>
                <Text style={[styles.tableHeaderText, styles.colEventType]}>Tipo</Text>
                <Text style={[styles.tableHeaderText, styles.colTeam]}>Equipa</Text>
                <Text style={[styles.tableHeaderText, styles.colPlayer]}>Jogador</Text>
              </View>
              {events.map((event, i) => {
                const team = event.team_id === homeTeam.id ? homeTeam : awayTeam
                return (
                  <View
                    key={event.id}
                    style={[
                      styles.tableRow,
                      ...(i % 2 === 1 ? [styles.tableRowAlt] : []),
                    ]}
                  >
                    <Text style={[styles.tableCell, styles.colTime]}>
                      {formatTime(event.elapsed_secs)}
                    </Text>
                    <Text style={[styles.tableCell, styles.colEventType]}>
                      {getEventLabel(event.event_type)}
                    </Text>
                    <Text style={[styles.tableCell, styles.colTeam]}>{team.name}</Text>
                    <Text style={[styles.tableCell, styles.colPlayer]}>
                      {event.player_name ?? '—'}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* SÉRIE DE PENÁLTIS */}
        {penalties.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>SÉRIE DE PENÁLTIS</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '10%' }]}>N.º</Text>
                <Text style={[styles.tableHeaderText, { width: '35%' }]}>Equipa</Text>
                <Text style={[styles.tableHeaderText, { width: '40%' }]}>Jogador</Text>
                <Text style={[styles.tableHeaderText, { width: '15%' }]}>Result.</Text>
              </View>
              {penalties.map((kick, i) => {
                const team = kick.team_id === homeTeam.id ? homeTeam : awayTeam
                return (
                  <View
                    key={kick.id}
                    style={[
                      styles.tableRow,
                      ...(i % 2 === 1 ? [styles.tableRowAlt] : []),
                    ]}
                  >
                    <Text style={[styles.tableCell, { width: '10%' }]}>
                      {kick.kick_order}
                    </Text>
                    <Text style={[styles.tableCell, { width: '35%' }]}>{team.name}</Text>
                    <Text style={[styles.tableCell, { width: '40%' }]}>
                      {kick.player_name ?? '—'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>
                      {kick.scored ? 'Marcou' : 'Falhou'}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* RODAPÉ */}
        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerText}>Documento gerado por Futsal Manager</Text>
            <Text style={styles.footerText}>Gerado em: {generatedAt}</Text>
          </View>
          <View style={styles.signatureLine}>
            <Text style={{ fontSize: 8 }}>Assinatura do Árbitro</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
