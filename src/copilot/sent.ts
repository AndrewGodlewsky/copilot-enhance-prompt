import { createHash } from 'node:crypto'
export const sentKey = (sessionId: string, text: string) => `sent:${createHash('sha256').update(sessionId).update('\0').update(text).digest('hex')}`
