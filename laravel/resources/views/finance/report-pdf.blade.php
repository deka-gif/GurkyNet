<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Laporan Keuangan GurkyNet</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .muted { color: #666; font-size: 11px; }
    </style>
</head>
<body>
    <h1>GurkyNet — Laporan Keuangan</h1>
    <p class="muted">FR-FIN-08 · Periode {{ $report['period']['start'] ?? '-' }} s/d {{ $report['period']['end'] ?? '-' }}</p>

    <table>
        <tr><th>Metrik</th><th>Nilai (IDR)</th></tr>
        <tr><td>Omzet</td><td>{{ number_format((float)($report['omzet'] ?? 0), 2, ',', '.') }}</td></tr>
        <tr><td>Biaya Provider</td><td>{{ number_format((float)($report['providerCost'] ?? 0), 2, ',', '.') }}</td></tr>
        <tr><td>Biaya Gateway</td><td>{{ number_format((float)($report['gatewayFee'] ?? 0), 2, ',', '.') }}</td></tr>
        <tr><td>Biaya Refund</td><td>{{ number_format((float)($report['refundCost'] ?? 0), 2, ',', '.') }}</td></tr>
        <tr><td>Total Biaya Operasional</td><td>{{ number_format((float)($report['operationalCosts']['total'] ?? 0), 2, ',', '.') }}</td></tr>
        <tr><td>Laba Bersih</td><td>{{ number_format((float)($report['incomeStatement']['netProfit'] ?? 0), 2, ',', '.') }}</td></tr>
    </table>

    <h2 style="margin-top:18px;font-size:14px;">Laba-Rugi per Kategori</h2>
    <table>
        <tr><th>Kategori</th><th>Omzet</th><th>Cost</th><th>Laba</th></tr>
        @forelse(($report['profitLossByCategory'] ?? []) as $cat)
            <tr>
                <td>{{ $cat['category'] }}</td>
                <td>{{ number_format((float)$cat['revenue'], 2, ',', '.') }}</td>
                <td>{{ number_format((float)$cat['cost'], 2, ',', '.') }}</td>
                <td>{{ number_format((float)$cat['profit'], 2, ',', '.') }}</td>
            </tr>
        @empty
            <tr><td colspan="4">Tidak ada data kategori pada periode ini.</td></tr>
        @endforelse
    </table>
    <p class="muted" style="margin-top:12px;">{{ $report['operationalCosts']['note'] ?? '' }}</p>
</body>
</html>
