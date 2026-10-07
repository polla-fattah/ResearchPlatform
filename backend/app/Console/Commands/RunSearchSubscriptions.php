<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\SearchSubscriptionController;
use App\Models\SearchSubscription;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('searches:run-subscriptions')]
#[Description('Run the saved searches whose subscription schedule is due')]
class RunSearchSubscriptions extends Command
{
    /**
     * Run every active subscription that has never run, or whose daily, weekly or monthly interval has passed.
     */
    public function handle(SearchSubscriptionController $subscriptions): int
    {
        $due = SearchSubscription::where('is_active', true)->get()->filter(function (SearchSubscription $sub): bool {
            if (!$sub->last_run_at) {
                return true;
            }

            $interval = match ($sub->frequency) {
                'daily' => now()->subDay(),
                'monthly' => now()->subMonth(),
                default => now()->subWeek(),
            };

            return $sub->last_run_at->lte($interval);
        });

        foreach ($due as $sub) {
            $subscriptions->runSubscription($sub);
        }

        $this->info("Ran {$due->count()} subscribed search(es).");

        return self::SUCCESS;
    }
}
