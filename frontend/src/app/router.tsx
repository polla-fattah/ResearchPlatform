import type { ReactElement } from 'react'
import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AccountShell } from '@/layouts/AccountShell'
import { AdminShell } from '@/layouts/AdminShell'
import { ProjectShell } from '@/layouts/ProjectShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { RegistrationLayout } from '@/features/registration/RegistrationLayout'
import { ApplyPage } from '@/features/registration/ApplyPage'
import { CheckEmailPage } from '@/features/registration/CheckEmailPage'
import { RecoverPage } from '@/features/registration/RecoverPage'
import { ResetPasswordPage } from '@/features/registration/ResetPasswordPage'
import { StatusPage } from '@/features/registration/StatusPage'
import { VerifyEmailPage } from '@/features/registration/VerifyEmailPage'
import { SignInPage } from '@/features/registration/SignInPage'
import { RequireAdmin, RequireApproved, RequireAuth, RequireEditor } from './guards'
import { screensIn, type ScreenDef } from './screens'
import { lazyNamed } from './lazy'
import { RouteError } from '@/pages/RouteError'

const HomePage = lazyNamed(() => import('@/features/home/HomePage'), 'HomePage')
const AccountsPage = lazyNamed(() => import('@/features/admin/AccountsPage'), 'AccountsPage')
const ApplicationsPage = lazyNamed(() => import('@/features/admin/ApplicationsPage'), 'ApplicationsPage')
const AuditPage = lazyNamed(() => import('@/features/admin/AuditPage'), 'AuditPage')
const LimitsPage = lazyNamed(() => import('@/features/admin/LimitsPage'), 'LimitsPage')
const OperationsPage = lazyNamed(() => import('@/features/admin/OperationsPage'), 'OperationsPage')
const ProposalsPage = lazyNamed(() => import('@/features/admin/ProposalsPage'), 'ProposalsPage')
const SupportPage = lazyNamed(() => import('@/features/admin/SupportPage'), 'SupportPage')
const ComparisonPage = lazyNamed(() => import('@/features/comparison/ComparisonPage'), 'ComparisonPage')
const AnnouncementPage = lazyNamed(() => import('@/features/announcement/AnnouncementPage'), 'AnnouncementPage')
const ActivityPage = lazyNamed(() => import('@/features/activity/ActivityPage'), 'ActivityPage')
const DiscussionPage = lazyNamed(() => import('@/features/discussion/DiscussionPage'), 'DiscussionPage')
const EvidencePage = lazyNamed(() => import('@/features/evidence/EvidencePage'), 'EvidencePage')
const DownloadsPage = lazyNamed(() => import('@/features/downloads/DownloadsPage'), 'DownloadsPage')
const WritingPage = lazyNamed(() => import('@/features/writing/WritingPage'), 'WritingPage')
const InvitationPage = lazyNamed(() => import('@/features/members/InvitationPage'), 'InvitationPage')
const MembersPage = lazyNamed(() => import('@/features/members/MembersPage'), 'MembersPage')
const NotificationsPage = lazyNamed(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage')
const AnnouncementPublicPage = lazyNamed(() => import('@/features/publicAnnouncements/AnnouncementPublicPage'), 'AnnouncementPublicPage')
const AnnouncementsListPage = lazyNamed(() => import('@/features/publicAnnouncements/AnnouncementsListPage'), 'AnnouncementsListPage')
const InterestPage = lazyNamed(() => import('@/features/publicAnnouncements/InterestPage'), 'InterestPage')
const SubmissionPage = lazyNamed(() => import('@/features/submission/SubmissionPage'), 'SubmissionPage')
const CasePage = lazyNamed(() => import('@/features/editorial/CasePage'), 'CasePage')
const QueuePage = lazyNamed(() => import('@/features/editorial/QueuePage'), 'QueuePage')
const ReviewListPage = lazyNamed(() => import('@/features/review/ReviewListPage'), 'ReviewListPage')
const ReviewPage = lazyNamed(() => import('@/features/review/ReviewPage'), 'ReviewPage')
const PublicationPage = lazyNamed(() => import('@/features/publications/PublicationPage'), 'PublicationPage')
const ResearchListPage = lazyNamed(() => import('@/features/publications/ResearchListPage'), 'ResearchListPage')
const AlignmentPage = lazyNamed(() => import('@/features/alignment/AlignmentPage'), 'AlignmentPage')
const IsnadPage = lazyNamed(() => import('@/features/isnad/IsnadPage'), 'IsnadPage')
const FamiliesPage = lazyNamed(() => import('@/features/families/FamiliesPage'), 'FamiliesPage')
const IlalPage = lazyNamed(() => import('@/features/ilal/IlalPage'), 'IlalPage')
const NarratorPage = lazyNamed(() => import('@/features/narrator/NarratorPage'), 'NarratorPage')
const BookPage = lazyNamed(() => import('@/features/books/BookPage'), 'BookPage')
const ArgumentPage = lazyNamed(() => import('@/features/argument/ArgumentPage'), 'ArgumentPage')
const SearchComparePage = lazyNamed(() => import('@/features/searchCompare/SearchComparePage'), 'SearchComparePage')
const TemplatesPage = lazyNamed(() => import('@/features/templates/TemplatesPage'), 'TemplatesPage')
const ExchangePage = lazyNamed(() => import('@/features/exchange/ExchangePage'), 'ExchangePage')
const ReferenceImportPage = lazyNamed(() => import('@/features/referenceImport/ReferenceImportPage'), 'ReferenceImportPage')
const DatasetsPage = lazyNamed(() => import('@/features/datasets/DatasetsPage'), 'DatasetsPage')
const PublicDatasetPage = lazyNamed(() => import('@/features/datasets/PublicDatasetPage'), 'PublicDatasetPage')
const RichEditorPage = lazyNamed(() => import('@/features/writing/RichEditorPage'), 'RichEditorPage')
const LibraryPage = lazyNamed(() => import('@/features/library/LibraryPage'), 'LibraryPage')
const ProjectResourcesPage = lazyNamed(() => import('@/features/library/ProjectResourcesPage'), 'ProjectResourcesPage')
const SavedSearchesPage = lazyNamed(() => import('@/features/savedSearches/SavedSearchesPage'), 'SavedSearchesPage')
const SearchPage = lazyNamed(() => import('@/features/search/SearchPage'), 'SearchPage')
const SettingsPage = lazyNamed(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const ResourcePickerPage = lazyNamed(() => import('@/features/picker/ResourcePickerPage'), 'ResourcePickerPage')
const ProjectCopyPage = lazyNamed(() => import('@/features/projects/ProjectCopyPage'), 'ProjectCopyPage')
const ProjectCreatePage = lazyNamed(() => import('@/features/projects/ProjectCreatePage'), 'ProjectCreatePage')
const ProjectIndexPage = lazyNamed(() => import('@/features/projects/ProjectIndexPage'), 'ProjectIndexPage')
const ProjectOverviewPage = lazyNamed(() => import('@/features/projects/ProjectOverviewPage'), 'ProjectOverviewPage')
const ProjectSettingsPage = lazyNamed(() => import('@/features/projects/ProjectSettingsPage'), 'ProjectSettingsPage')
const ComponentKit = lazyNamed(() => import('@/pages/ComponentKit'), 'ComponentKit')
const NotFoundPage = lazyNamed(() => import('@/pages/NotFoundPage'), 'NotFoundPage')
const PendingScreen = lazyNamed(() => import('@/pages/PendingScreen'), 'PendingScreen')

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
  '33': <DatasetsPage />,
  '34': <RichEditorPage />,
  '35': <SearchComparePage />,
  '36': <ReferenceImportPage />,
  '37': <TemplatesPage />,
  '38': <ExchangePage />,
  '39': <PublicDatasetPage />,
  '25': <ResearchListPage />,
  '40': <InterestPage />,
  '07p': <ResourcePickerPage />,
}

const pending = (screen: ScreenDef): RouteObject => ({
  path: screen.path,
  element: BUILT[screen.id] ?? <PendingScreen screen={screen} />,
  // A page that breaks while it is drawn shows the error inside its layout, which stays on the screen.
  errorElement: <RouteError />,
})

/**
 * Route table follows docs/design/navigation-map.md:
 *   public site  ·  account shell  ·  project shell (inside account shell)  ·  admin
 * Screens are swapped from placeholder to real page as each phase delivers them.
 */
const appRoutes: RouteObject[] = [
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

/** Everything sits under one route whose error page catches what a page's own error page does not (a layout that breaks). */
export const routes: RouteObject[] = [{ errorElement: <RouteError />, children: appRoutes }]

export const createAppRouter = () => createBrowserRouter(routes)
export const createTestRouter = (
  initialEntries: NonNullable<NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries']>,
) => createMemoryRouter(routes, { initialEntries })
