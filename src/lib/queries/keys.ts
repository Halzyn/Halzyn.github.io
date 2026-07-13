export const queryKeys = {
  contests: ['contests'] as const,
  scheduledTeasers: ['scheduled-contests-teaser'] as const,
  moderatedContestIds: (userId: string) => ['moderated-contest-ids', userId] as const,
  profileNameStyleCaps: (profileId: string) => ['profile-name-style-caps', profileId] as const,
  myContestSubmissions: (profileId: string) => ['my-contest-submissions', profileId] as const,
  favoriteSoundtrackGames: (profileId: string) => ['favorite-soundtrack-games', profileId] as const,
  adminContest: (contestId: string) => ['admin-contest', contestId] as const,
}
