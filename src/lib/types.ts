export type Contest = {
  id: string
  slug: string
  title: string
  description: string | null
  deadline: string
  published: boolean
  created_at: string
}

export type Track = {
  id: string
  contest_id: string
  sort_order: number
  difficulty: string | null
  audio_path: string
}

export type TrackAnswer = {
  track_id: string
  game_title: string
  franchise: string | null
  notes: string | null
}

export type Submission = {
  id: string
  contest_id: string
  contestant_name: string
  created_at: string
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
