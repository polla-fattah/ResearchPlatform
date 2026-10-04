<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\ResearcherProfile;
use App\Models\ResearcherApplication;
use App\Models\Resource;
use App\Models\LibraryItem;
use App\Models\ResourceCollection;
use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\ProjectResource;
use App\Models\SavedQuery;
use App\Models\SearchRun;
use App\Models\ResultSet;
use App\Models\ResultSetMember;
use App\Models\EvidenceItem;
use App\Models\Annotation;
use App\Models\AnalysisRun;
use App\Models\Finding;
use App\Models\FindingEvidence;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Citation;
use App\Models\DiscussionThread;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Announcement;
use App\Models\Submission;
use App\Models\ReviewAssignment;
use App\Models\EditorialDecision;
use App\Models\Publication;

class ScholarlyDemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->command?->info("Seeding scholarly research case study: 'The Niyyah Tradition'...");

        // --------------------------------------------------------------------
        // 1. SCHOLARLY PERSONAS & IDENTITIES
        // --------------------------------------------------------------------
        $polla = User::firstOrCreate(
            ['email' => 'polla@sue.edu.krd'],
            [
                'display_name' => 'Dr. Polla Abdulhamid Fattah',
                'password' => Hash::make('password123'),
                'preferred_language' => 'ar',
                'status' => 'approved',
                'is_admin' => true,
            ]
        );

        ResearcherProfile::updateOrCreate(
            ['user_id' => $polla->id],
            [
                'affiliation' => 'Salahaddin University-Erbil (SUE) & Artificial Intelligence and Innovation Centre (AIIC), UKH',
                'biography' => 'Lecturer & Head of Data Analysis Unit. Specializes in Data Mining, NLP, and computational approaches to Islamic scholarship (Open Hadith project).',
                'research_interests' => ['Computational Hadith', 'Isnād Network Topology', 'Arabic NLP', 'Association Rule Mining', 'Digital Preservation'],
                'is_public' => true,
                'public_fields' => ['affiliation' => true, 'biography' => true, 'research_interests' => true],
            ]
        );

        $ahmad = User::firstOrCreate(
            ['email' => 'ahmad.khatib@hadith.local'],
            [
                'display_name' => 'Dr. Ahmad Al-Khatib',
                'password' => Hash::make('password123'),
                'preferred_language' => 'ar',
                'status' => 'approved',
                'is_admin' => false,
            ]
        );

        ResearcherProfile::updateOrCreate(
            ['user_id' => $ahmad->id],
            [
                'affiliation' => 'College of Islamic Studies, University of Baghdad',
                'biography' => 'Specialist in 2nd-century Tabaqāt and transmission geography across Iraq and the Levant.',
                'research_interests' => ['Tabaqāt al-Ruwāt', 'Jarḥ wa Taʿdīl', 'Early Hadith Recensions'],
                'is_public' => true,
            ]
        );

        $reviewer1 = User::firstOrCreate(
            ['email' => 'tariq.basri@hadith.local'],
            [
                'display_name' => 'Prof. Dr. Tariq Al-Basri',
                'password' => Hash::make('password123'),
                'preferred_language' => 'ar',
                'status' => 'approved',
                'is_admin' => false,
            ]
        );

        ResearcherProfile::updateOrCreate(
            ['user_id' => $reviewer1->id],
            [
                'affiliation' => 'Department of Hadith Sciences, Al-Azhar University',
                'biography' => 'Senior peer reviewer and expert in Ilal al-Hadith and regional transmission chains.',
                'research_interests' => ['ʿIlal al-Hadīth', 'Common Link Analysis', 'Manuscript Collation'],
                'is_public' => true,
            ]
        );

        $reviewer2 = User::firstOrCreate(
            ['email' => 'fatima.zahra@hadith.local'],
            [
                'display_name' => 'Dr. Fatima Al-Zahra Al-Dimashqi',
                'password' => Hash::make('password123'),
                'preferred_language' => 'ar',
                'status' => 'approved',
                'is_admin' => false,
            ]
        );

        $editor = User::firstOrCreate(
            ['email' => 'editor@openhadith.org'],
            [
                'display_name' => 'Executive Editor (Editorial Board)',
                'password' => Hash::make('password123'),
                'preferred_language' => 'ar',
                'status' => 'approved',
                'is_admin' => true,
            ]
        );

        // --------------------------------------------------------------------
        // 2. PERSONAL LIBRARY ("MY LIBRARY") RESOURCES
        // --------------------------------------------------------------------
        $resBukhari1 = Resource::firstOrCreate(
            ['title' => 'Sahih al-Bukhari #1 — Bad\' al-Wahy'],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_table' => 'hadiths',
                'corpus_id' => 1,
                'author' => 'Imām Muhammad ibn Ismāʿīl al-Bukhārī',
                'source_metadata' => [
                    'book' => 'Sahih al-Bukhari',
                    'chapter' => 'Kaifa kān bad\' al-wahy',
                    'hadith_number' => '1',
                    'locator' => 'Vol. 1, Book 1, Hadith 1',
                ],
                'rights_status' => 'open',
                'provenance' => 'Transmitted from al-Humaydi -> Sufyan -> Yahya ibn Sa\'id al-Ansari -> Muhammad ibn Ibrahim al-Taymi -> Alqamah ibn Waqqas -> Umar ibn al-Khattab',
            ]
        );

        $resMuslim1907 = Resource::firstOrCreate(
            ['title' => 'Sahih Muslim #1907 — Kitāb al-Imārah'],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_table' => 'hadiths',
                'corpus_id' => 1907,
                'author' => 'Imām Muslim ibn al-Hajjāj al-Naysābūrī',
                'source_metadata' => [
                    'book' => 'Sahih Muslim',
                    'chapter' => 'Qawlihi: Innamā al-a\'mālu bin-niyyah',
                    'hadith_number' => '1907',
                    'locator' => 'Book 33, Hadith 200',
                ],
                'rights_status' => 'open',
                'provenance' => 'Transmitted from Abdullah ibn Maslamah ibn Qa\'nab -> Malik ibn Anas -> Yahya ibn Sa\'id al-Ansari',
            ]
        );

        $resTirmidhi1647 = Resource::firstOrCreate(
            ['title' => 'Jami\' al-Tirmidhi #1647 — Fadl al-Jihad'],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_table' => 'hadiths',
                'corpus_id' => 1647,
                'author' => 'Imām Abu ʿĪsā al-Tirmidhī',
                'source_metadata' => [
                    'book' => 'Jami al-Tirmidhi',
                    'chapter' => 'Fadl al-Jihad',
                    'hadith_number' => '1647',
                ],
                'rights_status' => 'open',
                'provenance' => 'Transmitted from Qutaybah -> Hammad ibn Zayd -> Yahya ibn Sa\'id al-Ansari',
            ]
        );

        $resIbnHajar = Resource::firstOrCreate(
            ['title' => 'Tahdhīb al-Tahdhīb — Entry: Yahya ibn Sa\'id al-Ansari'],
            [
                'resource_type' => 'corpus_narrator',
                'corpus_table' => 'narrators',
                'corpus_id' => 110,
                'author' => 'Ibn Hajar al-ʿAsqalānī',
                'source_metadata' => [
                    'title' => 'Tahdhib al-Tahdhib',
                    'volume' => '11',
                    'page' => '221',
                ],
                'rights_status' => 'open',
                'provenance' => 'Dar al-Kutub al-Ilmiyyah, Beirut (1994)',
            ]
        );

        // Add to Dr. Polla's Personal Library
        LibraryItem::firstOrCreate(
            ['user_id' => $polla->id, 'resource_id' => $resBukhari1->id],
            ['is_favourite' => true, 'personal_notes' => 'Crucial foundation tradition. Al-Humaydi explicitly places this as the epistemological threshold of prophetic guidance.']
        );

        LibraryItem::firstOrCreate(
            ['user_id' => $polla->id, 'resource_id' => $resMuslim1907->id],
            ['is_favourite' => true, 'personal_notes' => 'Notice the Medinan grammatical preference: "الأعمال بالنية" in singular vs. the Iraqi plural "بالنيات".']
        );

        // Custom Collection
        $collection = ResourceCollection::firstOrCreate(
            ['owner_type' => 'user', 'owner_id' => $polla->id, 'name' => 'Pivotal Madār Traditions (Hijaz & Iraq)'],
            ['description' => 'Curated corpus references focusing on singular bottleneck transmissions that experienced subsequent massive diffusion.']
        );

        DB::table('collection_resources')->insertOrIgnore([
            ['collection_id' => $collection->id, 'resource_id' => $resBukhari1->id, 'created_at' => now()],
            ['collection_id' => $collection->id, 'resource_id' => $resMuslim1907->id, 'created_at' => now()],
            ['collection_id' => $collection->id, 'resource_id' => $resTirmidhi1647->id, 'created_at' => now()],
        ]);

        // --------------------------------------------------------------------
        // 3. RESEARCH PROJECT WORKSPACE
        // --------------------------------------------------------------------
        $project = ResearchProject::firstOrCreate(
            ['title' => 'The Isnād Dynamics and Lexical Diffusion of the Niyyah Tradition in 2nd Century Hijaz and Iraq'],
            [
                'owner_id' => $polla->id,
                'question' => 'Why did a tradition universally deemed Gharīb (transmitted exclusively through Umar, Alqamah, Muhammad ibn Ibrahim, and Yahya ibn Sa\'id al-Ansari) exhibit such massive combinatorial explosion in Iraq and Khurasan after 140 AH?',
                'scope' => 'Comparative collation of 18 early recensions across Bukhari, Muslim, Abu Dawud, Tirmidhi, and Musnad Ahmad, combining topological graph analysis of transmission chains with Arabic lexical diffing.',
                'primary_language' => 'ar',
                'stage' => 'completed',
                'is_archived' => false,
            ]
        );

        // Project Collaboration Memberships
        ProjectMembership::firstOrCreate(
            ['project_id' => $project->id, 'user_id' => $ahmad->id],
            ['role' => 'researcher', 'status' => 'accepted', 'invited_by' => $polla->id, 'accepted_at' => now()]
        );

        ProjectMembership::firstOrCreate(
            ['project_id' => $project->id, 'user_id' => $reviewer1->id],
            ['role' => 'reviewer', 'status' => 'accepted', 'invited_by' => $polla->id, 'accepted_at' => now()]
        );

        // Project Bibliography Resources
        ProjectResource::firstOrCreate(
            ['project_id' => $project->id, 'resource_id' => $resBukhari1->id],
            ['added_by' => $polla->id, 'inclusion_rationale' => 'Baseline canonical recension (Al-Humaydi -> Sufyan -> Yahya).', 'tags' => ['Canonical', 'Hijazi', 'Baseline']]
        );

        ProjectResource::firstOrCreate(
            ['project_id' => $project->id, 'resource_id' => $resMuslim1907->id],
            ['added_by' => $polla->id, 'inclusion_rationale' => 'Medinan recension through Imam Malik ibn Anas.', 'tags' => ['Medinan', 'Singular_Grammar', 'Canonical']]
        );

        ProjectResource::firstOrCreate(
            ['project_id' => $project->id, 'resource_id' => $resTirmidhi1647->id],
            ['added_by' => $ahmad->id, 'inclusion_rationale' => 'Iraqi recension through Hammad ibn Zayd (Basra).', 'tags' => ['Iraqi', 'Basran', 'Jihad_Context']]
        );

        // --------------------------------------------------------------------
        // 4. SAVED SEARCHES & FROZEN RESULT SETS
        // --------------------------------------------------------------------
        $savedQuery = SavedQuery::firstOrCreate(
            ['owner_type' => 'project', 'owner_id' => $project->id, 'name' => 'Niyyah Hadith Canonical Occurrences'],
            [
                'query_text' => 'الاعمال بالنيات',
                'search_mode' => 'fts',
                'filter_criteria' => ['type' => 'marfu', 'corpus' => 'hadiths_v2'],
            ]
        );

        $searchRun = SearchRun::firstOrCreate(
            ['saved_query_id' => $savedQuery->id],
            [
                'corpus_version' => 'hadiths_v2.0',
                'match_count' => 18,
                'status' => 'completed',
                'execution_duration_ms' => 3,
                'created_at' => now()->subDays(10),
            ]
        );

        $resultSet = ResultSet::firstOrCreate(
            ['project_id' => $project->id, 'name' => 'Canonical Niyyah Cohort (Baseline v1)'],
            [
                'search_run_id' => $searchRun->id,
                'is_frozen' => true,
                'total_count' => 3,
                'created_at' => now()->subDays(10),
            ]
        );

        ResultSetMember::firstOrCreate(
            ['result_set_id' => $resultSet->id, 'ordinal_position' => 1],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_id' => 1,
                'snapshot_data' => [
                    'source' => 'Sahih al-Bukhari',
                    'sanad' => 'Al-Humaydi -> Sufyan -> Yahya ibn Sa\'id -> Muhammad ibn Ibrahim -> Alqamah -> Umar',
                    'verbatim_matn' => 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى دنيا يصيبها، أو إلى امرأة ينكحها، فهجرته إلى ما هاجر إليه',
                ],
                'created_at' => now()->subDays(10),
            ]
        );

        ResultSetMember::firstOrCreate(
            ['result_set_id' => $resultSet->id, 'ordinal_position' => 2],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_id' => 1907,
                'snapshot_data' => [
                    'source' => 'Sahih Muslim',
                    'sanad' => 'Ibn Qa\'nab -> Malik -> Yahya ibn Sa\'id -> Muhammad ibn Ibrahim -> Alqamah -> Umar',
                    'verbatim_matn' => 'إنما الأعمال بالنية، وإنما لامرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله...',
                ],
                'created_at' => now()->subDays(10),
            ]
        );

        ResultSetMember::firstOrCreate(
            ['result_set_id' => $resultSet->id, 'ordinal_position' => 3],
            [
                'resource_type' => 'corpus_hadith',
                'corpus_id' => 1647,
                'snapshot_data' => [
                    'source' => 'Jami al-Tirmidhi',
                    'sanad' => 'Qutaybah -> Hammad ibn Zayd -> Yahya ibn Sa\'id -> Muhammad ibn Ibrahim -> Alqamah -> Umar',
                    'verbatim_matn' => 'الأعمال بالنية ولكل امرئ ما نوى...',
                ],
                'created_at' => now()->subDays(10),
            ]
        );

        // --------------------------------------------------------------------
        // 5. EVIDENCE ITEMS & SCHOLARLY ANNOTATIONS
        // --------------------------------------------------------------------
        $evi1 = EvidenceItem::firstOrCreate(
            ['project_id' => $project->id, 'locator' => 'Bukhari, Kitab Bad\' al-Wahy, Hadith 1'],
            [
                'resource_id' => $resBukhari1->id,
                'captured_text' => 'سمعت علقمة بن وقاص الليثي يقول: سمعت عمر بن الخطاب رضي الله عنه على المنبر قال: سمعت رسول الله صلى الله عليه وسلم يقول: إنما الأعمال بالنيات وإنما لكل امرئ ما نوى...',
                'source_version' => 'Sultaniyyah Edition',
                'content_hash' => hash('sha256', 'Bukhari 1 Verbatim'),
                'state' => 'included',
                'collector_id' => $polla->id,
            ]
        );

        Annotation::firstOrCreate(
            ['author_id' => $polla->id, 'target_type' => 'evidence', 'target_id' => $evi1->id],
            [
                'span_start' => 0,
                'span_end' => 85,
                'annotation_kind' => 'scholarly_judgment',
                'visibility' => 'project_shared',
                'body' => 'Ibn al-Madini and Ali ibn al-Madini explicitly observed that this hadith has NO corroborating companion routes (Tafarrada bihi Umar). Al-Bukhari deliberately opens with it to underline that sincerity precedes all transmitted knowledge.',
            ]
        );

        $evi2 = EvidenceItem::firstOrCreate(
            ['project_id' => $project->id, 'locator' => 'Muslim, Kitab al-Imarah, Hadith 1907'],
            [
                'resource_id' => $resMuslim1907->id,
                'captured_text' => 'حدثنا عبد الله بن مسلمة بن قعنب حدثنا مالك عن يحيى بن سعيد عن محمد بن إبراهيم عن علقمة بن وقاص عن عمر بن الخطاب: إنما الأعمال بالنية وإنما لكل امرئ ما نوى...',
                'source_version' => 'Dar Ihya al-Turath',
                'content_hash' => hash('sha256', 'Muslim 1907 Verbatim'),
                'state' => 'included',
                'collector_id' => $polla->id,
            ]
        );

        Annotation::firstOrCreate(
            ['author_id' => $ahmad->id, 'target_type' => 'evidence', 'target_id' => $evi2->id],
            [
                'span_start' => 120,
                'span_end' => 160,
                'annotation_kind' => 'interpretation',
                'visibility' => 'project_shared',
                'body' => 'Notice the singular phrasing "بالنية" consistently preserved in the Muwatta recension of Malik, demonstrating early Hijazi graphemic stability prior to the Iraqi plural standardization.',
            ]
        );

        $evi3 = EvidenceItem::firstOrCreate(
            ['project_id' => $project->id, 'locator' => 'Spurious attribution attributed to Abu Hurayrah'],
            [
                'resource_id' => $resTirmidhi1647->id,
                'captured_text' => 'روي من طريق هشام بن عروة عن أبيه عن أبي هريرة مرفوعا: إنما الأعمال بالنيات...',
                'source_version' => 'Kitab al-Majruhin',
                'content_hash' => hash('sha256', 'Spurious Route'),
                'state' => 'excluded',
                'exclusion_reason' => 'Judged as a concocted/interpolated tarikh route by al-Daraqutni in al-Ilal; the narrator experienced Wahm trying to find an alternative companion for a known Gharib.',
                'collector_id' => $ahmad->id,
            ]
        );

        // --------------------------------------------------------------------
        // 6. ANALYSIS WORKBENCH RUNS
        // --------------------------------------------------------------------
        // A. Matn Compare
        AnalysisRun::firstOrCreate(
            ['project_id' => $project->id, 'analysis_type' => 'matn_comparison', 'version_number' => 1],
            [
                'input_params' => [
                    'hadith_ids' => [1, 1907, 1647],
                    'algorithm' => 'lexical_ngram_diff',
                    'normalization' => 'arabic_strict',
                ],
                'output_data' => [
                    'consensus_core' => 'انما الاعمال بالنيه وانما لكل امرئ ما نوي فمن كانت هجرته',
                    'lexical_overlap_ratio' => 88.4,
                    'variants' => [
                        [
                            'source' => 'Bukhari (Humaydi)',
                            'plurality' => 'بالنيات (Plural)',
                            'phrase_order' => 'Dunya mentioned before Imra\'ah',
                        ],
                        [
                            'source' => 'Muslim (Malik)',
                            'plurality' => 'بالنية (Singular)',
                            'phrase_order' => 'Hijrah to Allah & Messenger affirmed first',
                        ],
                    ],
                    'pivotal_ziyadah' => [
                        'term' => 'فهجرته الى ما هاجر اليه',
                        'scholarly_classification' => 'Muttafaq Alayh conclusion',
                    ],
                ],
                'created_by' => $polla->id,
                'created_at' => now()->subDays(7),
            ]
        );

        // B. Isnad Compare (Common Link / Madar)
        AnalysisRun::firstOrCreate(
            ['project_id' => $project->id, 'analysis_type' => 'isnad_comparison', 'version_number' => 1],
            [
                'input_params' => [
                    'chains_analyzed' => 4,
                    'convergence_algorithm' => 'tree_bottleneck_detection',
                ],
                'output_data' => [
                    'universal_common_link' => [
                        'name' => 'Yahya ibn Sa\'id al-Ansari (d. 143 AH)',
                        'role' => 'Absolute Madār (مدار الإسناد المطلق)',
                        'frequency' => '4/4 (100%)',
                        'location' => 'Medina / Baghdad',
                    ],
                    'pre_link_pathway' => [
                        'depth' => 3,
                        'strands' => 1,
                        'nodes' => [
                            'Umar ibn al-Khattab (Sahabi)',
                            'Alqamah ibn Waqqas al-Laythi (Senior Tabi\'i)',
                            'Muhammad ibn Ibrahim al-Taymi (Middle Tabi\'i)',
                            'Yahya ibn Sa\'id al-Ansari (Junior Tabi\'i / Common Link)',
                        ],
                    ],
                    'post_link_divergence' => [
                        'Hijaz Branch' => 'Malik ibn Anas (Medina), Sufyan ibn Uyaynah (Mecca)',
                        'Iraq Branch' => 'Sufyan al-Thawri (Kufa), Hammad ibn Zayd (Basra), Hammad ibn Salamah (Basra)',
                        'Khurasan Branch' => 'Abdullah ibn al-Mubarak (Merv)',
                    ],
                    'divergence_order' => 4,
                ],
                'created_by' => $polla->id,
                'created_at' => now()->subDays(6),
            ]
        );

        // C. Criticism Matrix
        AnalysisRun::firstOrCreate(
            ['project_id' => $project->id, 'analysis_type' => 'criticism_matrix', 'version_number' => 1],
            [
                'input_params' => [
                    'target_narrators' => ['Yahya ibn Sa\'id al-Ansari', 'Muhammad ibn Ibrahim al-Taymi', 'Alqamah ibn Waqqas'],
                ],
                'output_data' => [
                    'consensus_status' => 'Unanimous Ta\'dil (إجماع على التوثيق المطلق)',
                    'matrix' => [
                        'Yahya ibn Sa\'id' => [
                            'Ahmad ibn Hanbal' => 'Thiqah Thabat, Hujjah, Imam',
                            'Ibn Ma\'in' => 'Thiqah Ma\'mun',
                            'Al-Nasa\'i' => 'Thiqah Thabat',
                        ],
                        'Muhammad ibn Ibrahim al-Taymi' => [
                            'Ibn Sa\'d' => 'Thiqah Kathir al-Hadith',
                            'Abu Hatim al-Razi' => 'Thiqah mutqan',
                        ],
                    ],
                    'conclusion' => 'The singular transmission is due to individual transmission privilege (Ikhtisās), not deficiency in memory or probity.',
                ],
                'created_by' => $polla->id,
                'created_at' => now()->subDays(5),
            ]
        );

        // --------------------------------------------------------------------
        // 7. FINDINGS & CLAIMS
        // --------------------------------------------------------------------
        $f1 = Finding::firstOrCreate(
            ['project_id' => $project->id, 'question' => 'Does the singular transmission (Gharabah) of the Niyyah tradition undermine its historical authenticity?'],
            [
                'claim' => 'The absolute singularity (Fard Mutlaq) up to Yahya ibn Sa\'id is authentic and reflects a pedagogical transmission arc rather than fabrication.',
                'reasoning' => 'The four links in the single-strand chain are all Tier-1 authorities (Thiqat Thubut) with immaculate records. The transmission bottleneck was held by the Medinan judiciary (Alqamah and Yahya both held judicial roles in the Prophet\'s city), explaining why private pedagogical delivery did not circulate in general sermon gatherings until Yahya traveled to Iraq.',
                'limitations' => 'Does not account for non-extant regional registers that may have existed in Yemen or Egypt during the 1st century.',
                'status' => 'supported',
            ]
        );

        FindingEvidence::firstOrCreate(
            ['finding_id' => $f1->id, 'evidence_id' => $evi1->id],
            ['relation_type' => 'supporting', 'interpretation' => 'Demonstrates unbroken chain through the Madani legal elite.']
        );

        FindingEvidence::firstOrCreate(
            ['finding_id' => $f1->id, 'evidence_id' => $evi3->id],
            ['relation_type' => 'opposing', 'interpretation' => 'Confirms that later attempts to invent parallel chains were rejected by the early critics as spurious.']
        );

        $f2 = Finding::firstOrCreate(
            ['project_id' => $project->id, 'question' => 'What explains the grammatical bifurcation between "بالنية" and "بالنيات"?'],
            [
                'claim' => 'The singular "بالنية" is the original Hijazi dialectal recension preserved by Malik, while the plural "بالنيات" is the Iraqi standardization adopted in Kufa and Basra.',
                'reasoning' => 'Collation of early Muwatta manuscripts shows universal retention of the singular form, whereas Kufan transmitters consistently recorded the plural form.',
                'status' => 'supported',
            ]
        );

        FindingEvidence::firstOrCreate(
            ['finding_id' => $f2->id, 'evidence_id' => $evi2->id],
            ['relation_type' => 'supporting', 'interpretation' => 'Direct empirical proof from the Medinan transmission of Malik.']
        );

        // --------------------------------------------------------------------
        // 8. RESEARCH DOCUMENTS, VERSIONS & CITATIONS
        // --------------------------------------------------------------------
        $doc = Document::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'The Anatomy of a Gharīb Bottleneck: Transmission Dynamics of the Niyyah Tradition'],
            [
                'document_type' => 'article',
                'language' => 'ar',
            ]
        );

        $docContent = <<<MARKDOWN
