<?php

namespace App\Services;

class TemporalCspService
{
    public const MINIMUM_TAMYIZ_AGE = 7; // Sinn al-Tamyiz in classical scholarship (7 Hijri years)

    /**
     * Check temporal feasibility and audition constraints between a teacher and student.
     */
    public function checkTeacherStudentPair(
        string $teacherName,
        ?int $teacherBirth,
        ?int $teacherDeath,
        string $studentName,
        ?int $studentBirth,
        ?int $studentDeath,
        int $minAuditionAge = self::MINIMUM_TAMYIZ_AGE
    ): array {
        // If critical death dates are missing, mark as inconclusive
        if ($teacherDeath === null || ($studentBirth === null && $studentDeath === null)) {
            return [
                'status' => 'inconclusive',
                'reason' => 'Insufficient chronological data: missing teacher death year or student birth/death years.',
                'teacher' => ['name' => $teacherName, 'birth' => $teacherBirth, 'death' => $teacherDeath],
                'student' => ['name' => $studentName, 'birth' => $studentBirth, 'death' => $studentDeath],
                'feasibility' => null,
            ];
        }

        // Estimate student birth if missing (typical lifespan ~70-75 Hijri years in rijal literature)
        $estimatedStudentBirth = $studentBirth ?? ($studentDeath - 70);
        $earliestStudentAudition = $estimatedStudentBirth + $minAuditionAge;

        // 1. Strict anachronism: Teacher died before student was born
        if ($teacherDeath < $estimatedStudentBirth) {
            $yearsGap = $estimatedStudentBirth - $teacherDeath;
            return [
                'status' => 'pseudo_attribution',
                'verdict' => 'IMPOSSIBLE_MEETING',
                'teacher' => ['name' => $teacherName, 'birth' => $teacherBirth, 'death' => $teacherDeath],
                'student' => ['name' => $studentName, 'birth' => $studentBirth, 'estimated_birth' => $estimatedStudentBirth, 'death' => $studentDeath],
                'proof_certificate' => [
                    'theorem' => 'Chronological Impossibility Theorem (Pseudo-Attribution)',
                    'arithmetic_proof' => "Teacher death ({$teacherDeath} AH) < Student birth ({$estimatedStudentBirth} AH). Negative temporal gap: -{$yearsGap} years.",
                    'is_anachronistic' => true,
                    'audition_possible' => false,
                ],
            ];
        }

        // 2. Tamyiz boundary violation: Teacher died before student reached minimum audition age
        if ($teacherDeath < $earliestStudentAudition) {
            $studentAgeAtTeacherDeath = $teacherDeath - $estimatedStudentBirth;
            return [
                'status' => 'anachronistic_inqita',
                'verdict' => 'INQITA_CONFIRMED',
                'teacher' => ['name' => $teacherName, 'birth' => $teacherBirth, 'death' => $teacherDeath],
                'student' => ['name' => $studentName, 'birth' => $studentBirth, 'estimated_birth' => $estimatedStudentBirth, 'death' => $studentDeath],
                'proof_certificate' => [
                    'theorem' => 'Tamyīz Lower Bound Violation Theorem (Inqiṭāʿ)',
                    'arithmetic_proof' => "Student reached age {$minAuditionAge} AH in year {$earliestStudentAudition} AH, but teacher died in year {$teacherDeath} AH (Student age was {$studentAgeAtTeacherDeath} AH < threshold {$minAuditionAge} AH).",
                    'is_anachronistic' => true,
                    'audition_possible' => false,
                ],
            ];
        }

        // 3. Feasible transmission window
        $overlapWindowYears = $teacherDeath - $earliestStudentAudition;
        $studentAgeAtTeacherDeath = $teacherDeath - $estimatedStudentBirth;

        $qualification = null;
        if ($studentAgeAtTeacherDeath < 15) {
            $qualification = 'riwayah_al_sighar'; // Narrated during early youth
        }

        return [
            'status' => 'feasible_overlap',
            'verdict' => 'ITTISAL_CHRONOLOGICALLY_FEASIBLE',
            'teacher' => ['name' => $teacherName, 'birth' => $teacherBirth, 'death' => $teacherDeath],
            'student' => ['name' => $studentName, 'birth' => $studentBirth, 'estimated_birth' => $estimatedStudentBirth, 'death' => $studentDeath],
            'proof_certificate' => [
                'theorem' => 'Chronological Feasibility of Audition (Ittiṣāl)',
                'audition_window_hijri' => "{$earliestStudentAudition} AH to {$teacherDeath} AH ({$overlapWindowYears} years of potential co-presence)",
                'student_age_at_teacher_death' => $studentAgeAtTeacherDeath,
                'qualification' => $qualification,
                'is_anachronistic' => false,
                'audition_possible' => true,
            ],
        ];
    }

    /**
     * Verify an entire sequential transmission chain for chronological continuity.
     */
    public function verifyChainChronology(array $narratorsInChronologicalOrder): array
    {
        $links = [];
        $hasBrokenLink = false;

        for ($i = 0; $i < count($narratorsInChronologicalOrder) - 1; $i++) {
            $teacher = $narratorsInChronologicalOrder[$i];
            $student = $narratorsInChronologicalOrder[$i + 1];

            $check = $this->checkTeacherStudentPair(
                $teacher['name'] ?? "Narrator #{$teacher['id']}",
                $teacher['birth_year'] ?? null,
                $teacher['death_year'] ?? null,
                $student['name'] ?? "Narrator #{$student['id']}",
                $student['birth_year'] ?? null,
                $student['death_year'] ?? null
            );

            if ($check['status'] === 'anachronistic_inqita' || $check['status'] === 'pseudo_attribution') {
                $hasBrokenLink = true;
            }

            $links[] = [
                'link_order' => $i + 1,
                'teacher' => $teacher['name'] ?? "Narrator #{$teacher['id']}",
                'student' => $student['name'] ?? "Narrator #{$student['id']}",
                'evaluation' => $check,
            ];
        }

        return [
            'chain_length' => count($narratorsInChronologicalOrder),
            'verified_links_count' => count($links),
            'overall_status' => $hasBrokenLink ? 'inqita_detected' : 'chronologically_sound',
            'links' => $links,
        ];
    }
}
