export type Contest = {
  id: string
  slug: string
  title: string
  description: string | null
  deadline: string
  published: boolean
  results_published: boolean
  scheduled_publish_at?: string | null
  schedule_tagline?: string | null
  created_at: string
}

export type ScheduledContestTeaser = {
  id: string
  title: string
  scheduled_publish_at: string
  schedule_tagline: string | null
}

export type Track = {
  id: string
  contest_id: string
  sort_order: number
  difficulty: string | null
  audio_path: string
  song_title?: string | null
}

export type Game = {
  id: string
  primary_title: string
  slug: string
  created_at: string
  updated_at: string
  igdb_id?: number | string | null
  cover_image_url?: string | null
  genres?: string[] | null
  platforms?: string[] | null
  release_date?: string | null
  description?: string | null
}

export type GameAlternateTitle = {
  id: string
  game_id: string
  title: string
  created_at: string
}

export type IgdbGamePreview = {
  igdb_id: number
  igdb_name: string | null
  cover_image_url: string | null
  genres: string[]
  platforms: string[]
  release_date: string | null
  description: string | null
}

export type TrackGameLink = {
  track_id: string
  game_id: string
  link_kind: 'primary' | 'shared_music'
}

export type TrackAnswer = {
  track_id: string
  game_names: string[]
  song_title: string | null
  notes: string | null
  primary_game_id?: string | null
  shared_music_titles?: string[]
}

export type SubmissionReviewStatus = 'open' | 'reviewed'

export type Submission = {
  id: string
  contest_id: string
  contestant_name: string
  created_at: string
  review_status?: SubmissionReviewStatus
  updated_at?: string
  user_id?: string | null
}

export type SiteBackgroundPattern =
  | 'none'
  | 'dk64'
  | 'furnacefun'
  | 'smwc'
  | 'candycavios'
  | 'cutestripes'
  | 'miningmelancholy'
  | 'outer_wall'
  | 'supermariokart'

export type DisplayNameEffect = 'none' | 'outline' | 'drop_shadow' | 'glow'

export type Profile = {
  id: string
  is_admin: boolean
  notify_new_contest_email?: boolean
  created_at: string
  username: string | null
  display_name: string | null
  bio: string | null
  player_number: number | null
  avatar_path?: string | null
  favorite_soundtrack_game_id?: string | null
  site_background_pattern?: SiteBackgroundPattern | null
  display_name_color?: string | null
  display_name_color_2?: string | null
  display_name_effect?: DisplayNameEffect | null
}

export type PublicProfile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  player_number: number
  created_at: string
  avatar_path?: string | null
}

export type SubmissionGuess = {
  id: string
  submission_id: string
  track_id: string
  guess_text: string
}

export type GradingMark = {
  submission_id: string
  track_id: string
  mark: 'game' | 'franchise'
}