# The Anatomy of a Gharīb Bottleneck: Transmission Dynamics of the Niyyah Tradition

**Principal Investigator:** Dr. Polla Abdulhamid Fattah  
**Affiliation:** Salahaddin University-Erbil (SUE) & AIIC, University of Kurdistan Hewlêr  
**Co-Researcher:** Dr. Ahmad Al-Khatib (University of Baghdad)  

---

## 1. Abstract
The prophetic tradition *"Innamā al-aʿmālu bin-niyyāt"* (Actions are judged by intentions) occupies a peerless station in Islamic jurisprudence, frequently designated by al-Shāfiʿī and Aḥmad ibn Ḥanbal as constituting "one-third of all religious knowledge." Nevertheless, from a formal isnād topology perspective, the tradition constitutes an extreme exemplar of *Gharīb Muṭlaq* (an absolute single-strand transmission) persisting through four successive generational tiers before undergoing an astonishing combinatorial explosion. This study provides an empirical collation of 18 classical recensions, identifying the precise Common Link (*Madār*) at Yaḥyā ibn Saʿīd al-Anṣārī (d. 143 AH) and examining the morphological bifurcation between the Ḥijāzī singular (*al-niyyah*) and Iraqi plural (*al-niyyāt*).

## 2. Topological Analysis of the Transmission Bottleneck
Classical critics from ʿAlī ibn al-Madīnī to al-Dāraquṭnī concurred that no authentic pathway connects this tradition to the Prophet صلى الله عليه وسلم except through the following solitary conduit:

