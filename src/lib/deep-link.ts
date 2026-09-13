/** Accept shared clean URLs while retaining the existing hash-router URLs. */
export function hashRouteForDeepLink(
  pathname: string,
  search: string,
  hash: string
) {
  if (
    hash ||
    !/^\/(pricing|dashboard(?:\/[^?#]*)?|showcase|templates|contact|support)\/?$/.test(
      pathname
    )
  )
    return null;
  return `/#${pathname}${search}`;
}
