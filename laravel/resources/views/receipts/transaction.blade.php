<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Struk {{ $receipt['transaction_details']['invoice_number'] ?? '' }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; margin: 24px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .muted { color: #666; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 14px; }
        .status { text-transform: uppercase; font-weight: bold; }
    </style>
</head>
<body>
    <h1>{{ $receipt['header']['company_name'] ?? config('app.name') }}</h1>
    @if(!empty($receipt['header']['tagline']))
        <div class="muted">{{ $receipt['header']['tagline'] }}</div>
    @endif
    <p class="muted">Struk Digital — bukti transaksi (bukan klaim status selain yang tercatat).</p>

    <table>
        <tr><th>No. Transaksi</th><td>{{ $receipt['transaction_details']['invoice_number'] ?? '-' }}</td></tr>
        <tr><th>Tanggal</th><td>{{ $receipt['transaction_details']['date'] ?? '-' }}</td></tr>
        <tr><th>Status</th><td class="status">{{ $receipt['transaction_details']['status'] ?? '-' }}</td></tr>
        <tr><th>Layanan</th><td>{{ $receipt['transaction_details']['service_name'] ?? '-' }}</td></tr>
        <tr><th>Tujuan</th><td>{{ $receipt['transaction_details']['target_number'] ?? '-' }}</td></tr>
        <tr><th>Metode</th><td>{{ $receipt['transaction_details']['payment_method'] ?? '-' }}</td></tr>
        @if(!empty($receipt['transaction_details']['provider_ref']))
            <tr><th>Referensi</th><td>{{ $receipt['transaction_details']['provider_ref'] }}</td></tr>
        @endif
    </table>

    <table>
        <thead>
            <tr><th>Produk</th><th>SKU</th><th>Qty</th><th>Harga</th></tr>
        </thead>
        <tbody>
        @foreach(($receipt['items'] ?? []) as $item)
            <tr>
                <td>{{ $item['name'] ?? '-' }}</td>
                <td>{{ $item['sku_code'] ?? '-' }}</td>
                <td>{{ $item['quantity'] ?? 1 }}</td>
                <td>Rp {{ number_format((float) ($item['total'] ?? 0), 0, ',', '.') }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    <table>
        <tr><th>Subtotal</th><td>Rp {{ number_format((float) ($receipt['payment_summary']['subtotal'] ?? 0), 0, ',', '.') }}</td></tr>
        <tr><th>Biaya Admin</th><td>Rp {{ number_format((float) ($receipt['payment_summary']['admin_fee'] ?? 0), 0, ',', '.') }}</td></tr>
        <tr class="total"><th>Total</th><td>Rp {{ number_format((float) ($receipt['payment_summary']['total_payment'] ?? 0), 0, ',', '.') }}</td></tr>
    </table>

    <p class="muted" style="margin-top: 24px;">{{ $receipt['footer']['note'] ?? '' }}</p>
</body>
</html>
