const HEADER_LOGO_FILES = [
  'ab.png',
  'amogus.png',
  'bendy.png',
  'capcom.png',
  'celeste.png',
  'cod.png',
  'doom.png',
  'fortnite.png',
  'kirby.png',
  'mario.png',
  'minecraft.png',
  'mk.png',
  'mortal kombat.png',
  'ms.png',
  'nintendo.png',
  'pacman.png',
  'pm.png',
  'pokemon.png',
  'polybius.png',
  'ps.png',
  'pubg.png',
  'pvz.png',
  'sega.png',
  'sf.png',
  'sonic.png',
  'steam.png',
  'twitch.png',
  'valorant.png',
  'xbox.png',
  'zelda.png',
] as const

export function headerLogoUrl(filename: string): string {
  return `/logos/${encodeURIComponent(filename)}`
}

export function pickRandomHeaderLogo(): string {
  const index = Math.floor(Math.random() * HEADER_LOGO_FILES.length)
  return headerLogoUrl(HEADER_LOGO_FILES[index])
}
