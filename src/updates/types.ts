export type GitHubSource = { repo: string; ref?: string; sha?: string; path?: string }
export type Installation = {
  scope: string; target?: string; installed?: string; source?: GitHubSource
  marketplace?: GitHubSource; reason?: string; canUpdate: boolean
}
export type Available = { version: string; changes?: string }
export type UpdateView = {
  status: 'unknown' | 'checking' | 'available' | 'updating' | 'reload' | 'current' | 'failed' | 'unavailable'
  running: string; installed?: string; available?: string; changes?: string
  automatic: boolean; dismissed: boolean; checkedAt?: number; message: string; canUpdate: boolean
}
export type UpdateClient = {
  state(): Promise<UpdateView>
  check(manual: boolean): Promise<UpdateView>
  install(): Promise<UpdateView>
  later(): Promise<UpdateView>
  automatic(enabled: boolean): Promise<UpdateView>
}
