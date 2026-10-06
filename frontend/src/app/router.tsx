import type { ReactElement } from 'react'
import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AccountShell } from '@/layouts/AccountShell'
import { AdminShell } from '@/layouts/AdminShell'
import { ProjectShell } from '@/layouts/ProjectShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/features/home/HomePage'
import { ApplyPage } from '@/features/registration/ApplyPage'
import { CheckEmailPage } from '@/features/registration/CheckEmailPage'
import { RecoverPage } from '@/features/registration/RecoverPage'
import { RegistrationLayout } from '@/features/registration/RegistrationLayout'
import { ResetPasswordPage } from '@/features/registration/ResetPasswordPage'
import { SignInPage } from '@/features/registration/SignInPage'
import { StatusPage } from '@/features/registration/StatusPage'
import { VerifyEmailPage } from '@/features/registration/VerifyEmailPage'
import { AccountsPage } from '@/features/admin/AccountsPage'
import { ApplicationsPage } from '@/features/admin/ApplicationsPage'
import { AuditPage } from '@/features/admin/AuditPage'
import { LimitsPage } from '@/features/admin/LimitsPage'
import { OperationsPage } from '@/features/admin/OperationsPage'
import { ProposalsPage } from '@/features/admin/ProposalsPage'
import { SupportPage } from '@/features/admin/SupportPage'
import { ComparisonPage } from '@/features/comparison/ComparisonPage'
import { AnnouncementPage } from '@/features/announcement/AnnouncementPage'
import { ActivityPage } from '@/features/activity/ActivityPage'
import { DiscussionPage } from '@/features/discussion/DiscussionPage'
import { EvidencePage } from '@/features/evidence/EvidencePage'
import { DownloadsPage } from '@/features/downloads/DownloadsPage'
import { WritingPage } from '@/features/writing/WritingPage'
import { InvitationPage } from '@/features/members/InvitationPage'
import { MembersPage } from '@/features/members/MembersPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { AnnouncementPublicPage } from '@/features/publicAnnouncements/AnnouncementPublicPage'
import { AnnouncementsListPage } from '@/features/publicAnnouncements/AnnouncementsListPage'
import { InterestPage } from '@/features/publicAnnouncements/InterestPage'
import { SubmissionPage } from '@/features/submission/SubmissionPage'
import { CasePage } from '@/features/editorial/CasePage'
import { QueuePage } from '@/features/editorial/QueuePage'
import { ReviewListPage } from '@/features/review/ReviewListPage'
import { ReviewPage } from '@/features/review/ReviewPage'
import { PublicationPage } from '@/features/publications/PublicationPage'
import { ResearchListPage } from '@/features/publications/ResearchListPage'
import { AlignmentPage } from '@/features/alignment/AlignmentPage'
import { IsnadPage } from '@/features/isnad/IsnadPage'
import { FamiliesPage } from '@/features/families/FamiliesPage'
import { IlalPage } from '@/features/ilal/IlalPage'
import { NarratorPage } from '@/features/narrator/NarratorPage'
import { BookPage } from '@/features/books/BookPage'
import { ArgumentPage } from '@/features/argument/ArgumentPage'
import { SearchComparePage } from '@/features/searchCompare/SearchComparePage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { ProjectResourcesPage } from '@/features/library/ProjectResourcesPage'
import { SavedSearchesPage } from '@/features/savedSearches/SavedSearchesPage'
import { SearchPage } from '@/features/search/SearchPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { ResourcePickerPage } from '@/features/picker/ResourcePickerPage'
import { ProjectCopyPage } from '@/features/projects/ProjectCopyPage'
import { ProjectCreatePage } from '@/features/projects/ProjectCreatePage'
import { ProjectIndexPage } from '@/features/projects/ProjectIndexPage'
import { ProjectOverviewPage } from '@/features/projects/ProjectOverviewPage'
import { ProjectSettingsPage } from '@/features/projects/ProjectSettingsPage'
import { ComponentKit } from '@/pages/ComponentKit'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PendingScreen } from '@/pages/PendingScreen'
import { RequireAdmin, RequireApproved, RequireAuth, RequireEditor } from './guards'
import { screensIn, type ScreenDef } from './screens'

