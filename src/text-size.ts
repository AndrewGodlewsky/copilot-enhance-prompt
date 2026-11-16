export type ChatTextSize = 'small' | 'medium' | 'large'

export function isChatTextSize(value: unknown): value is ChatTextSize {
  return value === 'small' || value === 'medium' || value === 'large'
}
