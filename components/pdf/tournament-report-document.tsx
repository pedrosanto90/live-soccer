import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

import type {
  TournamentReportData,
  FinalStanding,
  MatchResult,
} from '@/lib/queries/tournament-report'
import type { StandingRow } from '@/lib/standings'

// ─── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 35,
    color: '#1a1a1a',
  },

  // Capa
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#444',
    marginBottom: 20,
  },
  coverMeta: {
    fontSize: 10,
    textAlign: 'center',
    color: '#555',
    marginTop: 4,
  },
  coverDivider: {
    width: 60,
    height: 2,
    backgroundColor: '#1a1a1a',
    marginVertical: 16,
  },
  coverOrganizer: {
    fontSize: 9,
    textAlign: 'center',
    color: '#777',
    marginTop: 4,
  },

  // Secções
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 14,
    paddingBottom: 4,
    borderBottom: '2 solid #1a1a1a',
  },
  subsectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 10,
    color: '#333',
  },

  // Tabelas
  table: { width: '100%', marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
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

  // Colunas da classificação
  colPos: { width: '6%', textAlign: 'center' },
  colTeamWide: { width: '34%' },
  colStat: { width: '8%', textAlign: 'center' },
  colPts: { width: '8%', textAlign: 'center', fontFamily: 'Helvetica-Bold' },

  // Resultados dos jogos
  matchResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottom: '0.5 solid #eee',
  },
  matchTeam: { fontSize: 8, flex: 1 },
  matchTeamAway: { fontSize: 8, flex: 1, textAlign: 'right' },
  matchScore: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    minWidth: 40,
    textAlign: 'center',
  },
  matchDate: { fontSize: 7, color: '#888', width: 55 },
  matchExtra: { fontSize: 7, color: '#666', textAlign: 'center' },

  // Pódio
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 16,
  },
  podiumItem: {
    alignItems: 'center',
    padding: 10,
    border: '1 solid #ddd',
    borderRadius: 4,
    minWidth: 120,
  },
  podiumPosition: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  podiumTeam: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  podiumLabel: {
    fontSize: 7,
    color: '#888',
    marginTop: 2,
  },

  // Stats colectivas
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  statBox: {
    width: '30%',
    padding: 8,
    border: '1 solid #ddd',
    borderRadius: 4,
    backgroundColor: '#f9f9f9',
  },
  statBoxValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 7,
    color: '#666',
  },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 35,
    right: 35,
    borderTop: '0.5 solid #ccc',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#aaa' },

  // Linha de assinatura
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureLine: {
    alignItems: 'center',
    width: 180,
  },
  signatureBar: {
    width: '100%',
    height: 1,
    backgroundColor: '#1a1a1a',
    marginBottom: 4,
  },
  signatureLabel: { fontSize: 8, color: '#555' },
})

// ─── Funções auxiliares ────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

function formatMatchDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function getScoreDisplay(match: MatchResult): string {
  return `${match.home_score} — ${match.away_score}`
}

function getExtraDisplay(match: MatchResult): string | null {
  if (match.home_score_extra > 0 || match.away_score_extra > 0) {
    return `Prolong: ${match.home_score_extra}–${match.away_score_extra}`
  }
  if (match.home_penalties > 0 || match.away_penalties > 0) {
    return `Pen: ${match.home_penalties}–${match.away_penalties}`
  }
  return null
}

function signedDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : `${diff}`
}

// ─── Componentes de secção ─────────────────────────────────────────────────

function StandingsTable({
  standings,
}: {
  standings: FinalStanding[] | StandingRow[]
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colPos]}>#</Text>
        <Text style={[styles.tableHeaderText, styles.colTeamWide]}>Equipa</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>J</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>V</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>E</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>D</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>GM</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>GS</Text>
        <Text style={[styles.tableHeaderText, styles.colStat]}>DG</Text>
        <Text style={[styles.tableHeaderText, styles.colPts]}>Pts</Text>
      </View>
      {standings.map((row, i) => (
        <View
          key={i}
          style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.tableCell, styles.colPos]}>{i + 1}</Text>
          <Text style={[styles.tableCell, styles.colTeamWide]}>
            {'team_name' in row ? row.team_name : row.team.name}
          </Text>
          <Text style={[styles.tableCell, styles.colStat]}>{row.played}</Text>
          <Text style={[styles.tableCell, styles.colStat]}>{row.won}</Text>
          <Text style={[styles.tableCell, styles.colStat]}>{row.drawn}</Text>
          <Text style={[styles.tableCell, styles.colStat]}>{row.lost}</Text>
          <Text style={[styles.tableCell, styles.colStat]}>{row.goals_for}</Text>
          <Text style={[styles.tableCell, styles.colStat]}>
            {row.goals_against}
          </Text>
          <Text style={[styles.tableCell, styles.colStat]}>
            {signedDiff(row.goal_difference)}
          </Text>
          <Text style={[styles.tableCell, styles.colPts]}>{row.points}</Text>
        </View>
      ))}
    </View>
  )
}

