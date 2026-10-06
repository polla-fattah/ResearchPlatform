import type { Release } from './features'

export type Area = 'public' | 'account' | 'project' | 'admin' | 'editor'

export interface ScreenDef {
  /** Mockup number, e.g. "08" or "03b". */
  id: string
  name: string
  area: Area
  /** Path relative to the area root (see router). */
  path: string
  release: Release
  mockup: string
  reqs: string
  /** Backend work still pending for this screen (docs/api/API_REQUESTS_FROM_FRONTEND.md). */
  apis?: string[]
}

/**
 * Registry of all 41 mockups. Drives the placeholder pages, so every route in the
 * navigation map resolves while screens are built phase by phase.
 */
export const SCREENS: readonly ScreenDef[] = [
  { id: '01', name: 'Registration and application', area: 'public', path: 'apply', release: 'R1a', mockup: '01 Registration', reqs: 'ACC-01 to 04', apis: ['API-1', 'DEF-13'] },
  { id: '02', name: 'Personal home', area: 'account', path: 'home', release: 'R1a', mockup: '02 Personal Home', reqs: 'ACC-05, PRJ-02, EXP-06', apis: ['API-3'] },
  { id: '03', name: 'My Library', area: 'account', path: 'library', release: 'R1a', mockup: '03 My Library', reqs: 'LIB-01 to 09', apis: ['API-5', 'DEF-9'] },
  { id: '03b', name: 'Project resources', area: 'project', path: 'resources', release: 'R1a', mockup: '03b Project Resources', reqs: 'LIB-05 to 09, PRJ-03', apis: ['API-5'] },
  { id: '04', name: 'Project index', area: 'account', path: 'projects', release: 'R1a', mockup: '04 Project Index', reqs: 'PRJ-01, 02, 04, 07', apis: ['API-4'] },
  { id: '05', name: 'Project creation', area: 'account', path: 'projects/new', release: 'R1a', mockup: '05 Project Creation', reqs: 'PRJ-01, 04', apis: ['API-4'] },
  { id: '06', name: 'Project overview and settings', area: 'project', path: 'overview', release: 'R1a', mockup: '06 Project Overview', reqs: 'PRJ-03 to 07', apis: ['API-4'] },
  { id: '06s', name: 'Project settings', area: 'project', path: 'settings', release: 'R1a', mockup: '06 Project Overview', reqs: 'PRJ-04, 07' },
  { id: '06c', name: 'Copy to another project', area: 'project', path: 'copy', release: 'R1a', mockup: '06 Project Overview', reqs: 'PRJ-06' },
  { id: '07', name: 'Resource picker', area: 'account', path: 'library/add', release: 'R1a', mockup: '07 Resource Picker', reqs: 'LIB-01, 03, 07, SEA-08' },
  { id: '07p', name: 'Resource picker (project)', area: 'project', path: 'resources/add', release: 'R1a', mockup: '07 Resource Picker', reqs: 'LIB-01, 03, 07, SEA-08' },
  { id: '08', name: 'Search workspace', area: 'project', path: 'searches', release: 'R1a', mockup: '08 Search Workspace', reqs: 'SEA-01 to 08', apis: ['API-6', 'DEF-11'] },
  { id: '08s', name: 'Saved searches (account)', area: 'account', path: 'searches', release: 'R1a', mockup: '08 Search Workspace', reqs: 'SEA-04', apis: ['API-6'] },
  { id: '09', name: 'Evidence inspector', area: 'project', path: 'evidence', release: 'R1a', mockup: '09 Evidence Inspector', reqs: 'EVI-01 to 07, LIB-08', apis: ['API-7', 'DEF-4'] },
  { id: '10', name: 'Comparison workspace', area: 'project', path: 'analysis', release: 'R1a', mockup: '10 Comparison Workspace', reqs: 'ANA-01 to 05', apis: ['API-6'] },
  { id: '11', name: 'Finding and document editor', area: 'project', path: 'findings', release: 'R1a', mockup: '11 Finding Editor', reqs: 'WRT-01 to 06', apis: ['API-8', 'DEF-8'] },
  { id: '12', name: 'Downloads', area: 'account', path: 'downloads', release: 'R1a', mockup: '12 Downloads', reqs: 'EXP-01 to 10', apis: ['API-9'] },
  { id: '13', name: 'Administration', area: 'admin', path: 'applications', release: 'R1a', mockup: '13 Administration', reqs: 'ACC-03, 07, 08, ADM-01, 03 to 06', apis: ['API-10'] },
  { id: '14', name: 'Profile and settings', area: 'account', path: 'settings', release: 'R1a', mockup: '14 Profile Settings', reqs: 'ACC-04, 06 to 08', apis: ['API-2'] },
  { id: '15', name: 'Members and invitations', area: 'project', path: 'members', release: 'R1b', mockup: '15 Members', reqs: 'COL-01, 02, SEC-02', apis: ['API-11', 'DEF-3'] },
  { id: '16', name: 'Discussion and tasks', area: 'project', path: 'discussion', release: 'R1b', mockup: '16 Discussion Tasks', reqs: 'COL-03, 04, 07', apis: ['DEF-12'] },
  { id: '17', name: 'Notifications', area: 'account', path: 'notifications', release: 'R1b', mockup: '17 Notifications', reqs: 'COL-05', apis: ['API-12'] },
  { id: '18', name: 'Activity', area: 'project', path: 'activity', release: 'R1b', mockup: '18 Activity', reqs: 'COL-08', apis: ['API-12'] },
  { id: '19', name: 'Announcement editor', area: 'project', path: 'announcement', release: 'R1b', mockup: '19 Announcement Editor', reqs: 'ANN-01 to 04', apis: ['API-13'] },
  { id: '20l', name: 'Public announcements', area: 'public', path: 'announcements', release: 'R1b', mockup: '20 Public Announcement', reqs: 'ANN-05', apis: ['DEF-5'] },
  { id: '20', name: 'Public announcement', area: 'public', path: 'announcements/:slug', release: 'R1b', mockup: '20 Public Announcement', reqs: 'ANN-02, 03, 05', apis: ['DEF-5'] },
  { id: '21', name: 'Submission', area: 'project', path: 'submission', release: 'R1c', mockup: '21 Submission', reqs: 'PUB-01, 02, 06, 12' },
  { id: '22', name: 'Editorial console', area: 'editor', path: 'editor', release: 'R1c', mockup: '22 Editorial Console', reqs: 'ADM-02, PUB-03 to 07', apis: ['API-14', 'DEF-7'] },
  { id: '23', name: 'Reviewer workspace', area: 'editor', path: 'review/:submissionId', release: 'R1c', mockup: '23 Reviewer Workspace', reqs: 'PUB-04, 05', apis: ['API-14'] },
  { id: '24', name: 'Public publication', area: 'public', path: 'research/:slug', release: 'R1c', mockup: '24 Public Publication', reqs: 'PUB-08, 10, 11' },
  { id: '25', name: 'Public research search', area: 'public', path: 'research', release: 'R1c', mockup: '25 Public Search', reqs: 'PUB-09', apis: ['API-13'] },
  { id: '26', name: 'Matn alignment', area: 'project', path: 'analysis/matn', release: 'R2', mockup: '26 Matn Alignment', reqs: 'ANA-06' },
  { id: '27', name: 'Isnād graph', area: 'project', path: 'analysis/isnad', release: 'R2', mockup: '27 Isnad Graph', reqs: 'ANA-07' },
  { id: '28', name: 'Hadith family and shawāhid', area: 'project', path: 'analysis/families', release: 'R2', mockup: '28 Hadith Family', reqs: 'ANA-08' },
  { id: '29', name: 'ʿIlal case file', area: 'project', path: 'analysis/ilal', release: 'R2', mockup: '29 Ilal Case', reqs: 'ANA-09' },
  { id: '30', name: 'Narrator dossier', area: 'project', path: 'analysis/narrators/:narratorId?', release: 'R2', mockup: '30 Narrator Dossier', reqs: 'ANA-10, 11, EVI-08' },
  { id: '31', name: 'Book structure and terminology', area: 'project', path: 'analysis/books/:bookId?', release: 'R2', mockup: '31 Book Structure', reqs: 'ANA-12' },
  { id: '32', name: 'Argument map', area: 'project', path: 'argument-map', release: 'R2', mockup: '32 Argument Map', reqs: 'WRT-08' },
  { id: '33', name: 'Dataset builder', area: 'project', path: 'datasets', release: 'R2', mockup: '33 Dataset Builder', reqs: 'WRT-09', apis: ['API-15'] },
  { id: '34', name: 'Rich-text editor', area: 'project', path: 'documents/:documentId/rich', release: 'R2', mockup: '34 Rich Text Editor', reqs: 'WRT-10', apis: ['API-8'] },
  { id: '35', name: 'Search run comparison', area: 'project', path: 'searches/compare', release: 'R2', mockup: '35 Search Run Compare', reqs: 'SEA-09, 10', apis: ['API-6'] },
  { id: '36', name: 'Uploads and reference import', area: 'account', path: 'library/import', release: 'R2', mockup: '36 Uploads Import', reqs: 'LIB-04, LIB-10', apis: ['API-15'] },
  { id: '37', name: 'Project templates', area: 'account', path: 'projects/templates', release: 'R2', mockup: '37 Project Templates', reqs: 'PRJ-08' },
  { id: '38', name: 'Export and package import', area: 'account', path: 'downloads/import', release: 'R2', mockup: '38 Export Import', reqs: 'EXP-05, 11', apis: ['API-9'] },
  { id: '39', name: 'Public dataset and dossier', area: 'public', path: 'datasets/:slug', release: 'R2', mockup: '39 Public Dataset Dossier', reqs: 'WRT-09', apis: ['API-15'] },
  { id: '40', name: 'Collaboration interest', area: 'public', path: 'announcements/:slug/interest', release: 'R2', mockup: '40 Collaboration Interest', reqs: 'ANN-06', apis: ['API-13'] },
]

/** Screens that a route should render, grouped by area. */
export const screensIn = (area: Area): ScreenDef[] => SCREENS.filter((s) => s.area === area)
