import { useSyncExternalStore } from 'react'
import { subscribe, version } from '../../src/runtime.ts'
export * from '../../src/runtime.ts'
export function usePanel(): number { return useSyncExternalStore(subscribe, version) }
