<?php

$paths = [];

function makePath(&$paths, $uri, $method, $summary, $tag, $auth = true, $requestBody = null, $parameters = []) {
    if (!isset($paths[$uri])) {
        $paths[$uri] = [];
    }

    $op = [
        'summary' => $summary,
        'tags' => [$tag],
        'responses' => [
            '200' => [
                'description' => 'Successful operation',
                'content' => [
                    'application/json' => [
                        'schema' => ['$ref' => '#/components/schemas/StandardSuccessResponse'],
                    ],
                ],
            ],
            '401' => ['description' => 'Unauthenticated'],
            '403' => ['description' => 'Unauthorized / Forbidden'],
            '422' => [
                'description' => 'Validation error',
                'content' => [
                    'application/json' => [
                        'schema' => ['$ref' => '#/components/schemas/StandardErrorResponse'],
                    ],
                ],
            ],
        ],
    ];

    if ($auth) {
        $op['security'] = [['bearerAuth' => []]];
    }

    if (!empty($parameters)) {
        $op['parameters'] = $parameters;
    }

    if ($requestBody) {
        $op['requestBody'] = [
            'required' => true,
            'content' => [
                'application/json' => [
                    'schema' => $requestBody,
                ],
            ],
        ];
    }

    $paths[$uri][strtolower($method)] = $op;
}

// ----------------------------------------------------------------------------
// MODULE 1: AUTH & IDENTITY
// ----------------------------------------------------------------------------
makePath($paths, '/auth/register', 'POST', 'Register as an applicant scholar', 'Auth & Identity', false, [
    'type' => 'object',
    'required' => ['display_name', 'email', 'password'],
    'properties' => [
        'display_name' => ['type' => 'string', 'example' => 'Dr. Zayd Al-Dimashqi'],
        'email' => ['type' => 'string', 'format' => 'email', 'example' => 'zayd@hadith.local'],
        'password' => ['type' => 'string', 'format' => 'password', 'example' => 'password123'],
        'preferred_language' => ['type' => 'string', 'example' => 'ar'],
    ],
]);

makePath($paths, '/auth/login', 'POST', 'Authenticate and obtain Sanctum Bearer Token', 'Auth & Identity', false, [
    'type' => 'object',
    'required' => ['email', 'password'],
    'properties' => [
        'email' => ['type' => 'string', 'format' => 'email', 'example' => 'polla@sue.edu.krd'],
        'password' => ['type' => 'string', 'format' => 'password', 'example' => 'password123'],
    ],
]);

makePath($paths, '/auth/me', 'GET', 'Retrieve current authenticated scholar identity & profile', 'Auth & Identity', true);

makePath($paths, '/auth/profile', 'PATCH', 'Update scholar profile, affiliation, and research interests', 'Auth & Identity', true, [
    'type' => 'object',
    'properties' => [
        'affiliation' => ['type' => 'string', 'example' => 'Salahaddin University-Erbil (SUE)'],
        'biography' => ['type' => 'string', 'example' => 'Specialist in computational Hadith studies.'],
        'research_interests' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['Isnād Topology', 'NLP']],
        'is_public' => ['type' => 'boolean', 'example' => true],
    ],
]);

makePath($paths, '/auth/logout', 'POST', 'Revoke active authentication token', 'Auth & Identity', true);

makePath($paths, '/applications', 'POST', 'Submit application for approved researcher credentials', 'Auth & Identity', true, [
    'type' => 'object',
    'required' => ['research_statement'],
    'properties' => [
        'research_statement' => ['type' => 'string', 'example' => 'Proposal for algorithmic collation of early Basran transmission recensions.'],
        'sample_publications' => ['type' => 'string', 'example' => 'Fattah, P. (2024). Evaluation Metrics in Low-Resource MT.'],
    ],
]);

makePath($paths, '/applications/my-status', 'GET', 'Check application vetting status', 'Auth & Identity', true);

// ----------------------------------------------------------------------------
// MODULE 2: CORPUS ADAPTER (1.13M HADITHS)
// ----------------------------------------------------------------------------
makePath($paths, '/corpus/search', 'GET', 'High-performance search across 1.13M Hadiths (FTS & Trigram GIN)', 'Corpus Adapter', false, null, [
    ['name' => 'q', 'in' => 'query', 'description' => 'Search term or phrase', 'schema' => ['type' => 'string', 'example' => 'الاعمال بالنيات']],
    ['name' => 'mode', 'in' => 'query', 'description' => 'Search mode: fts (Arabic stemmed), normalized (trigram), exact (tashkeel)', 'schema' => ['type' => 'string', 'enum' => ['fts', 'normalized', 'exact', 'trgm'], 'default' => 'fts']],
    ['name' => 'book_id', 'in' => 'query', 'description' => 'Filter by classical book ID', 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'per_page', 'in' => 'query', 'description' => 'Items per page', 'schema' => ['type' => 'integer', 'default' => 20]],
]);

makePath($paths, '/corpus/hadiths/{id}', 'GET', 'Get canonical Hadith text, full references, and sanad chains', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/hadiths/{id}/occurrences', 'GET', 'List occurrence clusters, mutaba\'at and shawahid across collections', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/books', 'GET', 'List classical books with filters (century, author)', 'Corpus Adapter', false, null, [
    ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string', 'example' => 'البخاري']],
    ['name' => 'century', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 3]],
]);

makePath($paths, '/corpus/books/{id}', 'GET', 'Get classical book metadata and table-of-contents', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/narrators/{id}', 'GET', 'Narrator biographical dossier (rutba, tabaqah, stats)', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/narrators/{id}/criticism', 'GET', 'List Jarḥ wa Taʿdīl statements from classical critics (Aḥmad, Ibn Maʿīn)', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/narrators/{id}/teachers', 'GET', 'List teachers (Shyookh) of narrator', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/narrators/{id}/students', 'GET', 'List students of narrator', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/sanads/{id}', 'GET', 'Reconstruct ordered narrator transmission chain with connectors', 'Corpus Adapter', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 539426]],
]);

// ----------------------------------------------------------------------------
// MODULE 3: PERSONAL LIBRARY ("MY LIBRARY")
// ----------------------------------------------------------------------------
makePath($paths, '/library/items', 'GET', 'List user saved library resources', 'Personal Library', true, null, [
    ['name' => 'favourite', 'in' => 'query', 'schema' => ['type' => 'boolean']],
]);

makePath($paths, '/library/items', 'POST', 'Bookmark a corpus record or external URL into library', 'Personal Library', true, [
    'type' => 'object',
    'required' => ['resource_type', 'title'],
    'properties' => [
        'resource_type' => ['type' => 'string', 'enum' => ['corpus_hadith', 'corpus_narrator', 'corpus_book', 'external_reference', 'file'], 'example' => 'corpus_hadith'],
        'corpus_id' => ['type' => 'integer', 'example' => 1],
        'title' => ['type' => 'string', 'example' => 'Sahih al-Bukhari #1 — Bad al-Wahy'],
        'personal_notes' => ['type' => 'string', 'example' => 'Essential baseline recension.'],
        'is_favourite' => ['type' => 'boolean', 'example' => true],
    ],
]);

makePath($paths, '/library/items/{id}', 'GET', 'View saved library item and notes', 'Personal Library', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
]);

makePath($paths, '/library/items/{id}', 'PATCH', 'Update personal notes or toggle favourite', 'Personal Library', true, [
    'type' => 'object',
    'properties' => [
        'personal_notes' => ['type' => 'string', 'example' => 'Updated notes on Medinan transmission.'],
        'is_favourite' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
]);

makePath($paths, '/library/items/{id}', 'DELETE', 'Remove bookmark from library (leaves corpus intact)', 'Personal Library', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
]);

makePath($paths, '/library/collections', 'GET', 'List custom personal collections', 'Personal Library', true);

makePath($paths, '/library/collections', 'POST', 'Create a new personal collection', 'Personal Library', true, [
    'type' => 'object',
    'required' => ['name'],
    'properties' => [
        'name' => ['type' => 'string', 'example' => 'Early Hijazi Bottlenecks'],
        'description' => ['type' => 'string', 'example' => 'Traditions with singular Medinan conduits.'],
    ],
]);

