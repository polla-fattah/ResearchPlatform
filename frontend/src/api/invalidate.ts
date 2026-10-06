import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { qk } from './queryKeys'

/**
 * What each kind of write affects (state rule S5). A component calls the invalidator that names what it changed;
 * it never lists keys itself. When a new screen's write changes something other screens show (a count on the
 * project list, the project summary), the knowledge is added here, once.
 */
const run = (qc: QueryClient, ...keys: QueryKey[]): Promise<void> =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey }))).then(() => undefined)

export const invalidate = {
  /** The signed-in user changed (verification, profile). */
  me: (qc: QueryClient) => run(qc, qk.auth.me),
  accountSessionsChanged: (qc: QueryClient) => run(qc, qk.account.sessions),
  notificationPreferencesChanged: (qc: QueryClient) => run(qc, qk.account.notifications),
  applicationStatus: (qc: QueryClient) => run(qc, qk.application.status),

  /** A project was created, trashed, restored, archived or left: every list, and the project's own data. */
  projectLifecycle: (qc: QueryClient) => run(qc, qk.projects.root),
  /** Title, question, tags, stage and the like changed: the project, its summary and the lists that show it. */
  projectEdited: (qc: QueryClient, id: number) =>
    run(qc, qk.project(id).detail, qk.project(id).summary, qk.projects.lists),
  milestonesChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).milestones, qk.project(id).summary),
  questionsChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).questions),

  /** Resources were added to or removed from a project (counts on the summary and the project list change too). */
  resourcesChanged: (qc: QueryClient, id: number) =>
    run(qc, qk.project(id).resources.all, qk.project(id).summary, qk.projects.lists),
  resourceCollectionsChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).resources.collections),

  /** Evidence was added, removed or its state changed (counts by state live on the summary and the lists). */
  evidenceChanged: (qc: QueryClient, id: number) =>
    run(qc, qk.project(id).evidence.all, qk.project(id).summary, qk.projects.lists),
  /** Only one item's annotations changed. */
  annotationsChanged: (qc: QueryClient, id: number, evidenceId: number) =>
    run(qc, qk.project(id).evidence.item(evidenceId)),
  /** An evidence item was linked to or unlinked from a finding. */
  evidenceLinksChanged: (qc: QueryClient, id: number, evidenceId: number) =>
    run(qc, qk.project(id).evidence.deps(evidenceId), qk.project(id).findings.all, qk.project(id).summary),

  /** Saved searches, runs or result sets changed. */
  searchChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).search.all, qk.project(id).summary),

  /** An application was decided: the queue, the accounts (an approval changes one) and the counts. */
  adminApplicationsChanged: (qc: QueryClient) => run(qc, qk.admin.applicationsAll, qk.admin.usersAll, qk.admin.counts),
  /** Roles or status of an account changed, or a closure was decided. */
  adminUsersChanged: (qc: QueryClient) => run(qc, qk.admin.usersAll, qk.admin.closures, qk.admin.counts),
  adminGrantsChanged: (qc: QueryClient) => run(qc, qk.admin.grants, qk.admin.counts),
  adminProposalsChanged: (qc: QueryClient) => run(qc, qk.admin.proposalsAll, qk.admin.ops, qk.admin.counts),

  /** The account's own saved searches changed (saved, renamed, deleted). */
  savedSearchesChanged: (qc: QueryClient) => run(qc, qk.savedSearches.personal),

  /** A document, its versions or its linked findings changed (and the finding lists that show where it is used). */
  documentsChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).documents.all, qk.project(id).findings.all, qk.project(id).summary),
  /** A finding, or the evidence linked to it, changed. */
  findingsChanged: (qc: QueryClient, id: number) =>
    run(qc, qk.project(id).findings.all, qk.project(id).documents.all, qk.project(id).evidence.all, qk.project(id).summary),

  /** A comparison was stored (or a stored one changed): the list of saved analyses and the summary count. */
  analysesChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).analyses.all, qk.project(id).summary),

  /** Members or invitations changed: the lists, the project (its role table) and what lists show of it. */
  membersChanged: (qc: QueryClient, id: number) =>
    run(qc, qk.project(id).members.all, qk.project(id).detail, qk.projects.lists),
  /** A notification was read, or all were: the list and the unread count in the shell and on Home. */
  notificationsChanged: (qc: QueryClient) => run(qc, qk.notifications.all, qk.home.unread),

  /** A thread was opened, answered or resolved. */
  discussionChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).discussion.all),
  /** A task changed: the task lists, the open-task count on the summary, and the account's own task count on Home. */
  tasksChanged: (qc: QueryClient, id: number) => run(qc, qk.project(id).discussion.tasksAll, qk.project(id).summary, qk.home.openTasks),
  /** An invitation was answered: the project now exists for this person, or does not. */
  invitationAnswered: (qc: QueryClient, token: string) => run(qc, qk.invitation(token), qk.projects.root),

  /** The researcher's own library changed (save, tag, collection, remove). */
  libraryChanged: (qc: QueryClient) => run(qc, qk.library.all),

  exportsChanged: (qc: QueryClient) => run(qc, qk.exports.all),
}