function MatchResultsList({ matches }: { matches: MatchResult[] }) {
  const finished = matches.filter((m) => m.status === 'finished')
  if (finished.length === 0) return null

  return (
    <View style={{ marginBottom: 6 }}>
      {finished.map((match) => (
        <View key={match.id} style={styles.matchResult}>
          <Text style={styles.matchDate}>
            {formatMatchDate(match.scheduled_at)}
          </Text>
          <Text style={styles.matchTeam}>{match.home_team_name}</Text>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.matchScore}>{getScoreDisplay(match)}</Text>
            {getExtraDisplay(match) ? (
              <Text style={styles.matchExtra}>{getExtraDisplay(match)}</Text>
            ) : null}
          </View>
          <Text style={styles.matchTeamAway}>{match.away_team_name}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────

export function TournamentReportDocument({
  data,
}: {
  data: TournamentReportData
}) {
  const {
    tournament,
    organizer,
    phases,
    finalStandings,
    topScorers,
    disciplineTable,
    collectiveStats,
  } = data

  const generatedAt = new Date().toLocaleString('pt-PT')

  const podiumColors = ['#B8860B', '#888', '#8B4513']

  const groupPhases = phases.filter((p) => p.type === 'group')
  const knockoutPhases = phases.filter((p) => p.type === 'knockout')

  return (
    <Document
      title={`Ficha de Torneio — ${tournament.name}`}
      author="Live Soccer"
      subject="Ficha de Torneio Futsal"
      creator="Live Soccer"
    >
      {/* ── CAPA ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.coverTitle}>{tournament.name}</Text>
          <Text style={styles.coverSubtitle}>FICHA DE TORNEIO — FUTSAL</Text>
          <View style={styles.coverDivider} />
          {tournament.starts_at && tournament.ends_at ? (
            <Text style={styles.coverMeta}>
              {formatDate(tournament.starts_at)} —{' '}
              {formatDate(tournament.ends_at)}
            </Text>
          ) : null}
          {tournament.venue ? (
            <Text style={styles.coverMeta}>{tournament.venue}</Text>
          ) : null}
          {tournament.description ? (
            <Text
              style={[styles.coverMeta, { maxWidth: 300, textAlign: 'center' }]}
            >
              {tournament.description}
            </Text>
          ) : null}
          <Text style={[styles.coverOrganizer, { marginTop: 20 }]}>
            Organização: {organizer.name}
          </Text>
          <Text style={styles.coverOrganizer}>Gerado em: {generatedAt}</Text>
        </View>

        {/* Rodapé da capa */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{tournament.name}</Text>
          <Text style={styles.footerText}>Live Soccer</Text>
        </View>
      </Page>

      {/* ── FASE DE GRUPOS ── */}
      {groupPhases.map((phase) => (
        <Page key={phase.id} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{phase.name.toUpperCase()}</Text>

          {phase.groups.map((group) => (
            <View key={group.id} wrap={false}>
              <Text style={styles.subsectionTitle}>{group.name}</Text>

              <StandingsTable standings={group.standings} />

              <Text
                style={[styles.subsectionTitle, { fontSize: 8, color: '#555' }]}
              >
                Resultados
              </Text>
              <MatchResultsList matches={group.matches} />
            </View>
          ))}

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{tournament.name}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}

      {/* ── ELIMINATÓRIAS ── */}
      {knockoutPhases
        .filter((phase) => phase.knockoutRounds.length > 0)
        .map((phase) => (
          <Page key={phase.id} size="A4" style={styles.page}>
            <Text style={styles.sectionTitle}>{phase.name.toUpperCase()}</Text>

            {[...phase.knockoutRounds]
              .sort((a, b) => b.round - a.round) // quartos → meias → final
              .map((round) => (
                <View key={round.round} wrap={false}>
                  <Text style={styles.subsectionTitle}>{round.label}</Text>
                  <MatchResultsList matches={round.matches} />
                </View>
              ))}

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>{tournament.name}</Text>
              <Text
                style={styles.footerText}
                render={({ pageNumber, totalPages }) =>
                  `${pageNumber} / ${totalPages}`
                }
              />
            </View>
          </Page>
        ))}

      {/* ── CLASSIFICAÇÃO FINAL ── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>CLASSIFICAÇÃO FINAL</Text>

        {finalStandings.length >= 3 ? (
          <View style={styles.podium}>
            {finalStandings.slice(0, 3).map((standing, i) => (
              <View
                key={i}
                style={[
                  styles.podiumItem,
                  { borderColor: podiumColors[i], borderWidth: 2 },
                ]}
              >
                <Text
                  style={[styles.podiumPosition, { color: podiumColors[i] }]}
                >
                  {i + 1}.º
                </Text>
                <Text style={styles.podiumTeam}>{standing.team_name}</Text>
                <Text style={styles.podiumLabel}>{standing.points} pontos</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.subsectionTitle}>Classificação Geral</Text>
        <StandingsTable standings={finalStandings} />

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{tournament.name}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ── ESTATÍSTICAS ── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>ESTATÍSTICAS</Text>

        {/* Goleadores */}
        {topScorers.length > 0 ? (
          <View>
            <Text style={styles.subsectionTitle}>Goleadores</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '6%' }]}>#</Text>
                <Text style={[styles.tableHeaderText, { width: '44%' }]}>
                  Jogador
                </Text>
                <Text style={[styles.tableHeaderText, { width: '34%' }]}>
                  Equipa
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { width: '16%', textAlign: 'center' },
                  ]}
                >
                  Golos
                </Text>
              </View>
              {topScorers.map((scorer, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={[styles.tableCell, { width: '6%' }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.tableCell, { width: '44%' }]}>
                    {scorer.player_name}
                  </Text>
                  <Text style={[styles.tableCell, { width: '34%' }]}>
                    {scorer.team_name}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        width: '16%',
                        textAlign: 'center',
                        fontFamily: 'Helvetica-Bold',
                      },
                    ]}
                  >
                    {scorer.goals}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Disciplina */}
        {disciplineTable.length > 0 ? (
          <View>
            <Text style={styles.subsectionTitle}>Disciplina</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '40%' }]}>
                  Jogador
                </Text>
                <Text style={[styles.tableHeaderText, { width: '36%' }]}>
                  Equipa
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { width: '12%', textAlign: 'center' },
                  ]}
                >
                  Amar.
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { width: '12%', textAlign: 'center' },
                  ]}
                >
                  Verm.
                </Text>
              </View>
              {disciplineTable.map((row, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={[styles.tableCell, { width: '40%' }]}>
                    {row.player_name}
                  </Text>
                  <Text style={[styles.tableCell, { width: '36%' }]}>
                    {row.team_name}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: '12%', textAlign: 'center' },
                    ]}
                  >
                    {row.yellow_cards || '—'}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: '12%', textAlign: 'center' },
                    ]}
                  >
                    {row.red_cards || '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Estatísticas colectivas */}
        <Text style={styles.subsectionTitle}>Estatísticas Colectivas</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.total_goals}
            </Text>
            <Text style={styles.statBoxLabel}>Golos totais</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.total_matches}
            </Text>
            <Text style={styles.statBoxLabel}>Jogos disputados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.avg_goals_per_match.toFixed(1)}
            </Text>
            <Text style={styles.statBoxLabel}>Média golos/jogo</Text>
          </View>
          <View style={[styles.statBox, { width: '47%' }]}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.most_goals_team.name}
            </Text>
            <Text style={styles.statBoxLabel}>
              Equipa mais goleadora ({collectiveStats.most_goals_team.goals}{' '}
              golos)
            </Text>
          </View>
          <View style={[styles.statBox, { width: '47%' }]}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.least_conceded_team.name}
            </Text>
            <Text style={styles.statBoxLabel}>
              Melhor defesa ({collectiveStats.least_conceded_team.goals}{' '}
              sofridos)
            </Text>
          </View>
          <View style={[styles.statBox, { width: '47%' }]}>
            <Text style={styles.statBoxValue}>
              {collectiveStats.best_fair_play_team.name}
            </Text>
            <Text style={styles.statBoxLabel}>
              Melhor fair play ({collectiveStats.best_fair_play_team.cards}{' '}
              cartões)
            </Text>
          </View>
        </View>

        {/* Linha de assinatura do organizador */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureLine}>
            <View style={styles.signatureBar} />
            <Text style={styles.signatureLabel}>Assinatura do Organizador</Text>
          </View>
          <View style={styles.signatureLine}>
            <View style={styles.signatureBar} />
            <Text style={styles.signatureLabel}>Data</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{tournament.name}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
