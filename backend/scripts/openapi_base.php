<?php

$openApi = [
    'openapi' => '3.1.0',
    'info' => [
        'title' => 'Open Hadith Research Platform API',
        'description' => "Empirical, scholarly, and computational research platform for Hadith studies.\n\nDual database architecture:\n- **Corpus Adapter (`hadiths_v2`)**: High-performance gateway into 1.13M classical Hadith occurrences, sanad chains, and biographical entries.\n- **Research Platform (`hadith_research_platform`)**: Workspace isolation for scholars, hypothesis testing, lexical diffing, topological transmission analysis, and peer-reviewed monograph publishing.",
        'version' => '1.0.0',
        'contact' => [
            'name' => 'Dr. Polla Abdulhamid Fattah',
            'url' => 'https://polla.dev',
            'email' => 'polla@sue.edu.krd',
        ],
        'license' => [
            'name' => 'Academic / Open Access',
            'url' => 'https://opensource.org/licenses/MIT',
        ],
    ],
    'servers' => [
        [
            'url' => 'http://127.0.0.1:8000/api/v1',
            'description' => 'Local Development Server',
        ],
        [
            'url' => 'http://localhost:8000/api/v1',
            'description' => 'Alternative Localhost',
        ],
    ],
    'components' => [
        'securitySchemes' => [
            'bearerAuth' => [
                'type' => 'http',
                'scheme' => 'bearer',
                'bearerFormat' => 'Sanctum Token',
                'description' => 'Enter your Sanctum API token obtained from /auth/login. Seeded credentials: polla@sue.edu.krd / password123',
            ],
        ],
        'schemas' => [
            'StandardSuccessResponse' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean', 'example' => true],
                    'message' => ['type' => 'string', 'example' => 'Request completed successfully.'],
                    'data' => ['type' => 'object'],
                    'meta' => [
                        'type' => 'object',
                        'properties' => [
                            'timestamp' => ['type' => 'string', 'format' => 'date-time'],
                            'version' => ['type' => 'string', 'example' => 'v1'],
                        ],
                    ],
                ],
            ],
            'StandardErrorResponse' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean', 'example' => false],
                    'error' => [
                        'type' => 'object',
                        'properties' => [
                            'code' => ['type' => 'string', 'example' => 'VALIDATION_ERROR'],
                            'message' => ['type' => 'string', 'example' => 'Invalid input parameters.'],
                            'details' => ['type' => 'object'],
                        ],
                    ],
                    'meta' => [
                        'type' => 'object',
                        'properties' => [
                            'timestamp' => ['type' => 'string', 'format' => 'date-time'],
                            'version' => ['type' => 'string', 'example' => 'v1'],
                        ],
                    ],
                ],
            ],
        ],
    ],
    'tags' => [
        ['name' => 'Auth & Identity', 'description' => 'Researcher authentication, profile management, and vetting applications (Module 1)'],
        ['name' => 'Corpus Adapter', 'description' => 'High-performance read-only queries into 1.13M classical Hadith records (Module 2)'],
        ['name' => 'Personal Library', 'description' => 'Personal bookmarking, notes, and private collections (Module 3)'],
        ['name' => 'Project Workspaces', 'description' => 'Research workspace isolation, scoping, and collaboration roles (Module 4)'],
        ['name' => 'Saved Searches & Result Sets', 'description' => 'Search definitions, historical runs, and immutable frozen snapshots (Module 5)'],
        ['name' => 'Evidence & Annotations', 'description' => 'Verbatim evidence capture, content hashes, bibliography, and scholarly annotations (Module 6)'],
        ['name' => 'Analysis Workbench', 'description' => 'Algorithmic Matn compare, Isnād Madār/Common Link detection, and Jarḥ wa Taʿdīl matrix (Module 7)'],
        ['name' => 'Findings & Documents', 'description' => 'Empirical hypotheses, Markdown monograph versioning, and canonical citations (Module 8)'],
        ['name' => 'Announcements & Submissions', 'description' => 'Public project announcements and research package submissions (Module 9)'],
        ['name' => 'Editorial Review & Publications', 'description' => 'Peer review queue, conflict-of-interest assignment, decisions, and public monographs (Module 10)'],
        ['name' => 'Exports & Collaboration', 'description' => 'Asynchronous ZIP/JSON exports, discussion threads, and project task management (Module 11)'],
        ['name' => 'Admin & Corpus Errata', 'description' => 'Administrative vetting, user account control, audit logs, and corpus correction proposals (Module 12)'],
        ['name' => 'Collaboration & Workflows', 'description' => 'Invitations, role management, dispute reviews, task blockers, and concurrent locks (Module 13 / R1b)'],
        ['name' => 'Notification Center', 'description' => 'In-app notification alerts, digest frequencies, and preferences (Module 14 / R1b)'],
        ['name' => 'Argumentation Graph', 'description' => 'Dialectical debate trees, nodes, premises, rebuttals, and directed epistemic edges (Module 8 / R2b)'],
        ['name' => 'Historical Assertions', 'description' => 'Historical assertions, certainty degrees, and empirical citations (Module 6 / R2b)'],
        ['name' => 'Project Templates', 'description' => 'Preconfigured research templates and workflow scaffolding (Module 4 / R2b)'],
        ['name' => 'Geospatial Network', 'description' => 'Historical transmission geography, narrator travel itineraries, and transmission flow arcs (Module 15 / R2b)'],
        ['name' => 'Search Monitoring', 'description' => 'Automated search query subscriptions and corpus diffing (Module 5 / R2b)'],
    ],
    'paths' => [],
];
