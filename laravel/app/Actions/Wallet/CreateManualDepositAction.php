<?php

namespace App\Actions\Wallet;

use App\Models\DepositRequest;
use App\Models\User;
use App\Support\Finance\FinanceAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-03 — user submits manual bank-transfer deposit with proof.
 */
class CreateManualDepositAction
{
    public function execute(
        User $user,
        float $amount,
        UploadedFile $proof,
        ?string $notes = null
    ): DepositRequest {
        if ($amount < 10000) {
            throw ValidationException::withMessages([
                'amount' => ['Minimal deposit manual adalah Rp 10.000.'],
            ]);
        }

        return DB::transaction(function () use ($user, $amount, $proof, $notes) {
            // Implementation detail (SRS silent on mime/size): align with ComplaintController proof rules.
            $path = $proof->store('deposit-proofs/'.$user->id, 'public');

            $request = DepositRequest::create([
                'user_id' => $user->id,
                'amount' => $amount,
                'method' => 'manual_transfer',
                'proof_file_url' => $path,
                'status' => 'pending',
                'notes' => $notes,
            ]);

            FinanceAudit::log($user, 'USER_DEPOSIT_MANUAL_SUBMIT', [
                'deposit_request_id' => $request->id,
                'amount' => $amount,
            ]);

            return $request;
        });
    }
}
