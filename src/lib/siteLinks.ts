/** Central links for credits, About, and Follow Gesture Synth. */

export const ETHAN = {
  name: "Ethan",
  href: "https://thegreatest.dev",
} as const

export const ERIC = {
  name: "Eric",
  href: "https://www.instagram.com/indecisive.eric",
} as const

/** One-time tips for server costs. Ko-fi pays out to PayPal or Stripe. */
export const SUPPORT = {
  label: "Support Gesture Synth",
  href: "https://ko-fi.com/gesturesynth",
} as const

export const GITHUB_REPO = "https://github.com/Ekmand/music-synth"
export const GITHUB_CONTRIBUTORS = `${GITHUB_REPO}/graphs/contributors`

export const COMMUNITY_HOME = "https://community.gesturesynth.com"
export const COMMUNITY_BUILDER = `${COMMUNITY_HOME}/builder`

/** Opens the community builder, with the searched title ready to record. */
export function communityBuilderHref(title?: string) {
  const trimmed = title?.trim()
  if (!trimmed) return COMMUNITY_BUILDER
  const url = new URL(COMMUNITY_BUILDER)
  url.searchParams.set("title", trimmed.slice(0, 120))
  return url.toString()
}

/**
 * Official Gesture Synth socials — update hrefs when handles change.
 * Entries with empty href are hidden in the UI.
 */
export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/gesturesynth/" },
  { label: "Discord", href: "https://discord.gg/ensg4kmUve" },
  { label: "TikTok", href: "https://www.tiktok.com/@gesturesynthofficial" },
  { label: "YouTube", href: "https://www.youtube.com/@gesturesynth" },
] as const

export function activeSocialLinks() {
  return SOCIAL_LINKS.filter((l) => Boolean(l.href))
}
