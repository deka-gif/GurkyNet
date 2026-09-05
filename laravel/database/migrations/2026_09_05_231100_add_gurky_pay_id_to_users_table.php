<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FR — GurkyPay customer-facing ID: YYYY + 3128 + NNN (per registration year).
 * Does NOT replace users.id / wallets.id. Live wallet_number is unified in a
 * follow-up migration (same YYYY3128NNN value as gurky_pay_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gurky_pay_id_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedSmallInteger('last_seq')->default(0);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('gurky_pay_id', 11)->nullable()->unique()->after('id');
        });

        $this->backfillExistingUsers();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['gurky_pay_id']);
            $table->dropColumn('gurky_pay_id');
        });
        Schema::dropIfExists('gurky_pay_id_sequences');
    }

    /**
     * Deterministic backfill: order by created_at, id; sequence per registration year.
     * Never reuses numbers; skips rows that already have gurky_pay_id.
     */
    private function backfillExistingUsers(): void
    {
        $yearSeq = [];

        User::query()
            ->withTrashed()
            ->orderBy('created_at')
            ->orderBy('id')
            ->select(['id', 'created_at', 'gurky_pay_id'])
            ->chunkById(200, function ($users) use (&$yearSeq) {
                foreach ($users as $user) {
                    if (filled($user->gurky_pay_id)) {
                        continue;
                    }

                    $year = (int) $user->created_at?->year;
                    if ($year < 2000) {
                        $year = (int) now()->year;
                    }

                    $next = ($yearSeq[$year] ?? 0) + 1;
                    if ($next > 999) {
                        throw new \RuntimeException(
                            "GurkyPay ID sequence for year {$year} exceeded 999 during backfill."
                        );
                    }
                    $yearSeq[$year] = $next;

                    $code = sprintf('%d3128%03d', $year, $next);
                    DB::table('users')->where('id', $user->id)->update(['gurky_pay_id' => $code]);
                }
            });

        $now = now();
        foreach ($yearSeq as $year => $lastSeq) {
            DB::table('gurky_pay_id_sequences')->updateOrInsert(
                ['year' => $year],
                [
                    'last_seq' => $lastSeq,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
};
