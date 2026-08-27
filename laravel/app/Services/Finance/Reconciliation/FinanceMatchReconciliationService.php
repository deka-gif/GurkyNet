<?php

namespace App\Services\Finance\Reconciliation;

use App\Models\BankStatementImport;
use App\Models\BankStatementLine;
use App\Models\GatewayReconciliationItem;
use App\Models\MidtransTransaction;
use App\Models\ReconciliationIncident;
use App\Models\User;
use App\Support\Finance\FinanceAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-07 — gateway recon rows + CSV bank import match/discrepancy.
 */
class FinanceMatchReconciliationService
{
    public function __construct(
        protected ReconciliationIncidentService $incidents,
        protected ReconciliationConfig $config
    ) {}

    /**
     * Import minimal CSV: date,amount,reference,description
     */
    public function importBankCsv(UploadedFile $file, User $actor): BankStatementImport
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['file' => ['Tidak dapat membaca file CSV.']]);
        }

        return DB::transaction(function () use ($handle, $file, $actor) {
            $import = BankStatementImport::create([
                'import_code' => 'BSI-'.now()->format('YmdHis').'-'.random_int(100, 999),
                'filename' => $file->getClientOriginalName(),
                'status' => 'imported',
                'imported_by' => $actor->id,
                'line_count' => 0,
            ]);

            $header = null;
            $count = 0;
            while (($row = fgetcsv($handle)) !== false) {
                if ($header === null) {
                    $header = array_map(fn ($h) => strtolower(trim((string) $h)), $row);
                    // Allow headerless: if first cell looks like date/amount, treat as data.
                    if (! in_array('amount', $header, true) && is_numeric($row[1] ?? null)) {
                        $header = ['date', 'amount', 'reference', 'description'];
                        // fall through to process this row
                    } else {
                        continue;
                    }
                }

                $map = [];
                foreach ($header as $i => $key) {
                    $map[$key] = $row[$i] ?? null;
                }

                $amount = (float) str_replace([',', ' '], ['', ''], (string) ($map['amount'] ?? 0));
                if (abs($amount) < 0.0001) {
                    continue;
                }

                BankStatementLine::create([
                    'bank_statement_import_id' => $import->id,
                    'transacted_on' => $this->parseDate($map['date'] ?? $map['transacted_on'] ?? null),
                    'amount' => $amount,
                    'external_reference' => $map['reference'] ?? $map['external_reference'] ?? null,
                    'description' => $map['description'] ?? null,
                    'match_status' => 'unmatched',
                ]);
                $count++;
            }
            fclose($handle);

            $import->update(['line_count' => $count, 'status' => 'processed']);

            FinanceAudit::log($actor, 'RECON_BANK_IMPORT', [
                'import_id' => $import->id,
                'lines' => $count,
            ]);

            return $import->fresh('lines');
        });
    }

    public function matchBankLine(BankStatementLine $line, User $actor, array $data): BankStatementLine
    {
        $line->update([
            'match_status' => 'matched',
            'internal_type' => $data['internal_type'] ?? 'manual',
            'internal_id' => $data['internal_id'] ?? null,
            'internal_amount' => $data['internal_amount'] ?? $line->amount,
            'evidence' => $data['evidence'] ?? $data['reference'] ?? null,
            'matched_by' => $actor->id,
            'matched_at' => now(),
        ]);

        FinanceAudit::log($actor, 'RECON_BANK_MATCHED', ['line_id' => $line->id]);

        return $line->fresh();
    }

    public function markBankDiscrepancy(BankStatementLine $line, User $actor, array $data): BankStatementLine
    {
        $internal = (float) ($data['internal_amount'] ?? 0);
        $variance = round((float) $line->amount - $internal, 2);

        $incident = null;
        if ($this->config->exceedsThreshold(abs($variance))) {
            $incident = $this->incidents->openOrRefresh([
                'fingerprint' => 'bank_line:'.$line->id,
                'type' => ReconciliationIncident::TYPE_BANK_MATCH,
                'source' => 'bank_import',
                'expected_amount' => $internal,
                'actual_amount' => (float) $line->amount,
                'variance' => $variance,
                'threshold' => $this->config->threshold(),
                'freeze_withdraw' => false,
                'restrict_purchase' => false,
                'system_wide_freeze' => false,
                'notes' => $data['notes'] ?? 'Bank statement discrepancy (FR-FIN-07)',
                'meta' => ['line_id' => $line->id],
            ]);
        }

        $line->update([
            'match_status' => 'discrepancy',
            'internal_type' => $data['internal_type'] ?? $line->internal_type,
            'internal_id' => $data['internal_id'] ?? $line->internal_id,
            'internal_amount' => $internal,
            'evidence' => $data['evidence'] ?? $data['reference'] ?? null,
            'matched_by' => $actor->id,
            'matched_at' => now(),
            'reconciliation_incident_id' => $incident?->id,
        ]);

        FinanceAudit::log($actor, 'RECON_BANK_DISCREPANCY', [
            'line_id' => $line->id,
            'incident_id' => $incident?->id,
        ]);

        return $line->fresh();
    }

    public function matchGatewayItem(GatewayReconciliationItem $item, User $actor, array $data): GatewayReconciliationItem
    {
        $item->update([
            'match_status' => 'matched',
            'internal_type' => $data['internal_type'] ?? $item->internal_type,
            'internal_id' => $data['internal_id'] ?? $item->internal_id,
            'internal_amount' => $data['internal_amount'] ?? $item->internal_amount,
            'evidence' => $data['evidence'] ?? $data['reference'] ?? null,
            'matched_by' => $actor->id,
            'matched_at' => now(),
            'variance' => 0,
        ]);

        FinanceAudit::log($actor, 'RECON_GATEWAY_MATCHED', ['item_id' => $item->id]);

        return $item->fresh();
    }

    public function markGatewayDiscrepancy(GatewayReconciliationItem $item, User $actor, array $data): GatewayReconciliationItem
    {
        $internal = (float) ($data['internal_amount'] ?? $item->internal_amount);
        $external = (float) ($data['external_amount'] ?? $item->external_amount);
        $variance = round($external - $internal, 2);

        $incident = null;
        if ($this->config->exceedsThreshold(abs($variance))) {
            $incident = $this->incidents->openOrRefresh([
                'fingerprint' => 'gateway_item:'.$item->id,
                'type' => $item->source === 'midtrans'
                    ? ReconciliationIncident::TYPE_MIDTRANS_SETTLEMENT
                    : ReconciliationIncident::TYPE_PROVIDER_H2H,
                'source' => $item->source,
                'expected_amount' => $internal,
                'actual_amount' => $external,
                'variance' => $variance,
                'threshold' => $this->config->threshold(),
                'freeze_withdraw' => true,
                'restrict_purchase' => false,
                'system_wide_freeze' => true,
                'notes' => $data['notes'] ?? 'Gateway discrepancy (FR-FIN-07)',
                'meta' => ['item_id' => $item->id],
            ]);
        }

        $item->update([
            'match_status' => 'discrepancy',
            'internal_amount' => $internal,
            'external_amount' => $external,
            'variance' => $variance,
            'evidence' => $data['evidence'] ?? $data['reference'] ?? null,
            'matched_by' => $actor->id,
            'matched_at' => now(),
            'reconciliation_incident_id' => $incident?->id,
        ]);

        return $item->fresh();
    }

    protected function parseDate(mixed $raw): ?string
    {
        if (! $raw) {
            return null;
        }
        try {
            return \Illuminate\Support\Carbon::parse((string) $raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}