/** Screens that have a real page; the rest render a placeholder. */
const BUILT: Record<string, ReactElement> = {
  '01': <ApplyPage />,
  '02': <HomePage />,
  '04': <ProjectIndexPage />,
  '05': <ProjectCreatePage />,
  '06': <ProjectOverviewPage />,
  '06s': <ProjectSettingsPage />,
  '06c': <ProjectCopyPage />,
  '03': <LibraryPage />,
  '03b': <ProjectResourcesPage />,
  '07': <ResourcePickerPage />,
  '08': <SearchPage />,
  '08s': <SavedSearchesPage />,
  '09': <EvidencePage />,
  '10': <ComparisonPage />,
  '11': <WritingPage />,
  '12': <DownloadsPage />,
  '14': <SettingsPage />,
  '15': <MembersPage />,
  '16': <DiscussionPage />,
  '17': <NotificationsPage />,
  '18': <ActivityPage />,
  '19': <AnnouncementPage />,
  '20l': <AnnouncementsListPage />,
  '20': <AnnouncementPublicPage />,
  '21': <SubmissionPage />,
  '24': <PublicationPage />,
  '26': <AlignmentPage />,
  '27': <IsnadPage />,
  '28': <FamiliesPage />,
  '29': <IlalPage />,
  '30': <NarratorPage />,
  '31': <BookPage />,
  '32': <ArgumentPage />,
  '35': <SearchComparePage />,
  '25': <ResearchListPage />,
  '40': <InterestPage />,
  '07p': <ResourcePickerPage />,
}

const pending = (screen: ScreenDef): RouteObject => ({
  path: screen.path,
  element: BUILT[screen.id] ?? <PendingScreen screen={screen} />,
})

/**
 * Route table follows docs/design/navigation-map.md:
 *   public site  ·  account shell  ·  project shell (inside account shell)  ·  admin
 * Screens are swapped from placeholder to real page as each phase delivers them.
 */
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Navigate to="/home" replace /> },
      // Screen 01 has its own group below.
      ...screensIn('public').filter((x) => x.id !== '01').map(pending),
    ],
  },
  {
    // Screen 01: apply, verify, sign in, recover, status.
    element: <RegistrationLayout />,
    children: [
      { path: 'apply', element: <ApplyPage /> },
      { path: 'apply/check-email', element: <CheckEmailPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'recover', element: <RecoverPage /> },
      { path: 'recover/reset', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RegistrationLayout />,
        children: [{ path: 'status', element: <StatusPage /> }],
      },
      {
        element: <RequireApproved />,
        children: [
          {
            element: <AccountShell />,
            children: [
              ...screensIn('account').map(pending),
              { path: 'invitations/:token', element: <InvitationPage /> },
              ...screensIn('editor').filter((x) => x.id !== '22' && x.id !== '23').map(pending),
              // Screen 23: the packages the person has been asked to review (any approved researcher may be asked).
              { path: 'review', element: <ReviewListPage /> },
              { path: 'review/:assignmentId', element: <ReviewPage /> },
              {
                // Screen 22: the editorial console, for editors and administrators only.
                element: <RequireEditor />,
                children: [
                  { path: 'editor', element: <QueuePage /> },
                  { path: 'editor/:submissionId', element: <CasePage /> },
                ],
              },
              {
                path: 'projects/:projectId',
                element: <ProjectShell />,
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  ...screensIn('project').map(pending),
                ],
              },
              ...(import.meta.env.DEV ? [{ path: 'dev/kit', element: <ComponentKit /> }] : []),
            ],
          },
          {
            // Screen 13: its own shell and rail, only for administrators.
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              {
                element: <AdminShell />,
                children: [
                  { index: true, element: <Navigate to="applications" replace /> },
                  { path: 'applications', element: <ApplicationsPage /> },
                  { path: 'accounts', element: <AccountsPage /> },
                  { path: 'proposals', element: <ProposalsPage /> },
                  { path: 'limits', element: <LimitsPage /> },
                  { path: 'support', element: <SupportPage /> },
                  { path: 'audit', element: <AuditPage /> },
                  { path: 'operations', element: <OperationsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const createAppRouter = () => createBrowserRouter(routes)
export const createTestRouter = (
  initialEntries: NonNullable<NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries']>,
) => createMemoryRouter(routes, { initialEntries })
