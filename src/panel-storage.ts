// Private composer values subject to the draft/history retention preference.
export const PRIVATE_PANEL_KEYS = new Set(['draft', 'result', 'lastRun', 'contextShown', 'contextNotes', 'files', 'workspaceKey', 'parked'])
export const privatePanelKey = (key: string) => key.startsWith('panel:') && PRIVATE_PANEL_KEYS.has(key.slice(6))
