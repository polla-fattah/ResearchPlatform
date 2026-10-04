<?php

namespace App\Services;

use App\Models\ResearchProject;
use App\Models\Document;
use App\Models\EvidenceItem;
use App\Models\User;

class PublicationValidationService
{
    /**
     * Validate pre-publication requirements for a research project submission package (WRT-07, PUB-12).
     *
     * @return array [bool $isValid, array $issues]
     */
    public function validateForSubmission(ResearchProject $project, array $documentIds = []): array
    {
        $issues = [];

        // 1. Fetch documents
        $documents = Document::where('project_id', $project->id)
            ->when(!empty($documentIds), fn($q) => $q->whereIn('id', $documentIds))
            ->with(['latestVersion.citations'])
            ->get();

        if ($documents->isEmpty()) {
            $issues[] = [
                'code' => 'NO_DOCUMENTS',
                'severity' => 'warning',
                'message' => 'The submission does not include any drafted documents. Only project findings and metadata will be included.',
            ];
        }

        // 2. Check for private/unresolved citations (WRT-07)
        foreach ($documents as $doc) {
            $latestVersion = $doc->latestVersion;
            if (!$latestVersion) {
                $issues[] = [
                    'code' => 'DOCUMENT_NO_VERSION',
                    'severity' => 'error',
                    'message' => "Document '{$doc->title}' has no saved versions.",
                ];
                continue;
            }

            foreach ($latestVersion->citations as $citation) {
                // If citation points to private evidence item
                if ($citation->evidence_id) {
                    $evidence = EvidenceItem::find($citation->evidence_id);
                    if ($evidence && $evidence->status === 'unresolved') {
                        $issues[] = [
                            'code' => 'UNRESOLVED_EVIDENCE_DEPENDENCY',
                            'severity' => 'error',
                            'document_id' => $doc->id,
                            'citation_id' => $citation->id,
                            'message' => "Citation in '{$doc->title}' references unresolved evidence #{$evidence->id}. Must be resolved before publication.",
                        ];
                    }
                }
            }

            // Check content for raw internal URLs/links that should not be exposed
            $content = $latestVersion->content ?? $latestVersion->content_markdown ?? '';
            if (preg_match('/\[internal_private:[^\]]+\]/i', $content)) {
                $issues[] = [
                    'code' => 'INTERNAL_PRIVATE_LINK',
                    'severity' => 'error',
                    'document_id' => $doc->id,
                    'message' => "Document '{$doc->title}' contains private workspace links that must be converted or removed.",
                ];
            }
        }

        // 3. Check author/participant status (PUB-12)
        $members = $project->memberships()->with('user')->get();
        foreach ($members as $membership) {
            if ($membership->user && $membership->user->status === 'suspended') {
                $issues[] = [
                    'code' => 'SUSPENDED_PARTICIPANT',
                    'severity' => 'error',
                    'user_id' => $membership->user_id,
                    'message' => "Project contributor {$membership->user->display_name} is suspended. Credit or permissions must be resolved.",
                ];
            }
        }

        $isValid = count(array_filter($issues, fn($i) => ($i['severity'] ?? 'error') === 'error')) === 0;

        return [$isValid, $issues];
    }
}
