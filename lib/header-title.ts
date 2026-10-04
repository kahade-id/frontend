/** Consistent native header hierarchy: screen headings H2, item details H3. */
const COMPACT_DETAIL_PATHS = [
  /^\/(?:order|notification|chat|dispute|support|invoice|delivery-proof|extension|tracking|milestones|wallet-transaction|order-link|jastip|patungan)\/[^/]+$/,
  /^\/(?:showcase|user|profile)\/[^/]+(?:\/(?:questions|ratings|showcase))?$/,
  /^\/returns\/[^/]+$/,
  /^\/help\/[^/]+$/,
  /^\/help\/category\/[^/]+$/,
] as const

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? "/"
  const segments = path
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(/^\([^/]+\)$/).test(segment))
  return `/${segments.join("/")}`.toLowerCase()
}

/** Detail screens get a compact H3; main/list/form screens keep the H2 default. */
export function defaultHeaderTitleVariant(pathname: string): "h2" | "h3" {
  const path = normalizePathname(pathname)
  // Static create form shares the first segment with showcase detail, but is
  // an action screen rather than an item detail.
  if (path === "/showcase/create") return "h2"
  return COMPACT_DETAIL_PATHS.some((pattern) => pattern.test(path)) ? "h3" : "h2"
}
