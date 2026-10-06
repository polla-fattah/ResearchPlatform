/**
 * Project roles. The backend uses two incompatible vocabularies (DEF-3):
 *   ProjectController       owner | researcher | reviewer | viewer
 *   CollaborationController co_investigator | contributor | reviewer | observer
 * The SRS (§3.1–3.2) and the mockups use Owner, Researcher, Project reviewer, Viewer.
 * Every backend value is mapped here, conservatively, so the UI never offers more than the SRS allows.
 */
export type ProjectRole = 'owner' | 'researcher' | 'reviewer' | 'viewer'

const ROLE_MAP: Record<string, ProjectRole> = {
  owner: 'owner',
  researcher: 'researcher',
  reviewer: 'reviewer',
  viewer: 'viewer',
  // Backend-only names. They have no SRS counterpart; never map upward to owner.
  co_investigator: 'researcher',
  contributor: 'researcher',
  observer: 'viewer',
}

export function normalizeRole(raw: string | null | undefined): ProjectRole | null {
  if (!raw) return null
  return ROLE_MAP[raw] ?? null
}

/** Actions from the SRS §3.2 permission matrix (R1b defaults). */
export type ProjectAction =
  | 'read'
  | 'addShared' // resources, evidence, analyses, documents
  | 'comment'
  | 'createPrivateAnnotation'
  | 'manageTasks'
  | 'editShared'
  | 'manageMembers' // members, settings, ownership
  | 'manageSettings' // project details, stage, archive, trash
  | 'publishAnnouncement'
  | 'submitFormal'
  | 'download'
  | 'archiveOrTrash'

const MATRIX: Record<ProjectAction, readonly ProjectRole[]> = {
  read: ['owner', 'researcher', 'reviewer', 'viewer'],
  addShared: ['owner', 'researcher'],
  comment: ['owner', 'researcher', 'reviewer'],
  createPrivateAnnotation: ['owner', 'researcher', 'reviewer', 'viewer'],
  manageTasks: ['owner', 'researcher'],
  editShared: ['owner', 'researcher'],
  manageMembers: ['owner'],
  manageSettings: ['owner'],
  publishAnnouncement: ['owner'],
  submitFormal: ['owner'],
  download: ['owner', 'researcher', 'reviewer', 'viewer'],
  archiveOrTrash: ['owner'],
}

export function can(role: ProjectRole | null, action: ProjectAction): boolean {
  return role !== null && MATRIX[action].includes(role)
}

/** Label keys (see i18n `roles.*`). Display name for reviewer is "Project reviewer". */
export const ROLE_LABEL_KEYS: Record<ProjectRole, string> = {
  owner: 'roles.owner',
  researcher: 'roles.researcher',
  reviewer: 'roles.reviewer',
  viewer: 'roles.viewer',
}
