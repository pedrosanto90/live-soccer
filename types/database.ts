// Supabase database schema types for the live-soccer project.
// Hand-written from the agreed schema. The `Database` type follows the shape
// expected by `@supabase/supabase-js` (`public.Tables` / `public.Enums`), and
// convenience aliases for each table's Row are exported at the bottom.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type TournamentStatus = 'draft' | 'active' | 'finished' | 'cancelled'
export type TournamentVisibility = 'public' | 'private'
export type PhaseType = 'group' | 'knockout'
export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'half_time'
  | 'extra_time'
  | 'penalties'
  | 'finished'
  | 'cancelled'
export type MatchPeriod =
  | 'first_half'
  | 'second_half'
  | 'extra_first'
  | 'extra_second'
  | 'penalties'
export type EventType =
  | 'goal'
  | 'own_goal'
  | 'foul'
  | 'yellow_card'
  | 'red_card'
  | 'penalty_scored'
  | 'penalty_missed'
export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward'
export type TiebreakerCriterion =
  | 'points'
  | 'head_to_head'
  | 'goal_difference'
  | 'goals_scored'
  | 'goals_conceded'
  | 'yellow_cards'
  | 'red_cards'
  | 'draw'
export type UserRole = 'admin' | 'operator' | 'viewer'

// ---------------------------------------------------------------------------
// Settings (stored as JSON in tournaments.settings / matches.settings_override)
// ---------------------------------------------------------------------------

