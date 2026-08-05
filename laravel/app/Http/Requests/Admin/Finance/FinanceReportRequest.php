<?php

namespace App\Http\Requests\Admin\Finance;

use Illuminate\Foundation\Http\FormRequest;

class FinanceReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'method' => 'nullable|string',
            'date_range' => 'nullable|string',
            'type' => 'nullable|string',
            'provider' => 'nullable|string',
            'search' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('method') && !$this->filled('payment_method')) {
            $this->merge(['payment_method' => $this->input('method')]);
        }

        if ($this->filled('date_range') && !$this->filled('start_date')) {
            $range = strtolower((string) $this->input('date_range'));
            $end = now()->toDateString();
            $start = $end;

            if (str_contains($range, 'minggu') || str_contains($range, 'week')) {
                $start = now()->subDays(6)->toDateString();
            } elseif (str_contains($range, 'bulan') || str_contains($range, 'month')) {
                $start = now()->startOfMonth()->toDateString();
            } elseif (str_contains($range, 'tahun') || str_contains($range, 'year')) {
                $start = now()->startOfYear()->toDateString();
            }

            $this->merge([
                'start_date' => $start,
                'end_date' => $end,
            ]);
        }
    }
}
