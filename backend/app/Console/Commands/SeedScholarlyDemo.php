<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Database\Seeders\ScholarlyDemoSeeder;

class SeedScholarlyDemo extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'scholarly:seed-demo {--refresh : Re-seed the entire case study}';

    /**
     * The console command description.
     */
    protected $description = 'Seed a realistic, end-to-end scholarly research case study into the Hadith Research Platform';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info("Initializing Scholarly Demo Case Study Seeder...");
        $this->call(ScholarlyDemoSeeder::class);
        $this->newLine();
        $this->info("✓ Case Study seeding complete!");
        $this->table(
            ['Entity', 'Status / Route'],
            [
                ['Principal Investigator', 'Dr. Polla Abdulhamid Fattah (polla@sue.edu.krd)'],
                ['Co-Researcher', 'Dr. Ahmad Al-Khatib (ahmad.khatib@hadith.local)'],
                ['Peer Reviewer', 'Prof. Dr. Tariq Al-Basri (tariq.basri@hadith.local)'],
                ['Public Monograph', 'GET /api/v1/public/research/the-niyyah-tradition-critical-monograph'],
                ['Public Announcement', 'GET /api/v1/public/announcements/niyyah-isnad-dynamics-2nd-century'],
                ['Workbench Analyses', 'Matn Compare, Isnād Common Link (Madār), Jarḥ wa Taʿdīl Matrix'],
                ['Peer Review Decision', 'Approved by consensus (Released v1.0.0)'],
            ]
        );

        return Command::SUCCESS;
    }
}
