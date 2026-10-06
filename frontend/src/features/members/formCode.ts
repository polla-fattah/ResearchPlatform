import { formatCode } from '@/domain/codes'

/** `PRJ-0012` for a project id. */
export const formCode = (projectId: number) => formatCode('PRJ', projectId)
