/** The screens the accessibility and right-to-left checks visit. `signedIn` false are the public ones. */
export interface Visit {
  name: string
  path: string
  signedIn: boolean
  /** Text that must be on the screen once it has loaded (a heading), so the check does not run on a loading line. */
  ready: RegExp
}

export const VISITS: Visit[] = [
  { name: 'sign-in', path: '/sign-in', signedIn: false, ready: /sign in/i },
  { name: 'apply', path: '/apply', signedIn: false, ready: /apply|application|create/i },
  { name: 'public-announcements', path: '/announcements', signedIn: false, ready: /announcements/i },
  { name: 'public-research', path: '/research', signedIn: false, ready: /published research|research/i },
  { name: 'home', path: '/home', signedIn: true, ready: /welcome back/i },
  { name: 'projects', path: '/projects', signedIn: true, ready: /projects/i },
  { name: 'overview', path: '/projects/12/overview', signedIn: true, ready: /chains of the wuḍūʾ/i },
  { name: 'evidence', path: '/projects/12/evidence', signedIn: true, ready: /evidence/i },
  { name: 'searches', path: '/projects/12/searches', signedIn: true, ready: /search/i },
  { name: 'analysis', path: '/projects/12/analysis', signedIn: true, ready: /comparison|choose|select|report/i },
  { name: 'findings', path: '/projects/12/findings', signedIn: true, ready: /findings and documents/i },
  { name: 'document', path: '/projects/12/findings?doc=31', signedIn: true, ready: /main article/i },
  { name: 'argument-map', path: '/projects/12/argument-map', signedIn: true, ready: /argument map/i },
  { name: 'members', path: '/projects/12/members', signedIn: true, ready: /members/i },
  { name: 'library', path: '/library', signedIn: true, ready: /library/i },
  { name: 'downloads', path: '/downloads', signedIn: true, ready: /downloads/i },
  { name: 'settings', path: '/settings', signedIn: true, ready: /settings|profile|account/i },
  { name: 'not-found', path: '/no/such/page', signedIn: true, ready: /isn.t available|not found|not available/i },
]
