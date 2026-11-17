// Covers extended Windows paths (32,767 UTF-16 code units) without truncating an identity.
// Display labels may be shorter; matching must use the complete path from the session adapter.
export const MAX_PROJECT_IDENTITY = 32_768
export const validProjectIdentity = (value: string): boolean => value.length > 0 && value.length <= MAX_PROJECT_IDENTITY