makePath($paths, '/library/collections/{id}/items', 'POST', 'Add resource to collection', 'Personal Library', true, [
    'type' => 'object',
    'required' => ['resource_id'],
    'properties' => [
        'resource_id' => ['type' => 'integer', 'example' => 1],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
]);

// ----------------------------------------------------------------------------
// MODULE 4: RESEARCH PROJECTS & WORKSPACES
// ----------------------------------------------------------------------------
makePath($paths, '/projects', 'GET', 'List research projects (owned vs shared, stage filters)', 'Project Workspaces', true, null, [
    ['name' => 'stage', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['scoping', 'collecting', 'analysing', 'writing', 'reviewing', 'completed']]],
]);

makePath($paths, '/projects', 'POST', 'Create an isolated research project workspace', 'Project Workspaces', true, [
    'type' => 'object',
    'required' => ['title', 'question'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'The Isnād Dynamics of the Niyyah Tradition'],
        'question' => ['type' => 'string', 'example' => 'Why did a Gharīb tradition undergo combinatorial explosion in 2nd century Iraq?'],
        'scope' => ['type' => 'string', 'example' => 'Textual collation of 18 canonical recensions.'],
        'stage' => ['type' => 'string', 'enum' => ['scoping', 'collecting', 'analysing', 'writing', 'reviewing', 'completed'], 'default' => 'scoping'],
    ],
]);

makePath($paths, '/projects/{id}', 'GET', 'Project overview, statistics, and collaboration state', 'Project Workspaces', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}', 'PUT', 'Update project title, question, scope, or stage', 'Project Workspaces', true, [
    'type' => 'object',
    'properties' => [
        'title' => ['type' => 'string'],
        'question' => ['type' => 'string'],
        'scope' => ['type' => 'string'],
        'stage' => ['type' => 'string', 'enum' => ['scoping', 'collecting', 'analysing', 'writing', 'reviewing', 'completed']],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}/stage', 'PATCH', 'Transition project research stage', 'Project Workspaces', true, [
    'type' => 'object',
    'required' => ['stage'],
    'properties' => [
        'stage' => ['type' => 'string', 'enum' => ['scoping', 'collecting', 'analysing', 'writing', 'reviewing', 'completed'], 'example' => 'writing'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}/archive', 'POST', 'Archive or unarchive project', 'Project Workspaces', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}', 'DELETE', 'Soft-delete project (30-day recovery window)', 'Project Workspaces', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}/members', 'GET', 'List active project collaborators and roles', 'Project Workspaces', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}/members', 'POST', 'Invite approved researcher to project role', 'Project Workspaces', true, [
    'type' => 'object',
    'required' => ['user_id', 'role'],
    'properties' => [
        'user_id' => ['type' => 'integer', 'example' => 2],
        'role' => ['type' => 'string', 'enum' => ['owner', 'researcher', 'reviewer', 'viewer'], 'example' => 'researcher'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{id}/members/{userId}', 'DELETE', 'Revoke project membership', 'Project Workspaces', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'userId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 2]],
]);