$$\text{Prophet} \longrightarrow \text{ʿUmar ibn al-Khaṭṭāb} \longrightarrow \text{ʿAlqamah ibn Waqqāṣ} \longrightarrow \text{Muḥammad ibn Ibrāhīm al-Taymī} \longrightarrow \text{Yaḥyā ibn Saʿīd al-Anṣārī}$$

Our algorithmic isnād comparison confirms that **Yaḥyā ibn Saʿīd al-Anṣārī** represents the universal pivot ($100\%$ presence across all authenticated canonical chains). Downstream from Yaḥyā, we document no fewer than **200 distinct transmission lines** radiating outward into Kūfah, Baṣrah, Madīnah, Damascus, and Khurāsān.

## 3. Lexical Variance and Grammatical Collation
Lexical diff analysis of the canonical witnesses highlights two distinct textual traditions:
1. **The Medinan Recension:** Preserved by Imām Mālik ibn Anas (*Muwaṭṭaʾ*), utilizing the singular construct:
   > *"إنما الأعمال بالنية، وإنما لامرئ ما نوى..."*
2. **The Iraqi Recension:** Transmitted by Sufyān al-Thawrī and Ḥammād ibn Zayd, establishing the plural construct:
   > *"إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى..."*

## 4. Conclusion
The singularity of the Niyyah tradition does not denote historical vulnerability; rather, it reflects early institutional custody within the judicial leadership of Medina prior to the mid-2nd century academic diffusion in Iraq.
MARKDOWN;

        $docVersion = DocumentVersion::firstOrCreate(
            ['document_id' => $doc->id, 'version_number' => 1],
            [
                'content' => $docContent,
                'author_id' => $polla->id,
                'change_summary' => 'Initial scholarly monograph complete with full isnad topology and lexical analysis.',
            ]
        );

        Citation::firstOrCreate(
            ['document_version_id' => $docVersion->id, 'resource_id' => $resBukhari1->id],
            [
                'evidence_id' => $evi1->id,
                'locator' => 'Sahih al-Bukhari, Hadith 1',
                'citation_type' => 'direct_quotation',
                'formatted_citation' => 'Al-Bukhārī, Muḥammad ibn Ismāʿīl. *Ṣaḥīḥ al-Bukhārī*. Edited by Muḥammad Zuhayr al-Nāṣir. Beirut: Dār Ṭawq al-Najāh, 1422 AH, Vol. 1, p. 6, Hadith 1.',
            ]
        );

        Citation::firstOrCreate(
            ['document_version_id' => $docVersion->id, 'resource_id' => $resMuslim1907->id],
            [
                'evidence_id' => $evi2->id,
                'locator' => 'Sahih Muslim, Hadith 1907',
                'citation_type' => 'direct_quotation',
                'formatted_citation' => 'Muslim ibn al-Ḥajjāj. *Ṣaḥīḥ Muslim*. Edited by Muḥammad Fuʾād ʿAbd al-Bāqī. Cairo: Dār Iḥyāʾ al-Kutub al-ʿArabiyyah, 1955, Vol. 3, p. 1515, Hadith 1907.',
            ]
        );

        // --------------------------------------------------------------------
        // 9. COLLABORATION THREADS & TASKS
        // --------------------------------------------------------------------
        $thread = DiscussionThread::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'Evaluation of the Basran Variant via Hammad ibn Zayd'],
            [
                'target_type' => 'evidence',
                'target_id' => $evi2->id,
                'is_resolved' => true,
                'resolved_by' => $polla->id,
                'resolved_at' => now()->subDays(3),
            ]
        );

        Comment::firstOrCreate(
            ['thread_id' => $thread->id, 'author_id' => $ahmad->id],
            ['content' => 'I verified the narration in Musnad al-Humaydi (#3). The text matches Bukhari verbatim, which indicates Sufyan ibn Uyaynah held a very stable copy from Yahya during their time together in Mecca.']
        );

        Comment::firstOrCreate(
            ['thread_id' => $thread->id, 'author_id' => $polla->id],
            ['content' => 'Excellent observation. We have integrated this finding into Section 3 of the final manuscript and anchored the citation. Marking discussion as resolved.']
        );

        Task::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'Collate Musnad Ahmad variants for the Basran recension'],
            [
                'description' => 'Extract all occurrences of Yahya ibn Sa\'id in Musnad Ahmad under Musnad Umar ibn al-Khattab to map variant suffixes.',
                'assignee_id' => $ahmad->id,
                'due_date' => now()->subDays(2),
                'status' => 'done',
                'completed_at' => now()->subDays(2),
            ]
        );

        // --------------------------------------------------------------------
        // 10. EDITORIAL PEER REVIEW & PUBLIC MONOGRAPH RELEASE
        // --------------------------------------------------------------------
        $announcement = Announcement::firstOrCreate(
            ['project_id' => $project->id],
            [
                'public_slug' => 'niyyah-isnad-dynamics-2nd-century',
                'title' => 'Open Investigation: The Isnād Dynamics and Lexical Diffusion of the Niyyah Tradition',
                'summary' => 'Comprehensive empirical study combining computational graph analysis of transmission chains with Arabic lexical diffing across 18 canonical recensions.',
                'research_stage' => 'completed',
                'keywords' => ['Niyyah', 'Gharib', 'Common_Link', 'Arabic_NLP', 'Hadith_Studies'],
                'status' => 'published',
                'published_at' => now()->subDays(4),
            ]
        );

        $submission = Submission::firstOrCreate(
            ['project_id' => $project->id, 'version_number' => 1],
            [
                'title' => 'The Anatomy of a Gharīb Bottleneck: Transmission Dynamics of the Niyyah Tradition',
                'abstract' => 'This study examines the transmission bottleneck of the Niyyah tradition (Umar -> Alqamah -> Muhammad ibn Ibrahim -> Yahya ibn Sa\'id) and explains its subsequent 2nd-century combinatorial explosion.',
                'frozen_package' => [
                    'project' => [
                        'id' => $project->id,
                        'title' => $project->title,
                        'question' => $project->question,
                    ],
                    'lead_author' => [
                        'name' => $polla->display_name,
                        'affiliation' => 'Salahaddin University-Erbil',
                    ],
                    'co_author' => [
                        'name' => $ahmad->display_name,
                        'affiliation' => 'University of Baghdad',
                    ],
                    'document' => [
                        'title' => $doc->title,
                        'content' => $docContent,
                        'version' => 1,
                    ],
                    'findings' => [
                        ['claim' => $f1->claim, 'status' => $f1->status],
                        ['claim' => $f2->claim, 'status' => $f2->status],
                    ],
                    'evidence_count' => 3,
                    'analysis_runs_count' => 3,
                ],
                'package_checksum' => hash('sha256', $docContent),
                'status' => 'approved',
                'submitted_by' => $polla->id,
                'submitted_at' => now()->subDays(3),
            ]
        );

        // Peer Review Assignments & Reports
        ReviewAssignment::firstOrCreate(
            ['submission_id' => $submission->id, 'reviewer_id' => $reviewer1->id],
            [
                'recommendation' => 'approve',
                'reviewer_notes' => 'An exemplary contribution bridging computational graph analysis and classical Jarh wa Ta\'dil methodology. The Common Link identification is methodologically sound and mathematically substantiated. Recommended for publication without hesitation.',
                'completed_at' => now()->subDays(2),
                'created_at' => now()->subDays(3),
            ]
        );

        ReviewAssignment::firstOrCreate(
            ['submission_id' => $submission->id, 'reviewer_id' => $reviewer2->id],
            [
                'recommendation' => 'approve',
                'reviewer_notes' => 'Thorough lexical collation. The distinction drawn between the Medinan singular and Iraqi plural recensions solves a longstanding textual query in early hadith studies. Strongly approved.',
                'completed_at' => now()->subDays(2),
                'created_at' => now()->subDays(3),
            ]
        );

        // Formal Editorial Decision
        EditorialDecision::firstOrCreate(
            ['submission_id' => $submission->id],
            [
                'editor_id' => $editor->id,
                'decision' => 'approve',
                'decision_notes' => 'Unanimously approved by peer reviewers. Released to the public domain under Open Hadith peer-reviewed monographs series.',
                'decided_at' => now()->subDays(1),
            ]
        );

        // Public Peer-Reviewed Monograph
        Publication::firstOrCreate(
            ['submission_id' => $submission->id],
            [
                'project_id' => $project->id,
                'public_slug' => 'the-niyyah-tradition-critical-monograph',
                'title' => 'The Anatomy of a Gharīb Bottleneck: Transmission Dynamics of the Niyyah Tradition',
                'abstract' => 'A landmark computational and scholarly investigation of the single-strand transmission of Innamal A\'malu Bin-Niyyat across 2nd century Hijaz and Iraq.',
                'published_content' => $submission->frozen_package,
                'version_string' => '1.0.0',
                'status' => 'published',
                'released_by' => $editor->id,
                'released_at' => now()->subDays(1),
            ]
        );

        $this->command?->info("✓ Successfully seeded full research project case study!");
        $this->command?->info("✓ Public Monograph URL: /api/v1/public/research/the-niyyah-tradition-critical-monograph");
        $this->command?->info("✓ Public Announcement URL: /api/v1/public/announcements/niyyah-isnad-dynamics-2nd-century");
    }
}
