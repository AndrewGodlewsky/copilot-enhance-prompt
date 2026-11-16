// SemVer precedence, including numeric prerelease identifiers and ignored build metadata.
export function versionParts(value: unknown): { core: bigint[]; pre: string[] } | null {
  if (typeof value !== 'string' || value.length > 150) return null
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value)
  if (!match) return null
  const pre = match[4]?.split('.') ?? []
  if (pre.some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return null
  return { core: match.slice(1, 4).map(BigInt), pre }
}
export function compareVersions(left: unknown, right: unknown): number | null {
  const a = versionParts(left), b = versionParts(right)
  if (!a || !b) return null
  const cmp = (x: bigint | string, y: bigint | string) => x < y ? -1 : x > y ? 1 : 0
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return cmp(a.core[i], b.core[i])
  if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i]
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1
    if (x === y) continue
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y)
    return nx && ny ? cmp(BigInt(x), BigInt(y)) : nx !== ny ? nx ? -1 : 1 : cmp(x, y)
  }
  return 0
}