// ----------------------------------------------------------------------------
// MODULE 5: SAVED SEARCHES & FROZEN RESULT SETS
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/searches', 'GET', 'List saved queries for project', 'Saved Searches & Result Sets', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/searches', 'POST', 'Save search definition (query text + filter criteria)', 'Saved Searches & Result Sets', true, [
    'type' => 'object',
    'required' => ['name', 'query_text'],
    'properties' => [
        'name' => ['type' => 'string', 'example' => 'Niyyah Hadith Variants'],
        'query_text' => ['type' => 'string', 'example' => 'الاعمال بالنيات'],
        'search_mode' => ['type' => 'string', 'enum' => ['fts', 'normalized', 'exact'], 'default' => 'fts'],
        'filter_criteria' => ['type' => 'object', 'example' => ['type' => 'marfu']],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/searches/{queryId}', 'GET', 'View saved search query with historical runs', 'Saved Searches & Result Sets', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'queryId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/searches/{queryId}/run', 'POST', 'Execute query against corpus and record search_run duration', 'Saved Searches & Result Sets', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'queryId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/result-sets', 'GET', 'List frozen result sets', 'Saved Searches & Result Sets', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/result-sets', 'POST', 'Freeze an immutable snapshot of search results with metadata', 'Saved Searches & Result Sets', true, [
    'type' => 'object',
    'required' => ['name', 'items'],
    'properties' => [
        'name' => ['type' => 'string', 'example' => 'Baseline Canonical Cohort v1'],
        'search_run_id' => ['type' => 'integer', 'example' => 1],
        'items' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'required' => ['resource_type', 'corpus_id'],
                'properties' => [
                    'resource_type' => ['type' => 'string', 'example' => 'corpus_hadith'],
                    'corpus_id' => ['type' => 'integer', 'example' => 1],
                    'snapshot_data' => ['type' => 'object', 'example' => ['book' => 'Sahih al-Bukhari', 'hadith_number' => '1']],
                ],
            ],
        ],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/result-sets/{setId}', 'GET', 'Retrieve frozen members and snapshot data', 'Saved Searches & Result Sets', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'setId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 6: EVIDENCE & ANNOTATIONS
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/resources', 'GET', 'List bibliography resources attached to project', 'Evidence & Annotations', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/resources', 'POST', 'Attach bibliography resource to project workspace', 'Evidence & Annotations', true, [
    'type' => 'object',
    'required' => ['resource_id'],
    'properties' => [
        'resource_id' => ['type' => 'integer', 'example' => 1],
        'inclusion_rationale' => ['type' => 'string', 'example' => 'Baseline canonical witness.'],
        'tags' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['Canonical', 'Hijazi']],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/evidence', 'GET', 'List captured evidence passages (filter by state)', 'Evidence & Annotations', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'state', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['candidate', 'included', 'reviewed', 'excluded', 'unresolved']]],
]);

makePath($paths, '/projects/{projectId}/evidence', 'POST', 'Capture evidence passage with exact locator and SHA-256 hash', 'Evidence & Annotations', true, [
    'type' => 'object',
    'required' => ['resource_id', 'captured_text', 'locator'],
    'properties' => [
        'resource_id' => ['type' => 'integer', 'example' => 1],
        'captured_text' => ['type' => 'string', 'example' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى...'],
        'locator' => ['type' => 'string', 'example' => 'Sahih al-Bukhari, Hadith 1'],
        'source_version' => ['type' => 'string', 'example' => 'Sultaniyyah Edition'],
        'state' => ['type' => 'string', 'enum' => ['candidate', 'included', 'reviewed', 'excluded', 'unresolved'], 'default' => 'candidate'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/evidence/{id}', 'GET', 'Get evidence details with annotations', 'Evidence & Annotations', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/evidence/{id}', 'PATCH', 'Update evidence state or exclusion reason', 'Evidence & Annotations', true, [
    'type' => 'object',
    'properties' => [
        'state' => ['type' => 'string', 'enum' => ['candidate', 'included', 'reviewed', 'excluded', 'unresolved'], 'example' => 'included'],
        'exclusion_reason' => ['type' => 'string'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/evidence/{id}', 'DELETE', 'Delete evidence passage', 'Evidence & Annotations', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/evidence/{id}/annotations', 'POST', 'Create scholarly annotation on evidence text span', 'Evidence & Annotations', true, [
    'type' => 'object',
    'required' => ['body', 'annotation_kind'],
    'properties' => [
        'span_start' => ['type' => 'integer', 'example' => 0],
        'span_end' => ['type' => 'integer', 'example' => 85],
        'annotation_kind' => ['type' => 'string', 'enum' => ['source_quotation', 'interpretation', 'scholarly_judgment', 'machine_suggestion'], 'example' => 'scholarly_judgment'],
        'visibility' => ['type' => 'string', 'enum' => ['private', 'project_shared'], 'default' => 'project_shared'],
        'body' => ['type' => 'string', 'example' => 'Tafarrada bihi Umar according to Ali ibn al-Madini.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 7: ANALYSIS WORKBENCH
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/analyses/matn-compare', 'POST', 'Algorithmic Matn variant lexical diff & consensus core detection', 'Analysis Workbench', true, [
    'type' => 'object',
    'properties' => [
        'hadith_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => [1, 1907]],
        'custom_texts' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'variant_a'],
                    'label' => ['type' => 'string', 'example' => 'Bukhari #1'],
                    'text' => ['type' => 'string', 'example' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى'],
                ],
            ],
        ],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses/isnad-compare', 'POST', 'Isnād topology comparison & Common Link (Madār) detection', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['sanad_ids'],
    'properties' => [
        'sanad_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => [539426, 539430]],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses/criticism-matrix', 'POST', 'Jarḥ wa Taʿdīl cross-tabulated matrix across classical scholars', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['narrator_ids'],
    'properties' => [
        'narrator_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => [1, 2]],
        'scholar_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => []],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses', 'GET', 'List saved analysis runs with input parameters and results', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'type', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['matn_comparison', 'isnad_comparison', 'narrator_dossier', 'criticism_matrix', 'ilal_case']]],
]);

makePath($paths, '/projects/{projectId}/analyses/save', 'POST', 'Explicitly archive an analysis run', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['analysis_type', 'input_params', 'output_data'],
    'properties' => [
        'analysis_type' => ['type' => 'string', 'enum' => ['matn_comparison', 'isnad_comparison', 'narrator_dossier', 'criticism_matrix', 'ilal_case'], 'example' => 'ilal_case'],
        'input_params' => ['type' => 'object', 'example' => ['hadith_id' => 10]],
        'output_data' => ['type' => 'object', 'example' => ['verdict' => 'acceptable_addition']],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses/{analysisId}', 'GET', 'Retrieve single saved analysis run', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'analysisId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// --- Release 2a Advanced Analysis Workbench Endpoints ---

makePath($paths, '/projects/{projectId}/analyses/collate', 'POST', 'Sequence collation across Classical Arabic witnesses (Needleman-Wunsch with affine gaps)', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['baseline_text', 'variants'],
    'properties' => [
        'baseline_text' => ['type' => 'string', 'example' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى'],
        'variants' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'required' => ['id', 'text'],
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'rec_hijazi'],
                    'label' => ['type' => 'string', 'example' => 'Recension of Yahya ibn Sa\'id'],
                    'text' => ['type' => 'string', 'example' => 'إنما الأعمال بالنيات فمن كانت هجرته إلى الله ورسوله'],
                ],
            ],
        ],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses/isnad-topology', 'POST', 'Topological transmission DAG analysis & Madār al-Isnād (Common Link) detection with Cytoscape.js export', 'Analysis Workbench', true, [
    'type' => 'object',
    'properties' => [
        'sanad_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => [1, 2]],
        'custom_chains' => ['type' => 'array', 'items' => ['type' => 'array'], 'example' => []],
        'direction' => ['type' => 'string', 'enum' => ['author_to_source', 'source_to_author'], 'default' => 'author_to_source'],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/analyses/temporal-check', 'POST', 'Temporal CSP constraint satisfaction (Hijri lifespans & T_min=7 AH Tamyīz lower bound verification)', 'Analysis Workbench', true, [
    'type' => 'object',
    'properties' => [
        'teacher_name' => ['type' => 'string', 'example' => 'Nafi\' Mawla Ibn Umar'],
        'teacher_death' => ['type' => 'integer', 'example' => 117],
        'student_name' => ['type' => 'string', 'example' => 'Malik ibn Anas'],
        'student_birth' => ['type' => 'integer', 'example' => 93],
        'student_death' => ['type' => 'integer', 'example' => 179],
        'min_audition_age' => ['type' => 'integer', 'default' => 7],
        'save_run' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families', 'GET', 'List Hadith family clusters with Mutābaʿah and Shāhid members', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families', 'POST', 'Create a new canonical Hadith family cluster', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['canonical_title'],
    'properties' => [
        'canonical_title' => ['type' => 'string', 'example' => 'Hadith of Actions and Intentions (Innama al-A\'mal)'],
        'root_companion' => ['type' => 'string', 'example' => 'Umar ibn al-Khattab'],
        'core_theme' => ['type' => 'string', 'example' => 'Sincerity and intentionality in religious acts'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families/{familyId}/members', 'POST', 'Attach a transmission member (Mutābaʿah Tāmmah, Qāṣirah, Shāhid) to family', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['relationship_type'],
    'properties' => [
        'evidence_id' => ['type' => 'integer', 'example' => 1],
        'corpus_hadith_id' => ['type' => 'integer', 'example' => 10],
        'corpus_sanad_id' => ['type' => 'integer', 'example' => 20],
        'relationship_type' => ['type' => 'string', 'enum' => ['mutabaah_tammah', 'mutabaah_qasirah', 'shahid', 'candidate'], 'example' => 'mutabaah_tammah'],
        'convergence_narrator' => ['type' => 'string', 'example' => 'Yahya ibn Sa\'id al-Ansari'],
        'convergence_depth' => ['type' => 'integer', 'example' => 1],
        'scholarly_notes' => ['type' => 'string', 'example' => 'Parallel transmission through Yahya'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'familyId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families/{familyId}/members/{memberId}', 'DELETE', 'Remove a member from the Hadith family cluster', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'familyId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'memberId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases', 'GET', 'List structured ʿIlal (hidden defect) investigation dossiers', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['under_investigation', 'resolved_authentic', 'resolved_defective', 'inconclusive']]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases', 'POST', 'Open a structured ʿIlal investigation dossier', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['title', 'discrepancy_category'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Discrepancy in Basran transmission of Hadith al-Niyyat'],
        'discrepancy_category' => ['type' => 'string', 'enum' => ['ikhtilaf_sanad', 'ikhtilaf_matn', 'ziyadah_thiqah', 'idraj', 'inqita_khafi'], 'example' => 'ikhtilaf_sanad'],
        'competing_variants' => ['type' => 'array', 'items' => ['type' => 'object'], 'example' => []],
        'critics_judgments' => ['type' => 'array', 'items' => ['type' => 'object'], 'example' => []],
        'resolution_notes' => ['type' => 'string', 'example' => 'Preliminary investigation underway'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases/{caseId}', 'GET', 'Retrieve single ʿIlal investigation dossier', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'caseId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases/{caseId}', 'PATCH', 'Update or resolve ʿIlal investigation dossier', 'Analysis Workbench', true, [
    'type' => 'object',
    'properties' => [
        'status' => ['type' => 'string', 'enum' => ['under_investigation', 'resolved_authentic', 'resolved_defective', 'inconclusive'], 'example' => 'resolved_authentic'],
        'preferred_version' => ['type' => 'string', 'example' => 'Muttasil chain of Hammad ibn Zayd'],
        'resolution_notes' => ['type' => 'string', 'example' => 'Resolved: The mursal transmission is an anomaly by a lesser student.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'caseId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/narrator-assessments', 'GET', 'List critic assessments conditioned on specific teachers', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'narrator_id', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 501]],
    ['name' => 'teacher_id', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 702]],
]);

makePath($paths, '/projects/{projectId}/narrator-assessments', 'POST', 'Record critic assessment conditioned on a specific teacher', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['narrator_id', 'teacher_id', 'assessment_category'],
    'properties' => [
        'narrator_id' => ['type' => 'integer', 'example' => 501],
        'teacher_id' => ['type' => 'integer', 'example' => 702],
        'assessment_category' => ['type' => 'string', 'enum' => ['reliable_specifically', 'weakened_specifically', 'mixed_specifically', 'confused_after_event'], 'example' => 'weakened_specifically'],
        'critic_name' => ['type' => 'string', 'example' => 'Ahmad ibn Hanbal'],
        'qawl_text' => ['type' => 'string', 'example' => 'His narrations from this specific teacher contain munkarat because his notes were lost.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 8: FINDINGS & DOCUMENTS
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/findings', 'GET', 'List empirical findings and hypotheses', 'Findings & Documents', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/findings', 'POST', 'Record new research finding or claim', 'Findings & Documents', true, [
    'type' => 'object',
    'required' => ['question', 'claim', 'reasoning'],
    'properties' => [
        'question' => ['type' => 'string', 'example' => 'What explains the grammatical bifurcation between singular and plural?'],
        'claim' => ['type' => 'string', 'example' => 'The singular is the original Hijazi dialect preserved by Malik.'],
        'reasoning' => ['type' => 'string', 'example' => 'Collation of early Muwatta manuscripts shows universal retention.'],
        'status' => ['type' => 'string', 'enum' => ['provisional', 'supported', 'inconclusive', 'disputed'], 'default' => 'provisional'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/findings/{id}/evidence', 'POST', 'Link evidence passage to finding (supporting/opposing)', 'Findings & Documents', true, [
    'type' => 'object',
    'required' => ['evidence_id', 'relation_type'],
    'properties' => [
        'evidence_id' => ['type' => 'integer', 'example' => 1],
        'relation_type' => ['type' => 'string', 'enum' => ['supporting', 'opposing', 'contextual', 'unresolved'], 'example' => 'supporting'],
        'interpretation' => ['type' => 'string', 'example' => 'Direct empirical proof from Medinan recension.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents', 'GET', 'List research documents in workspace', 'Findings & Documents', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents', 'POST', 'Create new research monograph or document', 'Findings & Documents', true, [
    'type' => 'object',
    'required' => ['title'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'The Anatomy of a Gharīb Bottleneck'],
        'document_type' => ['type' => 'string', 'enum' => ['article', 'dossier', 'dataset_note'], 'default' => 'article'],
        'language' => ['type' => 'string', 'example' => 'ar'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents/{id}', 'GET', 'Get document details with current content version', 'Findings & Documents', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents/{id}/versions', 'POST', 'Create new revision version for Markdown document', 'Findings & Documents', true, [
    'type' => 'object',
    'required' => ['content'],
    'properties' => [
        'content' => ['type' => 'string', 'example' => '# Monograph Title\n\n## 1. Abstract\n...'],
        'change_summary' => ['type' => 'string', 'example' => 'Added topological isnad graph section.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents/{id}/versions', 'GET', 'List document revision history', 'Findings & Documents', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 9: ANNOUNCEMENTS & SUBMISSIONS
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/announcement', 'GET', 'Get announcement draft for project', 'Announcements & Submissions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/announcement', 'POST', 'Draft or update public announcement', 'Announcements & Submissions', true, [
    'type' => 'object',
    'required' => ['public_slug', 'title', 'summary', 'research_stage'],
    'properties' => [
        'public_slug' => ['type' => 'string', 'example' => 'niyyah-isnad-dynamics-2nd-century'],
        'title' => ['type' => 'string', 'example' => 'The Isnād Dynamics of the Niyyah Tradition'],
        'summary' => ['type' => 'string', 'example' => 'Empirical study of the 2nd-century transmission diffusion.'],
        'research_stage' => ['type' => 'string', 'example' => 'completed'],
        'keywords' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['Niyyah', 'Gharib']],
        'status' => ['type' => 'string', 'enum' => ['draft', 'published', 'unpublished', 'hidden'], 'default' => 'draft'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/announcement/publish', 'POST', 'Direct-publish announcement to public site', 'Announcements & Submissions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/public/announcements', 'GET', 'Public feed of announced research projects', 'Announcements & Submissions', false, null, [
    ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string']],
    ['name' => 'research_stage', 'in' => 'query', 'schema' => ['type' => 'string']],
]);

makePath($paths, '/public/announcements/{slug}', 'GET', 'View public announcement details and project scope', 'Announcements & Submissions', false, null, [
    ['name' => 'slug', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'niyyah-isnad-dynamics-2nd-century']],
]);

makePath($paths, '/projects/{projectId}/validate-pre-publication', 'POST', 'Run pre-publication checks for unresolved evidence, private links, and suspended co-authors', 'Announcements & Submissions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/submissions', 'POST', 'Freeze package and submit for editorial peer review', 'Announcements & Submissions', true, [
    'type' => 'object',
    'required' => ['title', 'abstract'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'The Anatomy of a Gharīb Bottleneck'],
        'abstract' => ['type' => 'string', 'example' => 'This study examines the transmission bottleneck...'],
        'keywords' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['isnād', 'gharīb', 'bottleneck']],
        'rights_declaration' => ['type' => 'boolean', 'example' => true],
        'coi_declared' => ['type' => 'boolean', 'example' => false],
        'parent_submission_id' => ['type' => 'integer', 'example' => 1],
        'author_response_notes' => ['type' => 'string', 'example' => 'Addressed reviewer remarks regarding Basran chains.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/submissions', 'GET', 'List project review submissions', 'Announcements & Submissions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 10: EDITORIAL REVIEW & PEER-REVIEWED PUBLISHING
// ----------------------------------------------------------------------------
makePath($paths, '/editor/submissions', 'GET', 'Editorial review queue (filtered by stage, age, keywords)', 'Editorial Review & Publications', true, null, [
    ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['submitted', 'in_review', 'revision_requested', 'approved', 'rejected']]],
    ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string']],
]);

makePath($paths, '/editor/submissions/{id}/assign', 'POST', 'Assign peer reviewer (with conflict-of-interest check)', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['reviewer_id'],
    'properties' => [
        'reviewer_id' => ['type' => 'integer', 'example' => 3],
        'due_date' => ['type' => 'string', 'format' => 'date', 'example' => '2026-11-01'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/editor/submissions/{id}/review', 'POST', 'Peer reviewer submits evaluation verdict & critical notes', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['recommendation', 'reviewer_notes'],
    'properties' => [
        'recommendation' => ['type' => 'string', 'enum' => ['approve', 'request_revisions', 'reject'], 'example' => 'approve'],
        'reviewer_notes' => ['type' => 'string', 'example' => 'Exemplary methodological contribution.'],
        'score' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'example' => 92],
        'coi_confirmed' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/editor/submissions/{id}/decision', 'POST', 'Editor issues formal editorial verdict', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['decision', 'decision_notes'],
    'properties' => [
        'decision' => ['type' => 'string', 'enum' => ['approve', 'request_revisions', 'reject'], 'example' => 'approve'],
        'decision_notes' => ['type' => 'string', 'example' => 'Accepted based on unanimous reviewer consensus.'],
        'coi_confirmed' => ['type' => 'boolean', 'example' => true],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/editor/submissions/{id}/release', 'POST', 'Release approved submission to Public Research Portal', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['public_slug'],
    'properties' => [
        'public_slug' => ['type' => 'string', 'example' => 'the-niyyah-tradition-critical-monograph'],
        'version_string' => ['type' => 'string', 'default' => '1.0.0'],
        'doi' => ['type' => 'string', 'example' => '10.5555/hadith.2026.0001'],
        'license' => ['type' => 'string', 'example' => 'CC-BY-4.0'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/editor/publications/{id}/corrigenda', 'POST', 'Publish formal corrigenda / errata amendment', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['title', 'content', 'affected_section'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Correction in Basran chain attribution'],
        'content' => ['type' => 'string', 'example' => 'Amended narrator identity in section 3.2.'],
        'affected_section' => ['type' => 'string', 'example' => 'Section 3.2 - Basran Isnād Analysis'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/editor/publications/{id}/retract', 'POST', 'Retract publication with formal public rationale', 'Editorial Review & Publications', true, [
    'type' => 'object',
    'required' => ['reason'],
    'properties' => [
        'reason' => ['type' => 'string', 'example' => 'Irreproducible textual collation due to contaminated primary source manuscript.'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/public/research', 'GET', 'Search & browse peer-reviewed research monographs & papers', 'Editorial Review & Publications', false, null, [
    ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string', 'example' => 'Niyyah']],
]);

makePath($paths, '/public/research/{slug}', 'GET', 'View published peer-reviewed monograph with citations & reviews', 'Editorial Review & Publications', false, null, [
    ['name' => 'slug', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'the-niyyah-tradition-critical-monograph']],
]);

makePath($paths, '/public/research/{slug}/cite', 'GET', 'Export formatted academic citations (bibtex, ris, apa)', 'Editorial Review & Publications', false, null, [
    ['name' => 'slug', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'the-niyyah-tradition-critical-monograph']],
    ['name' => 'format', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['bibtex', 'ris', 'apa'], 'default' => 'bibtex']],
]);

// ----------------------------------------------------------------------------
// MODULE 11: EXPORTS & COLLABORATION
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/exports', 'POST', 'Enqueue asynchronous project export job', 'Exports & Collaboration', true, [
    'type' => 'object',
    'required' => ['format'],
    'properties' => [
        'format' => ['type' => 'string', 'enum' => ['zip', 'json', 'csv'], 'default' => 'zip'],
        'scope' => ['type' => 'string', 'enum' => ['project', 'library', 'account'], 'default' => 'project'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/exports', 'GET', 'List project export jobs', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/exports/{id}/download', 'GET', 'Download completed export package', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/threads', 'GET', 'List discussion threads', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/threads', 'POST', 'Create new discussion thread anchored to entity', 'Exports & Collaboration', true, [
    'type' => 'object',
    'required' => ['title', 'target_type', 'target_id'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Evaluation of the Basran Variant'],
        'target_type' => ['type' => 'string', 'enum' => ['project', 'evidence', 'analysis', 'finding', 'document'], 'example' => 'evidence'],
        'target_id' => ['type' => 'integer', 'example' => 1],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/threads/{id}', 'GET', 'Get discussion thread with comments', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/threads/{id}/comments', 'POST', 'Add comment to discussion thread', 'Exports & Collaboration', true, [
    'type' => 'object',
    'required' => ['content'],
    'properties' => [
        'content' => ['type' => 'string', 'example' => 'I verified Musnad al-Humaydi (#3).'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/threads/{id}/resolve', 'POST', 'Mark discussion thread as resolved', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/tasks', 'GET', 'List project research tasks', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/tasks', 'POST', 'Create new research task', 'Exports & Collaboration', true, [
    'type' => 'object',
    'required' => ['title'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Collate Musnad Ahmad variants'],
        'description' => ['type' => 'string', 'example' => 'Extract all occurrences of Yahya ibn Sa\'id.'],
        'assignee_id' => ['type' => 'integer', 'example' => 2],
        'due_date' => ['type' => 'string', 'format' => 'date', 'example' => '2026-10-15'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/tasks/{id}', 'PATCH', 'Update task status or completion state', 'Exports & Collaboration', true, [
    'type' => 'object',
    'properties' => [
        'status' => ['type' => 'string', 'enum' => ['open', 'in_progress', 'blocked', 'done'], 'example' => 'done'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/activity', 'GET', 'Retrieve project audit trail and activity stream', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 12: ADMIN & CORPUS ERRATA
// ----------------------------------------------------------------------------
makePath($paths, '/admin/users', 'GET', 'List platform users and review statuses', 'Admin & Corpus Errata', true, null, [
    ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['unverified', 'pending', 'approved', 'suspended']]],
    ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string']],
]);

makePath($paths, '/admin/users/{id}/status', 'PATCH', 'Suspend or reinstate user account', 'Admin & Corpus Errata', true, [
    'type' => 'object',
    'required' => ['status'],
    'properties' => [
        'status' => ['type' => 'string', 'enum' => ['approved', 'suspended'], 'example' => 'suspended'],
        'reason' => ['type' => 'string', 'example' => 'Security review.'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/admin/applications', 'GET', 'List pending researcher vetting applications', 'Admin & Corpus Errata', true, null, [
    ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string', 'default' => 'pending']],
]);

makePath($paths, '/admin/applications/{id}/decide', 'POST', 'Approve or reject researcher application', 'Admin & Corpus Errata', true, [
    'type' => 'object',
    'required' => ['decision'],
    'properties' => [
        'decision' => ['type' => 'string', 'enum' => ['approved', 'rejected'], 'example' => 'approved'],
        'reason' => ['type' => 'string', 'example' => 'Verified academic credentials at SUE.'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/admin/audit-logs', 'GET', 'Query system-wide security and governance audit logs', 'Admin & Corpus Errata', true, null, [
    ['name' => 'action', 'in' => 'query', 'schema' => ['type' => 'string']],
    ['name' => 'object_type', 'in' => 'query', 'schema' => ['type' => 'string']],
]);

makePath($paths, '/corpus/proposals', 'POST', 'Submit corpus errata or textual correction proposal', 'Admin & Corpus Errata', true, [
    'type' => 'object',
    'required' => ['corpus_table', 'corpus_id', 'current_value', 'proposed_value', 'evidence_notes'],
    'properties' => [
        'corpus_table' => ['type' => 'string', 'example' => 'hadiths'],
        'corpus_id' => ['type' => 'integer', 'example' => 1],
        'current_value' => ['type' => 'string', 'example' => 'Misspelled token'],
        'proposed_value' => ['type' => 'string', 'example' => 'Corrected token'],
        'evidence_notes' => ['type' => 'string', 'example' => 'Confirmed in Sultaniyyah edition.'],
    ],
]);

makePath($paths, '/admin/corpus/proposals', 'GET', 'List pending corpus errata proposals', 'Admin & Corpus Errata', true);

makePath($paths, '/admin/corpus/proposals/{id}/decide', 'POST', 'Accept or reject corpus correction proposal', 'Admin & Corpus Errata', true, [
    'type' => 'object',
    'required' => ['status'],
    'properties' => [
        'status' => ['type' => 'string', 'enum' => ['accepted', 'rejected'], 'example' => 'accepted'],
        'decision_notes' => ['type' => 'string', 'example' => 'Corroborated by manuscript collation.'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 13: COLLABORATION & WORKFLOWS (R1b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/invitations', 'POST', 'Send project collaboration invitation', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['email', 'role'],
    'properties' => [
        'email' => ['type' => 'string', 'format' => 'email', 'example' => 'colleague@hadith.ac.krd'],
        'role' => ['type' => 'string', 'enum' => ['co_investigator', 'contributor', 'reviewer', 'observer'], 'example' => 'co_investigator'],
        'expires_days' => ['type' => 'integer', 'example' => 7],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/invitations', 'GET', 'List pending invitations for a project', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/invitations/{token}/accept', 'POST', 'Accept collaboration invitation and join workspace', 'Collaboration & Workflows', true, null, [
    ['name' => 'token', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'inv_token_abc123']],
]);

makePath($paths, '/invitations/{token}/decline', 'POST', 'Decline collaboration invitation', 'Collaboration & Workflows', true, null, [
    ['name' => 'token', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'inv_token_abc123']],
]);

makePath($paths, '/projects/{projectId}/members/{userId}', 'PUT', 'Update collaborator role or responsibilities', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['role'],
    'properties' => [
        'role' => ['type' => 'string', 'enum' => ['co_investigator', 'contributor', 'reviewer', 'observer'], 'example' => 'reviewer'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'userId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 2]],
]);

makePath($paths, '/projects/{projectId}/members/{userId}', 'DELETE', 'Revoke collaborator access with immediate termination', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'userId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 2]],
]);

makePath($paths, '/projects/{projectId}/discussions', 'GET', 'List contextual discussion & dispute threads', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'thread_type', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['discussion', 'dispute_review']]],
    ['name' => 'is_resolved', 'in' => 'query', 'schema' => ['type' => 'boolean']],
]);

makePath($paths, '/projects/{projectId}/discussions', 'POST', 'Create contextual discussion or scholarly dispute thread', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['title', 'target_type', 'target_id', 'initial_comment'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Dispute on Yahya ibn Sa\'id Madar attribution'],
        'thread_type' => ['type' => 'string', 'enum' => ['discussion', 'dispute_review'], 'example' => 'dispute_review'],
        'target_type' => ['type' => 'string', 'enum' => ['project', 'evidence', 'analysis', 'finding', 'document', 'passage'], 'example' => 'evidence'],
        'target_id' => ['type' => 'integer', 'example' => 1],
        'context_quote' => ['type' => 'string', 'example' => 'Yahya ibn Sa\'id transmits from Muhammad ibn Ibrahim'],
        'context_locator' => ['type' => 'string', 'example' => 'Sahih al-Bukhari #1'],
        'initial_comment' => ['type' => 'string', 'example' => 'Is there any secondary Basran path bypassing Yahya?'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/discussions/{threadId}/comments', 'GET', 'List discussion thread comments chronologically', 'Collaboration & Workflows', true, null, [
    ['name' => 'threadId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/discussions/{threadId}/comments', 'POST', 'Add scholarly comment or citation to thread', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['content'],
    'properties' => [
        'content' => ['type' => 'string', 'example' => 'All classical routes converge upon Yahya; no sound mutaba\'ah bypasses him.'],
    ],
], [
    ['name' => 'threadId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/discussions/{threadId}/resolve', 'POST', 'Resolve dispute thread with scholarly consensus rationale', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['resolution_notes'],
    'properties' => [
        'resolution_notes' => ['type' => 'string', 'example' => 'Consensus reached: Yahya is the unquestioned Madar al-Isnad.'],
        'alternative_interpretation' => ['type' => 'string', 'example' => 'Minor anomalous claims in al-Daraqutni classified as shadh.'],
    ],
], [
    ['name' => 'threadId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/tasks/{taskId}/complete', 'POST', 'Mark project task as completed', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'taskId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/tasks/{taskId}/block', 'POST', 'Flag project task as blocked with explicit scholarly rationale', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['blocking_reason'],
    'properties' => [
        'blocking_reason' => ['type' => 'string', 'example' => 'Awaiting high-res manuscript scan from Istanbul library.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'taskId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents/{docId}/lock', 'POST', 'Acquire 15-minute exclusive document edit lock', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'docId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/documents/{docId}/unlock', 'POST', 'Voluntarily release document edit lock', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'docId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 14: NOTIFICATION CENTER & PREFERENCES (R1b)
// ----------------------------------------------------------------------------
makePath($paths, '/notifications', 'GET', 'Retrieve notifications and unread alert count', 'Notification Center', true);

makePath($paths, '/notifications/{id}/read', 'PATCH', 'Mark specific notification as read', 'Notification Center', true, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/notifications/mark-all-read', 'POST', 'Mark all user notifications as read', 'Notification Center', true);

makePath($paths, '/notifications/preferences', 'GET', 'Retrieve user notification digest preferences', 'Notification Center', true);

makePath($paths, '/notifications/preferences', 'PUT', 'Update notification frequency and channel preferences', 'Notification Center', true, [
    'type' => 'object',
    'properties' => [
        'notify_invitations' => ['type' => 'boolean', 'example' => true],
        'notify_discussions' => ['type' => 'boolean', 'example' => true],
        'notify_tasks' => ['type' => 'boolean', 'example' => true],
        'notify_mentions' => ['type' => 'boolean', 'example' => true],
        'notify_exports' => ['type' => 'boolean', 'example' => false],
        'notify_reviews' => ['type' => 'boolean', 'example' => true],
        'email_digest' => ['type' => 'string', 'enum' => ['instant', 'daily', 'weekly', 'none'], 'example' => 'daily'],
    ],
]);

// ----------------------------------------------------------------------------
// MODULE 7: ANALYSIS WORKBENCH ENHANCEMENTS (R2a)
// ----------------------------------------------------------------------------
makePath($paths, '/analysis/collate', 'GET', 'Algorithmic text collation (Needleman-Wunsch with affine gap penalty)', 'Analysis Workbench', true, null, [
    ['name' => 'text1', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'انما الاعمال بالنيات وانما لكل امرئ ما نوى']],
    ['name' => 'text2', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'الاعمال بالنية ولكل امرئ ما نوى فمن كانت هجرته']],
]);

makePath($paths, '/analysis/isnad-dag', 'GET', 'Isnād topology DAG analysis and Madār al-Isnād (Common Link) detection', 'Analysis Workbench', true, null, [
    ['name' => 'hadith_id', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'raw_sanad_ids', 'in' => 'query', 'schema' => ['type' => 'string', 'example' => '1,2,3']],
]);

makePath($paths, '/analysis/temporal-csp', 'GET', 'Temporal constraint satisfaction verification (T_min=7 AH Tamyīz lower bound)', 'Analysis Workbench', true, null, [
    ['name' => 'teacher_id', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'student_id', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 2]],
]);

makePath($paths, '/projects/{projectId}/families', 'GET', 'List Hadith families (canonical text clusters)', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families', 'POST', 'Create a new Hadith family cluster', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['canonical_hadith_id', 'title'],
    'properties' => [
        'canonical_hadith_id' => ['type' => 'integer', 'example' => 1],
        'title' => ['type' => 'string', 'example' => 'Hadith of Intentions (Innama al-A\'mal) Family'],
        'notes' => ['type' => 'string', 'example' => 'Canonical cluster spanning KTB-01, KTB-02 recensions.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families/{familyId}/members', 'POST', 'Attach Hadith occurrence as member to family', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['hadith_id', 'relationship_type'],
    'properties' => [
        'hadith_id' => ['type' => 'integer', 'example' => 2],
        'relationship_type' => ['type' => 'string', 'enum' => ['mutabaah_tammah', 'mutabaah_qasirah', 'shahid', 'shadh'], 'example' => 'mutabaah_tammah'],
        'notes' => ['type' => 'string', 'example' => 'Parallel transmission through Sufyan.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'familyId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/families/{familyId}/members/{memberId}', 'DELETE', 'Remove member occurrence from Hadith family', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'familyId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'memberId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases', 'GET', 'List \'Ilal cases (hidden defects and transmission anomalies)', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases', 'POST', 'Register an \'Ilal case investigation', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['title', 'defect_type'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Irsal Khafiyy between Thabit and Anas'],
        'defect_type' => ['type' => 'string', 'enum' => ['idraj', 'irsal_khafiyy', 'waqf_raf', 'ziyadah_thiqah', 'qalb', 'idtirab'], 'example' => 'irsal_khafiyy'],
        'affected_hadith_id' => ['type' => 'integer', 'example' => 1],
        'primary_narrator_id' => ['type' => 'integer', 'example' => 10],
        'secondary_narrator_id' => ['type' => 'integer', 'example' => 20],
        'scholar_verdict' => ['type' => 'string', 'example' => 'Transmitted with hidden hiatus according to al-Daraqutni.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases/{caseId}', 'GET', 'Retrieve \'Ilal case details', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'caseId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/ilal-cases/{caseId}', 'PATCH', 'Update \'Ilal case verdict and status', 'Analysis Workbench', true, [
    'type' => 'object',
    'properties' => [
        'scholar_verdict' => ['type' => 'string', 'example' => 'Confirmed defective after comparing parallel paths.'],
        'status' => ['type' => 'string', 'enum' => ['open', 'verified', 'dismissed'], 'example' => 'verified'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'caseId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/narrator-assessments', 'GET', 'List contextual narrator-teacher pair assessments', 'Analysis Workbench', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/narrator-assessments', 'POST', 'Record specific narrator-teacher pairing appraisal', 'Analysis Workbench', true, [
    'type' => 'object',
    'required' => ['narrator_id', 'teacher_id', 'assessment'],
    'properties' => [
        'narrator_id' => ['type' => 'integer', 'example' => 1],
        'teacher_id' => ['type' => 'integer', 'example' => 2],
        'assessment' => ['type' => 'string', 'enum' => ['thiqah_mutlaq', 'thiqah_fi_shaykhihi', 'daif_fi_shaykhihi', 'mudallis'], 'example' => 'thiqah_fi_shaykhihi'],
        'notes' => ['type' => 'string', 'example' => 'His narrations specifically from al-Zuhri are sound and authenticated.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 2: CORPUS STRUCTURE & CONCORDANCE (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/corpus/books/{bookId}/structure', 'GET', 'Hierarchical Table of Contents (Kutub & Abwāb drill-down with occurrence counts)', 'Corpus Adapter', false, null, [
    ['name' => 'bookId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/corpus/books/{bookId}/concordance', 'GET', 'Lexical concordance across classical book hadiths', 'Corpus Adapter', false, null, [
    ['name' => 'bookId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'term', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'example' => 'نية']],
]);

// ----------------------------------------------------------------------------
// MODULE 8: ARGUMENTATION GRAPH (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/argument-graph', 'GET', 'Retrieve complete project argumentation graph (nodes and directed epistemic edges)', 'Argumentation Graph', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/argument-nodes', 'POST', 'Create argumentation node (premise, conclusion, objection, warrant)', 'Argumentation Graph', true, [
    'type' => 'object',
    'required' => ['node_type', 'claim_text'],
    'properties' => [
        'node_type' => ['type' => 'string', 'enum' => ['premise', 'conclusion', 'objection', 'warrant', 'backing', 'rebuttal'], 'example' => 'premise'],
        'claim_text' => ['type' => 'string', 'example' => 'Al-Zuhri had an unbroken chain of transmission from Salim.'],
        'confidence_level' => ['type' => 'string', 'enum' => ['qati', 'zanni_ghalib', 'muhtamal', 'daif'], 'example' => 'qati'],
        'source_type' => ['type' => 'string', 'example' => 'evidence'],
        'source_id' => ['type' => 'integer', 'example' => 1],
        'metadata' => ['type' => 'object'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/argument-nodes/{nodeId}', 'PATCH', 'Update argumentation node text or confidence', 'Argumentation Graph', true, [
    'type' => 'object',
    'properties' => [
        'claim_text' => ['type' => 'string', 'example' => 'Updated claim text with scholarly revision.'],
        'confidence_level' => ['type' => 'string', 'example' => 'zanni_ghalib'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'nodeId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/argument-nodes/{nodeId}', 'DELETE', 'Delete argumentation node and connected edges', 'Argumentation Graph', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'nodeId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/argument-edges', 'POST', 'Connect two argument nodes with directed relation', 'Argumentation Graph', true, [
    'type' => 'object',
    'required' => ['source_node_id', 'target_node_id', 'relation_type'],
    'properties' => [
        'source_node_id' => ['type' => 'integer', 'example' => 1],
        'target_node_id' => ['type' => 'integer', 'example' => 2],
        'relation_type' => ['type' => 'string', 'enum' => ['supports', 'attacks', 'rebuts', 'qualifies', 'presupposes'], 'example' => 'supports'],
        'weight' => ['type' => 'number', 'example' => 1.0],
        'rationale' => ['type' => 'string', 'example' => 'Sound transmission warrants the primary conclusion.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/argument-edges/{edgeId}', 'DELETE', 'Remove directed argument edge', 'Argumentation Graph', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'edgeId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 6: HISTORICAL ASSERTIONS (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/assertions', 'GET', 'List historical assertions with certainty degrees and evidence', 'Historical Assertions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/assertions', 'POST', 'Register historical assertion with citation grounding', 'Historical Assertions', true, [
    'type' => 'object',
    'required' => ['assertion_type', 'subject_name', 'claim_statement'],
    'properties' => [
        'assertion_type' => ['type' => 'string', 'enum' => ['biographical_fact', 'transmission_event', 'hearing_claim', 'chronological_anchor', 'textual_attribution'], 'example' => 'transmission_event'],
        'subject_name' => ['type' => 'string', 'example' => 'Sufyan ibn Uyaynah hearing from al-Zuhri'],
        'claim_statement' => ['type' => 'string', 'example' => 'Sufyan met and heard directly from al-Zuhri in Mecca in 123 AH.'],
        'certainty_degree' => ['type' => 'string', 'enum' => ['certain', 'probable', 'disputed', 'rejected'], 'example' => 'certain'],
        'evidence_id' => ['type' => 'integer', 'example' => 1],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/assertions/{id}', 'GET', 'Retrieve historical assertion details', 'Historical Assertions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/assertions/{id}', 'PATCH', 'Update historical assertion claim or certainty', 'Historical Assertions', true, [
    'type' => 'object',
    'properties' => [
        'claim_statement' => ['type' => 'string', 'example' => 'Revised transmission statement with additional citations.'],
        'certainty_degree' => ['type' => 'string', 'example' => 'probable'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/assertions/{id}', 'DELETE', 'Delete historical assertion', 'Historical Assertions', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 4: PROJECT TEMPLATES (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/project-templates', 'GET', 'List available research project templates', 'Project Templates', false);

makePath($paths, '/project-templates/{id}', 'GET', 'Retrieve template structure, milestones, and default tasks', 'Project Templates', false, null, [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/project-templates/{id}/instantiate', 'POST', 'Instantiate a new project workspace pre-populated from template', 'Project Templates', true, [
    'type' => 'object',
    'required' => ['title'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Investigation into Basran Transmissions of Hadith al-Iftiraq'],
        'description' => ['type' => 'string', 'example' => 'Complete Takhrīj and Ilal study instantiated from template.'],
        'visibility' => ['type' => 'string', 'enum' => ['private', 'institutional', 'public'], 'example' => 'private'],
    ],
], [
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 13: COLLABORATION REQUESTS (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/collaboration-requests', 'POST', 'Submit collaborative researcher request to join workspace', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['proposal_text'],
    'properties' => [
        'requested_role' => ['type' => 'string', 'enum' => ['contributor', 'reviewer', 'reader'], 'example' => 'contributor'],
        'proposal_text' => ['type' => 'string', 'example' => 'I offer to collate Syrian recensions and verify biographical death dates.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/collaboration-requests', 'GET', 'List incoming collaboration requests for project', 'Collaboration & Workflows', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/collaboration-requests/{requestId}', 'PATCH', 'Accept or reject collaboration request', 'Collaboration & Workflows', true, [
    'type' => 'object',
    'required' => ['status'],
    'properties' => [
        'status' => ['type' => 'string', 'enum' => ['accepted', 'rejected'], 'example' => 'accepted'],
        'review_notes' => ['type' => 'string', 'example' => 'Welcome to the project as a contributing researcher.'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'requestId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 15: GEOSPATIAL NETWORK (R2b / R3)
// ----------------------------------------------------------------------------
makePath($paths, '/geospatial/places', 'GET', 'GeoJSON FeatureCollection of historical Islamic centers and cities', 'Geospatial Network', false, null, [
    ['name' => 'region', 'in' => 'query', 'schema' => ['type' => 'string', 'example' => 'Hijaz']],
]);

makePath($paths, '/geospatial/narrators/{narratorId}/trajectory', 'GET', 'Biographical travel itinerary (Rihlah) waypoints for narrator', 'Geospatial Network', false, null, [
    ['name' => 'narratorId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/geospatial/narrators/{narratorId}/trajectory', 'POST', 'Record narrator travel waypoint or residence relocation', 'Geospatial Network', true, [
    'type' => 'object',
    'required' => ['place_id', 'trajectory_type'],
    'properties' => [
        'place_id' => ['type' => 'integer', 'example' => 2],
        'trajectory_type' => ['type' => 'string', 'enum' => ['birth', 'death', 'residence', 'rihla', 'hearing'], 'example' => 'rihla'],
        'year_ah' => ['type' => 'integer', 'example' => 135],
        'duration_months' => ['type' => 'integer', 'example' => 6],
        'notes' => ['type' => 'string', 'example' => 'Travel to Kufa to study with Sufyan al-Thawri.'],
    ],
], [
    ['name' => 'narratorId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/geospatial/isnad-flow', 'GET', 'Geographic transmission flow arcs between transmitters for Hadith or Sanad', 'Geospatial Network', false, null, [
    ['name' => 'hadith_id', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'sanad_id', 'in' => 'query', 'schema' => ['type' => 'integer', 'example' => 539426]],
]);

// ----------------------------------------------------------------------------
// MODULE 6: REFERENCE IMPORT (BIBTEX / RIS) (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/references/preview-bibtex', 'POST', 'Parse and preview BibTeX or RIS bibliography content', 'Evidence & Annotations', true, [
    'type' => 'object',
    'required' => ['content'],
    'properties' => [
        'content' => ['type' => 'string', 'example' => "@book{bukhari1997,\n  title={Sahih al-Bukhari},\n  author={Al-Bukhari, Muhammad},\n  year={1997}\n}"],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/references/import-bibtex', 'POST', 'Ingest BibTeX / RIS bibliography into project library with deduplication', 'Evidence & Annotations', true, [
    'type' => 'object',
    'required' => ['content'],
    'properties' => [
        'content' => ['type' => 'string', 'example' => "@book{bukhari1997,\n  title={Sahih al-Bukhari},\n  author={Al-Bukhari, Muhammad},\n  year={1997}\n}"],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 5: SEARCH MONITORING & SUBSCRIPTIONS (R2b)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/search-subscriptions', 'GET', 'List automated search query alert subscriptions', 'Search Monitoring', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/search-subscriptions', 'POST', 'Create recurring search query subscription with change alert', 'Search Monitoring', true, [
    'type' => 'object',
    'required' => ['query_string'],
    'properties' => [
        'title' => ['type' => 'string', 'example' => 'Weekly monitor for Basran mutabaat'],
        'query_string' => ['type' => 'string', 'example' => 'حماد بن سلمة'],
        'search_type' => ['type' => 'string', 'enum' => ['hadith', 'narrator', 'combined'], 'example' => 'hadith'],
        'frequency' => ['type' => 'string', 'enum' => ['daily', 'weekly', 'corpus_update'], 'example' => 'weekly'],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/search-subscriptions/{id}/toggle', 'PATCH', 'Activate or pause automated search subscription', 'Search Monitoring', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

makePath($paths, '/projects/{projectId}/search-runs/compare', 'POST', 'Diff two historical search runs to detect newly indexed records', 'Search Monitoring', true, [
    'type' => 'object',
    'required' => ['run_a_id', 'run_b_id'],
    'properties' => [
        'run_a_id' => ['type' => 'integer', 'example' => 1],
        'run_b_id' => ['type' => 'integer', 'example' => 2],
    ],
], [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
]);

// ----------------------------------------------------------------------------
// MODULE 11: GRAPHML/CYTOSCAPE EXPORT & PACKAGE IMPORT (R3)
// ----------------------------------------------------------------------------
makePath($paths, '/projects/{projectId}/exports/graph', 'GET', 'Export project network / isnad topology as GraphML or Cytoscape JSON', 'Exports & Collaboration', true, null, [
    ['name' => 'projectId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'example' => 1]],
    ['name' => 'format', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['cytoscape', 'graphml', 'gephi'], 'default' => 'cytoscape']],
]);

makePath($paths, '/projects/import-package', 'POST', 'Ingest research project package (.zip / .json)', 'Exports & Collaboration', true, [
    'type' => 'object',
    'required' => ['package_file'],
    'properties' => [
        'package_file' => ['type' => 'string', 'format' => 'binary', 'description' => 'ZIP archive created by research platform export'],
    ],
]);

// Final Assembly
require __DIR__ . '/openapi_base.php';
$openApi['paths'] = $paths;

$json = json_encode($openApi, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

// Write to public directory and docs/api directory
$baseDir = function_exists('base_path') ? base_path() : dirname(__DIR__);
$repoDir = dirname($baseDir);
$docsDir = "{$baseDir}/public/docs";
$repoDocsDir = "{$repoDir}/docs/api";

if (!is_dir($docsDir)) {
    mkdir($docsDir, 0755, true);
}
if (!is_dir($repoDocsDir)) {
    mkdir($repoDocsDir, 0755, true);
}

file_put_contents("{$docsDir}/openapi.json", $json);
file_put_contents("{$repoDocsDir}/openapi.json", $json);

echo "OpenAPI 3.1 JSON generated successfully (" . count($paths) . " endpoints).\n";

// ----------------------------------------------------------------------------
// POSTMAN COLLECTION GENERATOR (v2.1)
// ----------------------------------------------------------------------------
$postmanItems = [];
foreach ($openApi['tags'] as $tag) {
    $folderName = $tag['name'];
    $folderItems = [];

    foreach ($paths as $pathKey => $methods) {
        foreach ($methods as $method => $op) {
            if (in_array($folderName, $op['tags'])) {
                $item = [
                    'name' => $op['summary'],
                    'request' => [
                        'method' => strtoupper($method),
                        'header' => [
                            ['key' => 'Accept', 'value' => 'application/json', 'type' => 'text'],
                        ],
                        'url' => [
                            'raw' => '{{base_url}}' . $pathKey,
                            'host' => ['{{base_url}}'],
                            'path' => explode('/', ltrim($pathKey, '/')),
                        ],
                        'description' => $op['summary'],
                    ],
                ];

                if (!empty($op['security'])) {
                    $item['request']['auth'] = [
                        'type' => 'bearer',
                        'bearer' => [
                            ['key' => 'token', 'value' => '{{auth_token}}', 'type' => 'string'],
                        ],
                    ];
                }

                if (!empty($op['requestBody']['content']['application/json']['schema']['properties'])) {
                    $bodyExample = [];
                    foreach ($op['requestBody']['content']['application/json']['schema']['properties'] as $prop => $def) {
                        $bodyExample[$prop] = $def['example'] ?? ($def['default'] ?? '');
                    }
                    $item['request']['body'] = [
                        'mode' => 'raw',
                        'raw' => json_encode($bodyExample, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                        'options' => ['raw' => ['language' => 'json']],
                    ];
                }

                $folderItems[] = $item;
            }
        }
    }

    if (!empty($folderItems)) {
        $postmanItems[] = [
            'name' => $folderName,
            'item' => $folderItems,
        ];
    }
}

$postman = [
    'info' => [
        'name' => 'Open Hadith Research Platform API Collection',
        'description' => 'Comprehensive Postman collection for all modules of the Open Hadith Research Platform.',
        'schema' => 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    ],
    'variable' => [
        ['key' => 'base_url', 'value' => 'http://127.0.0.1:8000/api/v1', 'type' => 'string'],
        ['key' => 'auth_token', 'value' => '', 'type' => 'string'],
    ],
    'item' => $postmanItems,
];

file_put_contents("{$repoDocsDir}/OpenHadith_Platform.postman_collection.json", json_encode($postman, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
file_put_contents("{$docsDir}/postman_collection.json", json_encode($postman, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

echo "Postman Collection v2.1 generated successfully (" . count($postmanItems) . " module folders).\n";

// ----------------------------------------------------------------------------
// FULL BRUNO COLLECTION GENERATOR (Complete .bru request files by folder)
// ----------------------------------------------------------------------------
$brunoDir = "{$repoDocsDir}/bruno";
if (!is_dir($brunoDir)) {
    mkdir($brunoDir, 0755, true);
}

file_put_contents("{$brunoDir}/bruno.json", json_encode([
    'version' => '1',
    'name' => 'Open Hadith Research Platform',
    'type' => 'collection',
    'ignore' => ['node_modules', '.git'],
], JSON_PRETTY_PRINT));

$environmentsDir = "{$brunoDir}/environments";
if (!is_dir($environmentsDir)) {
    mkdir($environmentsDir, 0755, true);
}

file_put_contents("{$environmentsDir}/Local.bru", "vars {\n  base_url: http://127.0.0.1:8000/api/v1\n  auth_token: \n}\n");

$tagIndex = 1;
$totalBruFiles = 0;

foreach ($openApi['tags'] as $tag) {
    $tagName = $tag['name'];
    $folderSlug = sprintf('%02d-%s', $tagIndex++, preg_replace('/[^a-zA-Z0-9]+/', '-', $tagName));
    $tagDir = "{$brunoDir}/{$folderSlug}";
    if (!is_dir($tagDir)) {
        mkdir($tagDir, 0755, true);
    }

    $seq = 1;
    foreach ($paths as $pathKey => $methods) {
        foreach ($methods as $method => $op) {
            if (!in_array($tagName, $op['tags'])) {
                continue;
            }

            $summary = $op['summary'];
            $fileSlug = preg_replace('/[^a-zA-Z0-9]+/', '_', trim($summary));
            $fileSlug = trim($fileSlug, '_');
            if (strlen($fileSlug) > 50) {
                $fileSlug = substr($fileSlug, 0, 50);
            }

            // Replace standard path params {param} with default example or 1 for direct usability
            $urlPath = preg_replace('/\{projectId\}/', '1', $pathKey);
            $urlPath = preg_replace('/\{familyId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{caseId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{memberId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{nodeId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{edgeId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{bookId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{narratorId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{requestId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{taskId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{threadId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{docId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{queryId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{setId\}/', '1', $urlPath);
            $urlPath = preg_replace('/\{id\}/', '1', $urlPath);

            $hasAuth = !empty($op['security']);
            $hasJsonBody = !empty($op['requestBody']['content']['application/json']['schema']['properties']);

            $bruContent = "meta {\n";
            $bruContent .= "  name: " . addcslashes($summary, "\n") . "\n";
            $bruContent .= "  type: http\n";
            $bruContent .= "  seq: {$seq}\n";
            $bruContent .= "}\n\n";

            $bruContent .= strtolower($method) . " {\n";
            $bruContent .= "  url: {{base_url}}" . $urlPath . "\n";
            $bruContent .= "  body: " . ($hasJsonBody ? "json" : "none") . "\n";
            $bruContent .= "  auth: " . ($hasAuth ? "bearer" : "none") . "\n";
            $bruContent .= "}\n\n";

            $bruContent .= "headers {\n";
            $bruContent .= "  Accept: application/json\n";
            if ($hasJsonBody) {
                $bruContent .= "  Content-Type: application/json\n";
            }
            $bruContent .= "}\n\n";

            if ($hasAuth) {
                $bruContent .= "auth:bearer {\n";
                $bruContent .= "  token: {{auth_token}}\n";
                $bruContent .= "}\n\n";
            }

            if ($hasJsonBody) {
                $bodyExample = [];
                foreach ($op['requestBody']['content']['application/json']['schema']['properties'] as $prop => $def) {
                    $bodyExample[$prop] = $def['example'] ?? ($def['default'] ?? '');
                }
                $jsonStr = json_encode($bodyExample, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $bruContent .= "body:json {\n" . $jsonStr . "\n}\n";
            }

            file_put_contents("{$tagDir}/{$fileSlug}.bru", $bruContent);
            $seq++;
            $totalBruFiles++;
        }
    }
}

echo "Bruno Collection generated successfully ({$totalBruFiles} .bru request files created across folders).\n";

