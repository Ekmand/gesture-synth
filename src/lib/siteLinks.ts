/** Central links for credits, About, and Follow Gesture Synth. */

export const ETHAN = {
  name: "Ethan",
  href: "https://thegreatest.dev",
} as const

export const ERIC = {
  name: "Eric",
  href: "https://www.instagram.com/indecisive.eric",
} as const

export const GITHUB_REPO = "https://github.com/Ekmand/music-synth"
export const GITHUB_CONTRIBUTORS = `${GITHUB_REPO}/graphs/contributors`

export const COMMUNITY_HOME = "https://community.gesturesynth.com"
export const COMMUNITY_BUILDER = `${COMMUNITY_HOME}/builder`

/**
 * Official Gesture Synth socials — update hrefs when handles change.
 * Entries with empty href are hidden in the UI.
 */
export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/gesturesynth/" },
  { label: "Discord", href: "https://discord.gg/gesturesynth" },
  { label: "TikTok", href: "https://www.tiktok.com/@gesturesynth" },
  { label: "YouTube", href: "https://www.youtube.com/@gesturesynth" },
] as const

export function activeSocialLinks() {
  return SOCIAL_LINKS.filter((l) => Boolean(l.href))
}
