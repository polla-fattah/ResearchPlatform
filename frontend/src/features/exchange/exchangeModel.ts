import { formatCode } from '@/domain/codes'

/** The file the argument map is saved as: named after the project's code so several can sit in one folder. */
export const graphFileName = (projectId: number): string => `argument-map-${formatCode('PRJ', projectId)}.json`
