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

Route::prefix('v1')->group(function () {

    // ------------------------------------------------------------------------
    // Public Research Announcements & Peer-Reviewed Publications Portal
    // ------------------------------------------------------------------------
    Route::prefix('public')->group(function () {
        Route::get('/announcements', [PublishingController::class, 'listPublicAnnouncements']);
        Route::get('/announcements/{slug}', [PublishingController::class, 'getPublicAnnouncement']);
        Route::get('/research', [EditorialController::class, 'listPublicResearch']);
        Route::get('/research/{slug}', [EditorialController::class, 'getPublicResearch']);
        Route::get('/research/{slug}/cite', [EditorialController::class, 'citationExport']);
    });

    // ------------------------------------------------------------------------
    // Public Canonical Corpus Adapter (Read-Only)
    // ------------------------------------------------------------------------
    Route::prefix('corpus')->group(function () {
        Route::get('/search', [CorpusController::class, 'search']);
        Route::get('/hadiths/{id}', [CorpusController::class, 'getHadith']);
        Route::get('/hadiths/{id}/occurrences', [CorpusController::class, 'getHadithOccurrences']);
        Route::get('/narrators/{id}', [CorpusController::class, 'getNarrator']);
        Route::get('/narrators/{id}/criticism', [CorpusController::class, 'getNarratorCriticism']);
        Route::get('/narrators/{id}/teachers', [CorpusController::class, 'getNarratorTeachers']);
        Route::get('/narrators/{id}/students', [CorpusController::class, 'getNarratorStudents']);
        Route::get('/books', [CorpusController::class, 'getBooks']);
        Route::get('/books/{id}', [CorpusController::class, 'getBook']);
        Route::get('/sanads/{id}', [CorpusController::class, 'getSanad']);
    });

    // ------------------------------------------------------------------------
    // Public Authentication Routes
    // ------------------------------------------------------------------------
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });

    // ------------------------------------------------------------------------
    // Authenticated Researcher Routes
    // ------------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function () {
        // Identity & Profile
        Route::prefix('auth')->group(function () {
            Route::get('/me', [AuthController::class, 'me']);
            Route::match(['put', 'patch'], '/profile', [AuthController::class, 'updateProfile']);
            Route::post('/logout', [AuthController::class, 'logout']);
        });

        // Researcher Applications
        Route::prefix('applications')->group(function () {
            Route::post('/', [ApplicationController::class, 'submit']);
            Route::get('/my-status', [ApplicationController::class, 'myStatus']);
        });

        // Module 3: Personal Library ("My Library")
        Route::prefix('library')->group(function () {
            Route::get('/items', [LibraryController::class, 'index']);
            Route::post('/items', [LibraryController::class, 'store']);
            Route::get('/items/{id}', [LibraryController::class, 'show']);
            Route::match(['put', 'patch'], '/items/{id}', [LibraryController::class, 'update']);
            Route::delete('/items/{id}', [LibraryController::class, 'destroy']);

            Route::get('/collections', [LibraryController::class, 'collections']);
            Route::post('/collections', [LibraryController::class, 'storeCollection']);
            Route::post('/collections/{id}/items', [LibraryController::class, 'addToCollection']);
            Route::delete('/collections/{id}/items/{resourceId}', [LibraryController::class, 'removeFromCollection']);
        });

        // Module 4: Research Projects & Workspace
        Route::prefix('projects')->group(function () {
            Route::get('/', [ProjectController::class, 'index']);
            Route::post('/', [ProjectController::class, 'store']);
            Route::get('/{id}', [ProjectController::class, 'show']);
            Route::match(['put', 'patch'], '/{id}', [ProjectController::class, 'update']);
            Route::patch('/{id}/stage', [ProjectController::class, 'updateStage']);
            Route::post('/{id}/archive', [ProjectController::class, 'toggleArchive']);
            Route::delete('/{id}', [ProjectController::class, 'destroy']);

            Route::get('/{id}/members', [ProjectController::class, 'members']);
            Route::post('/{id}/members', [ProjectController::class, 'addMember']);
            Route::patch('/{id}/members/{userId}', [ProjectController::class, 'updateMember']);
            Route::delete('/{id}/members/{userId}', [ProjectController::class, 'removeMember']);
        });

        // Project Workspace Context Endpoints
        Route::prefix('projects/{projectId}')->group(function () {
            // Module 5 (Saved Searches & Result Sets)
            Route::get('/searches', [SearchWorkspaceController::class, 'index']);
            Route::post('/searches', [SearchWorkspaceController::class, 'store']);
            Route::get('/searches/{queryId}', [SearchWorkspaceController::class, 'show']);
            Route::post('/searches/{queryId}/run', [SearchWorkspaceController::class, 'run']);
            Route::get('/result-sets', [SearchWorkspaceController::class, 'listResultSets']);
            Route::post('/result-sets', [SearchWorkspaceController::class, 'storeResultSet']);
            Route::get('/result-sets/{setId}', [SearchWorkspaceController::class, 'getResultSet']);

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

            // Release 2: Hadith Families & Mutaba'at / Shawahid (ANA-08)
            Route::get('/families', [HadithFamilyController::class, 'index']);
            Route::post('/families', [HadithFamilyController::class, 'store']);
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

            // Project Resources (Bibliography)
            Route::get('/resources', [EvidenceController::class, 'listResources']);
            Route::post('/resources', [EvidenceController::class, 'attachResource']);
            Route::delete('/resources/{resourceId}', [EvidenceController::class, 'detachResource']);

            // Evidence Items & Annotations
            Route::get('/evidence', [EvidenceController::class, 'index']);
            Route::post('/evidence', [EvidenceController::class, 'store']);
            Route::get('/evidence/{id}', [EvidenceController::class, 'show']);
            Route::match(['put', 'patch'], '/evidence/{id}', [EvidenceController::class, 'update']);
            Route::delete('/evidence/{id}', [EvidenceController::class, 'destroy']);
            Route::post('/evidence/{id}/annotations', [EvidenceController::class, 'addAnnotation']);

            // Module 6: Findings, Claims & Synthesis
            Route::get('/findings', [FindingController::class, 'index']);
            Route::post('/findings', [FindingController::class, 'store']);
            Route::get('/findings/{id}', [FindingController::class, 'show']);
            Route::match(['put', 'patch'], '/findings/{id}', [FindingController::class, 'update']);
            Route::delete('/findings/{id}', [FindingController::class, 'destroy']);
            Route::post('/findings/{id}/evidence', [FindingController::class, 'linkEvidence']);
            Route::delete('/findings/{id}/evidence/{evidenceId}', [FindingController::class, 'unlinkEvidence']);

            // Documents, Drafting & Versioning
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::get('/documents/{id}', [DocumentController::class, 'show']);
            Route::match(['put', 'patch'], '/documents/{id}', [DocumentController::class, 'update']);
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
            Route::post('/documents/{id}/versions', [DocumentController::class, 'createVersion']);
            Route::get('/documents/{id}/versions', [DocumentController::class, 'listVersions']);
            Route::get('/documents/{id}/versions/{versionNumber}', [DocumentController::class, 'getVersion']);

            // Announcements & Submissions
            Route::get('/announcement', [PublishingController::class, 'getAnnouncement']);
            Route::post('/announcement', [PublishingController::class, 'saveAnnouncement']);
            Route::post('/announcement/publish', [PublishingController::class, 'publishAnnouncement']);
            Route::post('/validate-pre-publication', [PublishingController::class, 'validatePrePublication']);
            Route::get('/submissions', [PublishingController::class, 'listSubmissions']);
            Route::post('/submissions', [PublishingController::class, 'createSubmission']);
            Route::get('/submissions/{id}', [PublishingController::class, 'getSubmission']);

            // Exports & Packaging
            Route::post('/exports', [ExportController::class, 'requestProjectExport']);
            Route::get('/exports', [ExportController::class, 'listProjectExports']);
            Route::get('/exports/{id}/download', [ExportController::class, 'downloadExport']);

            // R1b: Collaboration, Invitations, Discussions, Tasks & Activity
            Route::get('/invitations', [CollaborationController::class, 'listInvitations']);
            Route::post('/invitations', [CollaborationController::class, 'createInvitation']);
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

        // R1b: Notification Center & Preferences
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::patch('/{id}/read', [NotificationController::class, 'markAsRead']);
            Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
            Route::get('/preferences', [NotificationController::class, 'getPreferences']);
            Route::match(['put', 'patch'], '/preferences', [NotificationController::class, 'updatePreferences']);
        });

        // Module 10: Editorial Review & Peer-Reviewed Publishing Workflow
        Route::prefix('editor')->group(function () {
            Route::get('/submissions', [EditorialController::class, 'submissions']);
            Route::post('/submissions/{id}/assign', [EditorialController::class, 'assignReviewer']);
            Route::post('/submissions/{id}/review', [EditorialController::class, 'submitReview']);
            Route::post('/submissions/{id}/decision', [EditorialController::class, 'decide']);
            Route::post('/submissions/{id}/release', [EditorialController::class, 'releasePublication']);
            Route::post('/publications/{id}/corrigenda', [EditorialController::class, 'addCorrigendum']);
            Route::post('/publications/{id}/retract', [EditorialController::class, 'retractPublication']);
        });

        // Corpus Errata Proposals
        Route::post('/corpus/proposals', [AdminController::class, 'submitCorpusProposal']);

        // Administrative & Governance Control
        Route::prefix('admin')->group(function () {
            Route::get('/users', [AdminController::class, 'users']);
            Route::patch('/users/{id}/status', [AdminController::class, 'updateUserStatus']);
            Route::get('/applications', [AdminController::class, 'applications']);
            Route::post('/applications/{id}/decide', [AdminController::class, 'decideApplication']);
            Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
            Route::get('/corpus/proposals', [AdminController::class, 'listCorpusProposals']);
            Route::post('/corpus/proposals/{id}/decide', [AdminController::class, 'decideCorpusProposal']);
        });
    });

});
