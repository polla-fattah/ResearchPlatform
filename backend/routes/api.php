<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\CorpusController;
use App\Http\Controllers\Api\LibraryController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\EvidenceController;
use App\Http\Controllers\Api\FindingController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\PublishingController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\CollaborationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\SearchWorkspaceController;
use App\Http\Controllers\Api\AnalysisController;
use App\Http\Controllers\Api\EditorialController;
use App\Http\Controllers\Api\HadithFamilyController;
use App\Http\Controllers\Api\IlalCaseController;
use App\Http\Controllers\Api\TeacherAssessmentController;
use App\Http\Controllers\Api\HistoricalAssertionController;
use App\Http\Controllers\Api\ArgumentationController;
use App\Http\Controllers\Api\ProjectTemplateController;
use App\Http\Controllers\Api\CollaborationRequestController;
use App\Http\Controllers\Api\GeospatialController;
use App\Http\Controllers\Api\ReferenceImportController;
use App\Http\Controllers\Api\SearchSubscriptionController;
use App\Http\Controllers\Api\HomeController;

Route::prefix('v1')->group(function () {

    // ------------------------------------------------------------------------
    // Public Research Announcements & Peer-Reviewed Publications Portal (API-13)
    // ------------------------------------------------------------------------
    Route::prefix('public')->group(function () {
        Route::get('/announcements', [PublishingController::class, 'listPublicAnnouncements']);
        Route::get('/announcements/{slug}', [PublishingController::class, 'getPublicAnnouncement']);
        Route::post('/announcements/{slug}/collaboration-requests', [CollaborationRequestController::class, 'storePublic']);
        Route::get('/research', [EditorialController::class, 'listPublicResearch']);
        Route::get('/research/{slug}', [EditorialController::class, 'getPublicResearch']);
        Route::get('/research/{slug}/cite', [EditorialController::class, 'citationExport']);
        Route::get('/researchers', [PublishingController::class, 'listPublicResearchers']);
        Route::get('/researchers/{id}', [PublishingController::class, 'getPublicResearcher']);
    });

    // ------------------------------------------------------------------------
    // Public Canonical Corpus Adapter (API-6)
    // ------------------------------------------------------------------------
    Route::prefix('corpus')->group(function () {
        Route::get('/search', [CorpusController::class, 'search']);
        Route::get('/filters/coverage', [CorpusController::class, 'filterCoverage']);
        Route::get('/narrators', [CorpusController::class, 'listNarrators']);
        Route::get('/authors', [CorpusController::class, 'listAuthors']);
        Route::get('/hukms', [CorpusController::class, 'listHukms']);
        Route::get('/critics', [CorpusController::class, 'listCritics']);
        Route::get('/hadiths/{id}', [CorpusController::class, 'getHadith']);
        Route::get('/hadiths/{id}/occurrences', [CorpusController::class, 'getHadithOccurrences']);
        Route::get('/narrators/{id}', [CorpusController::class, 'getNarrator']);
        Route::get('/narrators/{id}/criticism', [CorpusController::class, 'getNarratorCriticism']);
        Route::get('/narrators/{id}/teachers', [CorpusController::class, 'getNarratorTeachers']);
        Route::get('/narrators/{id}/students', [CorpusController::class, 'getNarratorStudents']);
        Route::get('/books', [CorpusController::class, 'getBooks']);
        Route::get('/books/{id}', [CorpusController::class, 'getBook']);
        Route::get('/books/{id}/structure', [CorpusController::class, 'bookStructure']);
        Route::get('/books/{id}/chapters', [CorpusController::class, 'listBookChapters']);
        Route::get('/concordance', [CorpusController::class, 'concordance']);
        Route::get('/sanads/{id}', [CorpusController::class, 'getSanad']);
    });

    // ------------------------------------------------------------------------
    // Public Authentication & Verification Routes (API-1 / DEF-13)
    // ------------------------------------------------------------------------
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/email/verify', [AuthController::class, 'verifyEmail']);
        Route::post('/verify-email', [AuthController::class, 'verifyEmail']); // Spec alias
        Route::post('/email/resend', [AuthController::class, 'resendVerification']);
        Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
        Route::post('/password/reset', [AuthController::class, 'resetPassword']);
        Route::post('/mfa/challenge', [AuthController::class, 'mfaChallenge']);
    });

    // Unified applicant apply route (can be unauthenticated)
    Route::post('/applications', [ApplicationController::class, 'submit']);

    // Public invitation preview
    Route::get('/invitations/{token}', [CollaborationController::class, 'getInvitationPreview']);

    // ------------------------------------------------------------------------
    // Authenticated Researcher Routes
    // ------------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function () {
        // Identity, Profile & Security (API-2)
        Route::prefix('auth')->group(function () {
            Route::get('/me', [AuthController::class, 'me']);
            Route::match(['put', 'patch'], '/profile', [AuthController::class, 'updateProfile']);
            Route::post('/password/change', [AuthController::class, 'changePassword']);
            Route::get('/sessions', [AuthController::class, 'listSessions']);
            Route::delete('/sessions/{id}', [AuthController::class, 'revokeSession']);
            Route::delete('/sessions', [AuthController::class, 'revokeOtherSessions']);
            Route::post('/mfa/enroll', [AuthController::class, 'mfaEnroll']);
            Route::post('/mfa/confirm', [AuthController::class, 'mfaConfirm']);
            Route::post('/mfa/disable', [AuthController::class, 'mfaDisable']);
            Route::post('/account/close', [AuthController::class, 'closeAccount']);
            Route::post('/logout', [AuthController::class, 'logout']);
        });

        // Researcher Applications (API-1)
        Route::prefix('applications')->group(function () {
            Route::get('/my-status', [ApplicationController::class, 'myStatus']);
            Route::post('/respond', [ApplicationController::class, 'respond']);
        });

        // Researcher Routes requiring Approved Researcher Account (C-3 / DEF-6)
        Route::middleware('approved')->group(function () {
            // Home Dashboard & Cross-Project Lists (API-3)
            Route::get('/home', [HomeController::class, 'dashboard']);
            Route::get('/me/tasks', [HomeController::class, 'myTasks']);
            Route::get('/me/exports', [HomeController::class, 'myExports']);
            Route::get('/me/corpus-proposals', [HomeController::class, 'myCorpusProposals']);

            // User lookup for invitations (API-11)
            Route::get('/users/search', [CollaborationController::class, 'searchUsers']);

        // Module 3: Personal Library ("My Library") (API-5)
        Route::prefix('library')->group(function () {
            Route::get('/items', [LibraryController::class, 'index']);
            Route::post('/items', [LibraryController::class, 'store']);
            Route::get('/tags', [LibraryController::class, 'tags']);
            Route::get('/items/{id}', [LibraryController::class, 'show']);
            Route::match(['put', 'patch'], '/items/{id}', [LibraryController::class, 'update']);
            Route::put('/items/{id}/tags', [LibraryController::class, 'updateTags']);
            Route::post('/items/{id}/share-preview', [LibraryController::class, 'sharePreview']);
            Route::post('/items/{id}/add-to-projects', [LibraryController::class, 'addToProjects']);
            Route::delete('/items/{id}', [LibraryController::class, 'destroy']);

            Route::get('/collections', [LibraryController::class, 'collections']);
            Route::post('/collections', [LibraryController::class, 'storeCollection']);
            Route::match(['put', 'patch'], '/collections/{id}', [LibraryController::class, 'updateCollection']);
            Route::delete('/collections/{id}', [LibraryController::class, 'destroyCollection']);
            Route::post('/collections/{id}/items', [LibraryController::class, 'addToCollection']);
            Route::delete('/collections/{id}/items/{resourceId}', [LibraryController::class, 'removeFromCollection']);

            // BibTeX / RIS Ingestion (LIB-10)
            Route::post('/bibtex/preview', [ReferenceImportController::class, 'previewBibTeX']);
            Route::post('/bibtex/import', [ReferenceImportController::class, 'importBibTeX']);
        });

        // Personal Saved Searches (API-6)
        Route::prefix('saved-searches')->group(function () {
            Route::get('/', [SearchWorkspaceController::class, 'listPersonalSavedSearches']);
            Route::post('/', [SearchWorkspaceController::class, 'storePersonalSavedSearch']);
            Route::match(['put', 'patch'], '/{id}', [SearchWorkspaceController::class, 'updatePersonalSavedSearch']);
            Route::delete('/{id}', [SearchWorkspaceController::class, 'destroyPersonalSavedSearch']);
        });

        // Global Exports (API-9)
        Route::prefix('exports')->group(function () {
            Route::get('/', [ExportController::class, 'listAllExports']);
            Route::post('/', [ExportController::class, 'createExport']);
            Route::post('/preview', [ExportController::class, 'exportPreview']);
            Route::get('/quota', [ExportController::class, 'getQuota']);
            Route::get('/{id}', [ExportController::class, 'getExport']);
            Route::post('/{id}/cancel', [ExportController::class, 'cancelExport']);
            Route::post('/{id}/retry', [ExportController::class, 'retryExport']);
            Route::get('/{id}/manifest', [ExportController::class, 'getManifest']);
            Route::get('/{id}/parts/{partId}/download', [ExportController::class, 'downloadPart']);
            Route::get('/{id}/parts/{partId}', [ExportController::class, 'downloadPart']);
        });

        // PRJ-08: Project Templates
        Route::prefix('project-templates')->group(function () {
            Route::get('/', [ProjectTemplateController::class, 'index']);
            Route::get('/{id}', [ProjectTemplateController::class, 'show']);
            Route::post('/{id}/instantiate', [ProjectTemplateController::class, 'instantiate']);
        });

        // ANA-13: Geospatial Networks & Trajectories
        Route::prefix('geospatial')->group(function () {
            Route::get('/places', [GeospatialController::class, 'getPlaces']);
            Route::get('/narrators/{id}/trajectory', [GeospatialController::class, 'getNarratorTrajectory']);
            Route::post('/trajectories', [GeospatialController::class, 'recordTrajectory']);
            Route::post('/isnad-flow', [GeospatialController::class, 'getIsnadGeographicFlow']);
        });

        // Module 4: Research Projects & Workspace (API-4)
        Route::prefix('projects')->group(function () {
            Route::get('/', [ProjectController::class, 'index']);
            Route::post('/', [ProjectController::class, 'store']);
            Route::post('/import-package', [ExportController::class, 'importProjectPackage']); // EXP-11
            Route::get('/{id}', [ProjectController::class, 'show']);
            Route::match(['put', 'patch'], '/{id}', [ProjectController::class, 'update']);
            Route::patch('/{id}/stage', [ProjectController::class, 'updateStage']);
            Route::post('/{id}/archive', [ProjectController::class, 'toggleArchive']);
            Route::post('/{id}/restore', [ProjectController::class, 'restore']);
            Route::post('/{id}/leave', [ProjectController::class, 'leave']);
            Route::get('/{id}/summary', [ProjectController::class, 'summary']);
            Route::get('/{id}/roles', [CollaborationController::class, 'getProjectRoles']);
            Route::delete('/{id}', [ProjectController::class, 'destroy']);

            Route::get('/{id}/members', [ProjectController::class, 'members']);
            Route::post('/{id}/members', [ProjectController::class, 'addMember']);
            Route::patch('/{id}/members/{userId}', [ProjectController::class, 'updateMember']);
            Route::delete('/{id}/members/{userId}', [CollaborationController::class, 'removeMember']);

            // Milestones & Questions (API-4)
            Route::get('/{id}/milestones', [ProjectController::class, 'listMilestones']);
            Route::post('/{id}/milestones', [ProjectController::class, 'storeMilestone']);
            Route::match(['put', 'patch'], '/{id}/milestones/{milestoneId}', [ProjectController::class, 'updateMilestone']);
            Route::delete('/{id}/milestones/{milestoneId}', [ProjectController::class, 'destroyMilestone']);

            Route::get('/{id}/questions', [ProjectController::class, 'listQuestions']);
            Route::post('/{id}/questions', [ProjectController::class, 'storeQuestion']);
            Route::match(['put', 'patch'], '/{id}/questions/{questionId}', [ProjectController::class, 'updateQuestion']);
            Route::delete('/{id}/questions/{questionId}', [ProjectController::class, 'destroyQuestion']);

            // Copy & Transfer (API-4 / API-11)
            Route::post('/{id}/copy-preview', [ProjectController::class, 'copyPreview']);
            Route::post('/{id}/copy', [ProjectController::class, 'copy']);
            Route::post('/{id}/transfer', [ProjectController::class, 'transfer']);
            Route::post('/{id}/transfer/accept', [ProjectController::class, 'acceptTransfer']);
            Route::post('/{id}/transfer/decline', [ProjectController::class, 'declineTransfer']);
        });

        // Project Workspace Context Endpoints
        Route::prefix('projects/{projectId}')->group(function () {
            // Module 5 (Saved Searches & Search Runs)
            Route::get('/searches', [SearchWorkspaceController::class, 'index']);
            Route::post('/searches', [SearchWorkspaceController::class, 'store']);
            Route::get('/searches/{queryId}', [SearchWorkspaceController::class, 'show']);
            Route::match(['put', 'patch'], '/searches/{queryId}', [SearchWorkspaceController::class, 'update']);
            Route::delete('/searches/{queryId}', [SearchWorkspaceController::class, 'destroy']);
            Route::post('/searches/{queryId}/run', [SearchWorkspaceController::class, 'run']);

            Route::get('/search-runs', [SearchWorkspaceController::class, 'listSearchRuns']);
            Route::get('/search-runs/{runId}', [SearchWorkspaceController::class, 'getSearchRun']);
            Route::post('/search-runs/{runId}/cancel', [SearchWorkspaceController::class, 'cancelSearchRun']);
            Route::post('/search-runs/{runId}/retry', [SearchWorkspaceController::class, 'retrySearchRun']);
            Route::post('/search-runs/compare', [SearchWorkspaceController::class, 'compareRuns']);

            Route::get('/result-sets', [SearchWorkspaceController::class, 'listResultSets']);
            Route::post('/result-sets', [SearchWorkspaceController::class, 'storeResultSet']);
            Route::get('/result-sets/{setId}', [SearchWorkspaceController::class, 'getResultSet']);

            // Project Resource Collections (API-5)
            Route::get('/resource-collections', [LibraryController::class, 'listProjectCollections']);
            Route::post('/resource-collections', [LibraryController::class, 'storeProjectCollection']);
            Route::post('/resource-collections/{collectionId}/items', [LibraryController::class, 'addItemToProjectCollection']);
            Route::delete('/resource-collections/{collectionId}/items/{resourceId}', [LibraryController::class, 'removeItemFromProjectCollection']);
            Route::delete('/resource-collections/{collectionId}', [LibraryController::class, 'destroyProjectCollection']);

            // SEA-09 & SEA-10: Search Subscriptions
            Route::get('/search-subscriptions', [SearchSubscriptionController::class, 'index']);
            Route::post('/search-subscriptions', [SearchSubscriptionController::class, 'store']);
            Route::patch('/search-subscriptions/{id}/toggle', [SearchSubscriptionController::class, 'toggle']);

            // Module 7 (Analysis Workbench & R2a Algorithmic Engines)
            Route::post('/analyses/matn-compare', [AnalysisController::class, 'matnCompare']);
            Route::post('/analyses/isnad-compare', [AnalysisController::class, 'isnadCompare']);
            Route::post('/analyses/criticism-matrix', [AnalysisController::class, 'criticismMatrix']);
            Route::post('/analyses/collate', [AnalysisController::class, 'collate']);
            Route::post('/analyses/isnad-topology', [AnalysisController::class, 'isnadTopology']);
            Route::post('/analyses/temporal-check', [AnalysisController::class, 'temporalCheck']);
            Route::get('/analyses', [AnalysisController::class, 'index']);
            Route::post('/analyses/save', [AnalysisController::class, 'save']);
            Route::get('/analyses/{analysisId}', [AnalysisController::class, 'show']);
            Route::delete('/analyses/{analysisId}', [AnalysisController::class, 'destroy']);

            // Release 2: Hadith Families & Mutaba'at / Shawahid (ANA-08)
            Route::get('/families', [HadithFamilyController::class, 'index']);
            Route::post('/families', [HadithFamilyController::class, 'store']);
            Route::match(['put', 'patch'], '/families/{familyId}', [HadithFamilyController::class, 'update']);
            Route::delete('/families/{familyId}', [HadithFamilyController::class, 'destroy']);
            Route::post('/families/{familyId}/members', [HadithFamilyController::class, 'addMember']);
            Route::delete('/families/{familyId}/members/{memberId}', [HadithFamilyController::class, 'removeMember']);

            // Release 2: 'Ilal Case Dossiers (ANA-09)
            Route::get('/ilal-cases', [IlalCaseController::class, 'index']);
            Route::post('/ilal-cases', [IlalCaseController::class, 'store']);
            Route::get('/ilal-cases/{caseId}', [IlalCaseController::class, 'show']);
            Route::match(['put', 'patch'], '/ilal-cases/{caseId}', [IlalCaseController::class, 'update']);

            // Release 2: Teacher-Specific Narrator Assessments (ANA-11)
            Route::get('/narrator-assessments', [TeacherAssessmentController::class, 'index']);
            Route::post('/narrator-assessments', [TeacherAssessmentController::class, 'store']);

            // EVI-08: Historical Assertions
            Route::get('/assertions', [HistoricalAssertionController::class, 'index']);
            Route::post('/assertions', [HistoricalAssertionController::class, 'store']);
            Route::get('/assertions/{id}', [HistoricalAssertionController::class, 'show']);
            Route::match(['put', 'patch'], '/assertions/{id}', [HistoricalAssertionController::class, 'update']);
            Route::delete('/assertions/{id}', [HistoricalAssertionController::class, 'destroy']);

            // WRT-08: Structured Argumentation Graph
            Route::get('/argument-graph', [ArgumentationController::class, 'getGraph']);
            Route::post('/argument-nodes', [ArgumentationController::class, 'createNode']);
            Route::match(['put', 'patch'], '/argument-nodes/{nodeId}', [ArgumentationController::class, 'updateNode']);
            Route::delete('/argument-nodes/{nodeId}', [ArgumentationController::class, 'deleteNode']);
            Route::post('/argument-edges', [ArgumentationController::class, 'createEdge']);
            Route::delete('/argument-edges/{edgeId}', [ArgumentationController::class, 'deleteEdge']);

            // ANN-06: Collaboration Interest Requests
            Route::post('/collaboration-requests', [CollaborationRequestController::class, 'store']);
            Route::get('/collaboration-requests', [CollaborationRequestController::class, 'index']);
            Route::patch('/collaboration-requests/{requestId}', [CollaborationRequestController::class, 'updateStatus']);

            // Project Resources (Bibliography) & BibTeX/RIS Import (LIB-10)
            Route::get('/resources', [EvidenceController::class, 'listResources']);
            Route::post('/resources', [EvidenceController::class, 'attachResource']);
            Route::post('/resources/bulk', [EvidenceController::class, 'bulkAddResources']);
            Route::delete('/resources/{resourceId}', [EvidenceController::class, 'detachResource']);
            Route::post('/references/preview-bibtex', [ReferenceImportController::class, 'previewBibTeX']);
            Route::post('/references/import-bibtex', [ReferenceImportController::class, 'importBibTeX']);

            // EXP-05: Graph Network Export
            Route::get('/exports/graph', [ExportController::class, 'exportGraph']);

            // Evidence Items & Annotations (API-7)
            Route::get('/evidence', [EvidenceController::class, 'index']);
            Route::post('/evidence', [EvidenceController::class, 'store']);
            Route::post('/evidence/bulk', [EvidenceController::class, 'bulkAddEvidence']);
            Route::get('/evidence/{id}', [EvidenceController::class, 'show']);
            Route::match(['put', 'patch'], '/evidence/{id}', [EvidenceController::class, 'update']);
            Route::delete('/evidence/{id}', [EvidenceController::class, 'destroy']);
            Route::get('/evidence/{id}/history', [EvidenceController::class, 'getHistory']);
            Route::get('/evidence/{id}/dependencies', [EvidenceController::class, 'getDependencies']);
            Route::get('/evidence/{id}/annotations', [EvidenceController::class, 'listAnnotations']);
            Route::post('/evidence/{id}/annotations', [EvidenceController::class, 'addAnnotation']);
            Route::match(['put', 'patch'], '/evidence/{id}/annotations/{annotationId}', [EvidenceController::class, 'updateAnnotation']);
            Route::delete('/evidence/{id}/annotations/{annotationId}', [EvidenceController::class, 'deleteAnnotation']);

            // Module 6: Findings, Claims & Synthesis
            Route::get('/findings', [FindingController::class, 'index']);
            Route::post('/findings', [FindingController::class, 'store']);
            Route::get('/findings/{id}', [FindingController::class, 'show']);
            Route::match(['put', 'patch'], '/findings/{id}', [FindingController::class, 'update']);
            Route::delete('/findings/{id}', [FindingController::class, 'destroy']);
            Route::post('/findings/{id}/evidence', [FindingController::class, 'linkEvidence']);
            Route::delete('/findings/{id}/evidence/{evidenceId}', [FindingController::class, 'unlinkEvidence']);

            // Documents, Drafting, Autosave, Citations & Findings (API-8)
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::get('/documents/{id}', [DocumentController::class, 'show']);
            Route::match(['put', 'patch'], '/documents/{id}', [DocumentController::class, 'update']);
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
            Route::put('/documents/{id}/draft', [DocumentController::class, 'saveDraft']);
            Route::get('/documents/{id}/draft', [DocumentController::class, 'getDraft']);
            Route::post('/documents/{id}/versions', [DocumentController::class, 'createVersion']);
            Route::get('/documents/{id}/versions', [DocumentController::class, 'listVersions']);
            Route::get('/documents/{id}/versions/{versionNumber}', [DocumentController::class, 'getVersion']);
            Route::post('/documents/{id}/versions/{versionNumber}/restore', [DocumentController::class, 'restoreVersion']);
            Route::post('/documents/{id}/cite', [DocumentController::class, 'cite']);
            Route::post('/documents/{id}/findings/{findingId}', [DocumentController::class, 'linkFinding']);
            Route::delete('/documents/{id}/findings/{findingId}', [DocumentController::class, 'unlinkFinding']);

            // Announcements & Submissions (API-13)
            Route::get('/announcement', [PublishingController::class, 'getAnnouncement']);
            Route::post('/announcement', [PublishingController::class, 'saveAnnouncement']);
            Route::post('/announcement/publish', [PublishingController::class, 'publishAnnouncement']);
            Route::post('/announcement/unpublish', [PublishingController::class, 'unpublishAnnouncement']);
            Route::get('/announcement/history', [PublishingController::class, 'announcementHistory']);
            Route::post('/validate-pre-publication', [PublishingController::class, 'validatePrePublication']);
            Route::get('/submissions', [PublishingController::class, 'listSubmissions']);
            Route::post('/submissions', [PublishingController::class, 'createSubmission']);
            Route::get('/submissions/{id}', [PublishingController::class, 'getSubmission']);

            // Project Exports
            Route::post('/exports', [ExportController::class, 'requestProjectExport']);
            Route::get('/exports', [ExportController::class, 'listProjectExports']);
            Route::get('/exports/{id}/download', [ExportController::class, 'downloadExport']);

            // R1b: Collaboration, Invitations, Discussions, Tasks & Activity
            Route::get('/invitations', [CollaborationController::class, 'listInvitations']);
            Route::post('/invitations', [CollaborationController::class, 'createInvitation']);
            Route::post('/invitations/{invitationId}/resend', [CollaborationController::class, 'resendInvitation']);
            Route::delete('/invitations/{invitationId}', [CollaborationController::class, 'destroyInvitation']);
            Route::put('/members/{userId}', [CollaborationController::class, 'updateMemberRole']);
            Route::delete('/members/{userId}', [CollaborationController::class, 'removeMember']);

            Route::get('/discussions', [CollaborationController::class, 'listDiscussions']);
            Route::post('/discussions', [CollaborationController::class, 'createDiscussion']);
            Route::get('/threads', [CollaborationController::class, 'listDiscussions']);
            Route::post('/threads', [CollaborationController::class, 'createDiscussion']);

            Route::get('/tasks', [CollaborationController::class, 'listTasks']);
            Route::post('/tasks', [CollaborationController::class, 'createTask']);
            Route::match(['put', 'patch'], '/tasks/{taskId}', [CollaborationController::class, 'updateTask']);
            Route::post('/tasks/{taskId}/complete', [CollaborationController::class, 'completeTask']);
            Route::post('/tasks/{taskId}/block', [CollaborationController::class, 'blockTask']);

            Route::get('/activity', [CollaborationController::class, 'listActivity']);
            Route::post('/documents/{docId}/lock', [CollaborationController::class, 'acquireDocumentLock']);
            Route::post('/documents/{docId}/unlock', [CollaborationController::class, 'releaseDocumentLock']);
        });

        // R1b: Global Invitation Responses & Discussion Comments
        Route::post('/invitations/{token}/accept', [CollaborationController::class, 'acceptInvitation']);
        Route::post('/invitations/{token}/decline', [CollaborationController::class, 'declineInvitation']);
        Route::get('/discussions/{threadId}/comments', [CollaborationController::class, 'listComments']);
        Route::post('/discussions/{threadId}/comments', [CollaborationController::class, 'addComment']);
        Route::post('/discussions/{threadId}/resolve', [CollaborationController::class, 'resolveDiscussion']);
        Route::post('/discussions/{threadId}/reopen', [CollaborationController::class, 'reopenDiscussion']);
        Route::post('/threads/{threadId}/reopen', [CollaborationController::class, 'reopenDiscussion']);

        // R1b: Notification Center & Preferences (API-12)
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
            Route::patch('/{id}/read', [NotificationController::class, 'markAsRead']);
            Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
            Route::get('/preferences', [NotificationController::class, 'getPreferences']);
            Route::match(['put', 'patch'], '/preferences', [NotificationController::class, 'updatePreferences']);
        });

        // Reviewer Portal Endpoints (API-14 / DEF-7)
        Route::prefix('reviews')->group(function () {
            Route::get('/assignments', [EditorialController::class, 'listReviewerAssignments']);
            Route::get('/assignments/{id}', [EditorialController::class, 'getReviewerAssignment']);
            Route::post('/assignments/{id}/coi-declaration', [EditorialController::class, 'declareCoi']);
            Route::post('/assignments/{id}/accept', [EditorialController::class, 'acceptAssignment']);
            Route::post('/assignments/{id}/decline', [EditorialController::class, 'declineAssignment']);
            Route::post('/assignments/{id}/recommendation', [EditorialController::class, 'submitReview']);
        });

        // Module 10: Editorial Review & Peer-Reviewed Publishing Workflow (API-14 / DEF-7)
        Route::prefix('editor')->group(function () {
            Route::get('/submissions', [EditorialController::class, 'submissions']);
            Route::get('/submissions/{id}', [EditorialController::class, 'getSubmission']);
            Route::get('/submissions/{id}/reviewer-candidates', [EditorialController::class, 'getReviewerCandidates']);
            Route::post('/submissions/{id}/assign', [EditorialController::class, 'assignReviewer']);
            Route::post('/submissions/{id}/review', [EditorialController::class, 'submitReview']);
            Route::post('/submissions/{id}/decision', [EditorialController::class, 'decide']);
            Route::post('/submissions/{id}/release', [EditorialController::class, 'releasePublication']);
            Route::post('/publications/{id}/corrigenda', [EditorialController::class, 'addCorrigendum']);
            Route::post('/publications/{id}/retract', [EditorialController::class, 'retractPublication']);
        });

        // Researcher Support Grants (API-10)
        Route::get('/researcher/support-grants', [AdminController::class, 'listResearcherSupportGrants']);
        Route::post('/researcher/support-grants', [AdminController::class, 'createSupportGrant']);
        Route::delete('/researcher/support-grants/{id}', [AdminController::class, 'destroySupportGrant']);

        // Corpus Errata Proposals
        Route::post('/corpus/proposals', [AdminController::class, 'submitCorpusProposal']);

        // Administrative & Governance Control (API-10)
        Route::prefix('admin')->group(function () {
            Route::get('/users', [AdminController::class, 'users']);
            Route::patch('/users/{id}/roles', [AdminController::class, 'updateUserRoles']);
            Route::patch('/users/{id}/status', [AdminController::class, 'updateUserStatus']);
            Route::get('/applications', [AdminController::class, 'applications']);
            Route::post('/applications/{id}/decide', [AdminController::class, 'decideApplication']);
            Route::get('/closures', [AdminController::class, 'listClosures']);
            Route::post('/closures/{id}/decide', [AdminController::class, 'decideClosure']);
            Route::get('/limits', [AdminController::class, 'getLimits']);
            Route::match(['put', 'patch'], '/limits', [AdminController::class, 'updateLimits']);
            Route::get('/support-grants', [AdminController::class, 'listSupportGrants']);
            Route::get('/jobs', [AdminController::class, 'listJobs']);
            Route::post('/jobs/{id}/retry', [AdminController::class, 'retryJob']);
            Route::get('/ops', [AdminController::class, 'systemOps']);
            Route::get('/rights-flags', [AdminController::class, 'listRightsFlags']);
            Route::get('/reports', [AdminController::class, 'listReports']);
            Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
            Route::get('/corpus/proposals', [AdminController::class, 'listCorpusProposals']);
            Route::post('/corpus/proposals/{id}/decide', [AdminController::class, 'decideCorpusProposal']);
        });
        });
    });

});