export interface TournamentSettings {
  match: {
    half_duration_minutes: number
    half_time_duration_minutes: number
    extra_time_duration_minutes: number
    max_fouls_per_team_per_half: number
    penalty_shootout_kicks: number
  }
  scoring: {
    points_win: number
    points_draw: number
    points_loss: number
  }
  tiebreak_order: TiebreakerCriterion[]
  cards: {
    yellow_cards_for_suspension: number
    red_card_suspension_matches: number
  }
  // Horário por dia do torneio. `date` é YYYY-MM-DD; `start`/`end` são HH:mm.
  // A hora de fim é prevista (base para agendar jogos) e pode ser nula.
  daily_schedule: { date: string; start: string; end: string | null }[]
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          id: string
          created_by: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          status: TournamentStatus
          visibility: TournamentVisibility
          starts_at: string | null
          ends_at: string | null
          settings: TournamentSettings
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_by: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          status?: TournamentStatus
          visibility?: TournamentVisibility
          starts_at?: string | null
          ends_at?: string | null
          settings: TournamentSettings
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          status?: TournamentStatus
          visibility?: TournamentVisibility
          starts_at?: string | null
          ends_at?: string | null
          settings?: TournamentSettings
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_members: {
        Row: {
          tournament_id: string
          profile_id: string
          role: UserRole
          created_at: string
        }
        Insert: {
          tournament_id: string
          profile_id: string
          role?: UserRole
          created_at?: string
        }
        Update: {
          tournament_id?: string
          profile_id?: string
          role?: UserRole
          created_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          name: string
          short_name: string | null
          color_primary: string
          color_secondary: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          short_name?: string | null
          color_primary: string
          color_secondary: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          short_name?: string | null
          color_primary?: string
          color_secondary?: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          id: string
          team_id: string
          name: string
          number: number | null
          position: PlayerPosition | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          number?: number | null
          position?: PlayerPosition | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          number?: number | null
          position?: PlayerPosition | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_phases: {
        Row: {
          id: string
          tournament_id: string
          name: string
          type: PhaseType
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          type: PhaseType
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          type?: PhaseType
          order_index?: number
          created_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string
          phase_id: string
          name: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          phase_id: string
          name: string
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          phase_id?: string
          name?: string
          order_index?: number
          created_at?: string
        }
        Relationships: []
      }
      group_teams: {
        Row: {
          group_id: string
          team_id: string
        }
        Insert: {
          group_id: string
          team_id: string
        }
        Update: {
          group_id?: string
          team_id?: string
        }
        Relationships: []
      }
      referees: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tournament_referees: {
        Row: {
          tournament_id: string
          referee_id: string
        }
        Insert: {
          tournament_id: string
          referee_id: string
        }
        Update: {
          tournament_id?: string
          referee_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          phase_id: string
          group_id: string | null
          home_team_id: string | null
          away_team_id: string | null
          referee_id: string | null
          venue: string | null
          scheduled_at: string | null
          status: MatchStatus
          bracket_round: number | null
          bracket_position: number | null
          next_match_id: string | null
          next_match_slot: 'home' | 'away' | null
          current_period: MatchPeriod | null
          home_score: number
          away_score: number
          home_score_extra: number
          away_score_extra: number
          home_penalties: number
          away_penalties: number
          home_fouls_h1: number
          away_fouls_h1: number
          home_fouls_h2: number
          away_fouls_h2: number
          home_fouls_extra: number
          away_fouls_extra: number
          settings_override: Partial<TournamentSettings> | null
          timer_started_at: string | null
          timer_elapsed_secs: number
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          phase_id: string
          group_id?: string | null
          home_team_id?: string | null
          away_team_id?: string | null
          referee_id?: string | null
          venue?: string | null
          scheduled_at?: string | null
          status?: MatchStatus
          bracket_round?: number | null
          bracket_position?: number | null
          next_match_id?: string | null
          next_match_slot?: 'home' | 'away' | null
          current_period?: MatchPeriod | null
          home_score?: number
          away_score?: number
          home_score_extra?: number
          away_score_extra?: number
          home_penalties?: number
          away_penalties?: number
          home_fouls_h1?: number
          away_fouls_h1?: number
          home_fouls_h2?: number
          away_fouls_h2?: number
          home_fouls_extra?: number
          away_fouls_extra?: number
          settings_override?: Partial<TournamentSettings> | null
          timer_started_at?: string | null
          timer_elapsed_secs?: number
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          phase_id?: string
          group_id?: string | null
          home_team_id?: string | null
          away_team_id?: string | null
          referee_id?: string | null
          venue?: string | null
          scheduled_at?: string | null
          status?: MatchStatus
          bracket_round?: number | null
          bracket_position?: number | null
          next_match_id?: string | null
          next_match_slot?: 'home' | 'away' | null
          current_period?: MatchPeriod | null
          home_score?: number
          away_score?: number
          home_score_extra?: number
          away_score_extra?: number
          home_penalties?: number
          away_penalties?: number
          home_fouls_h1?: number
          away_fouls_h1?: number
          home_fouls_h2?: number
          away_fouls_h2?: number
          home_fouls_extra?: number
          away_fouls_extra?: number
          settings_override?: Partial<TournamentSettings> | null
          timer_started_at?: string | null
          timer_elapsed_secs?: number
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          id: string
          match_id: string
          team_id: string
          player_id: string | null
          player_name: string | null
          event_type: EventType
          period: MatchPeriod
          elapsed_secs: number
          is_cancelled: boolean
          cancelled_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          team_id: string
          player_id?: string | null
          player_name?: string | null
          event_type: EventType
          period: MatchPeriod
          elapsed_secs: number
          is_cancelled?: boolean
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          team_id?: string
          player_id?: string | null
          player_name?: string | null
          event_type?: EventType
          period?: MatchPeriod
          elapsed_secs?: number
          is_cancelled?: boolean
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      penalty_kicks: {
        Row: {
          id: string
          match_id: string
          team_id: string
          player_id: string | null
          player_name: string | null
          kick_order: number
          scored: boolean
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          team_id: string
          player_id?: string | null
          player_name?: string | null
          kick_order: number
          scored: boolean
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          team_id?: string
          player_id?: string | null
          player_name?: string | null
          kick_order?: number
          scored?: boolean
          created_at?: string
        }
        Relationships: []
      }
      standings: {
        Row: {
          id: string
          group_id: string
          team_id: string
          played: number
          won: number
          drawn: number
          lost: number
          goals_for: number
          goals_against: number
          goal_difference: number
          points: number
          yellow_cards: number
          red_cards: number
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          team_id: string
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          goal_difference?: number
          points?: number
          yellow_cards?: number
          red_cards?: number
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          team_id?: string
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          goal_difference?: number
          points?: number
          yellow_cards?: number
          red_cards?: number
          updated_at?: string
        }
        Relationships: []
      }
      suspensions: {
        Row: {
          id: string
          player_id: string
          tournament_id: string
          matches_count: number
          reason: string | null
          applied: boolean
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          tournament_id: string
          matches_count: number
          reason?: string | null
          applied?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          tournament_id?: string
          matches_count?: number
          reason?: string | null
          applied?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      tournament_status: TournamentStatus
      tournament_visibility: TournamentVisibility
      phase_type: PhaseType
      match_status: MatchStatus
      match_period: MatchPeriod
      event_type: EventType
      player_position: PlayerPosition
      tiebreaker_criterion: TiebreakerCriterion
      user_role: UserRole
    }
    CompositeTypes: Record<never, never>
  }
}

// ---------------------------------------------------------------------------
// Convenience aliases
// ---------------------------------------------------------------------------

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Tournament = Tables<'tournaments'>
export type TournamentMember = Tables<'tournament_members'>
export type Team = Tables<'teams'>
export type Player = Tables<'players'>
export type TournamentPhase = Tables<'tournament_phases'>
export type Group = Tables<'groups'>
export type GroupTeam = Tables<'group_teams'>
export type Referee = Tables<'referees'>
export type TournamentReferee = Tables<'tournament_referees'>
export type Match = Tables<'matches'>
export type MatchEvent = Tables<'match_events'>
export type PenaltyKick = Tables<'penalty_kicks'>
export type Standing = Tables<'standings'>
export type Suspension = Tables<'suspensions'>
