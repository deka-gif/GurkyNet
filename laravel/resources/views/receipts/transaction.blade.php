<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Struk {{ $receipt['transaction_details']['invoice_number'] ?? '' }}</title>
    <style>
        {{-- FR-RECEIPT-UI-01 — presentation-only restyle to match the paper-receipt look
             used on the web/app receipt component. DomPDF has limited CSS support
             (no clip-path, no flexbox, unreliable box-shadow), so the "cashier paper"
             feel here is approximated with a narrow centered column, dashed dividers
             and a light border instead of a zigzag/perforated edge or drop shadow. --}}
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 28px 0; background: #f8fafc; }
        .paper { width: 340px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; padding: 22px 24px; }
        .header { text-align: center; }
        .header .brand { font-size: 15px; font-weight: bold; letter-spacing: 0.2px; color: #0f172a; }
        .header .tagline { margin-top: 2px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
        .divider { border-top: 1px dashed #cbd5e1; margin: 14px 0; }
        .status-block { text-align: center; padding-bottom: 4px; }
        .status-title { font-size: 13px; font-weight: bold; margin: 0 0 3px; }
        .status-title.success { color: #065f46; }
        .status-title.pending { color: #92400e; }
        .status-title.failed { color: #991b1b; }
        .status-desc { font-size: 9.5px; color: #475569; margin: 0; line-height: 1.5; }
        table.rows { width: 100%; border-collapse: collapse; margin-top: 4px; }
        table.rows td { padding: 4px 0; vertical-align: top; font-size: 10.5px; }
        table.rows td.label { color: #94a3b8; text-transform: uppercase; font-size: 9px; font-weight: bold; letter-spacing: 0.3px; width: 42%; }
        table.rows td.value { text-align: right; color: #0f172a; font-weight: bold; width: 58%; }
        table.rows td.value.mono { font-family: DejaVu Sans Mono, monospace; font-size: 9.5px; }
        table.rows td.value.highlight { color: #0f766e; }
        table.summary { width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        table.summary td { padding: 3px 0; font-size: 10.5px; }
        table.summary td.label { color: #94a3b8; }
        table.summary td.value { text-align: right; color: #0f172a; font-weight: bold; }
        table.summary tr.total td { border-top: 1px dashed #e2e8f0; padding-top: 7px; font-size: 12.5px; }
        table.summary tr.total td.label { color: #0f172a; text-transform: uppercase; font-weight: bold; font-size: 10px; }
        table.summary tr.total td.value { color: #0f766e; font-size: 14px; }
        .deliverable { text-align: center; border-top: 1px dashed #cbd5e1; margin-top: 12px; padding-top: 12px; }
        .deliverable .d-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; }
        .deliverable .d-value { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; word-wrap: break-word; }
        .footer { text-align: center; border-top: 1px dashed #cbd5e1; margin-top: 14px; padding-top: 12px; font-size: 8.5px; color: #94a3b8; line-height: 1.6; }
    </style>
</head>
<body>
@php
    $details = $receipt['transaction_details'] ?? [];
    $rawStatus = strtolower(trim((string) ($details['status'] ?? '')));
    if (in_array($rawStatus, ['success', 'sukses', 'ok', 'berhasil'], true)) {
        $statusKind = 'success';
    } elseif (in_array($rawStatus, ['failed', 'gagal', 'error', 'fail', 'cancelled', 'expired'], true)) {
        $statusKind = 'failed';
    } else {
        $statusKind = 'pending';
    }

    // Customer-facing payment channel labels — mirrors src/utils/paymentMethodLabel.ts.
    // Never render raw gateway/processor names (e.g. "MIDTRANS") to the customer.
    $channelLabels = [
        'qris' => 'QRIS', 'other_qris' => 'QRIS',
        'bca_va' => 'Virtual Account BCA', 'bca' => 'Virtual Account BCA',
        'bri_va' => 'Virtual Account BRI', 'bri' => 'Virtual Account BRI',
        'bni_va' => 'Virtual Account BNI', 'bni' => 'Virtual Account BNI',
        'echannel' => 'Virtual Account Mandiri', 'mandiri' => 'Virtual Account Mandiri', 'mandiri_va' => 'Virtual Account Mandiri',
        'permata_va' => 'Virtual Account Permata', 'permata' => 'Virtual Account Permata',
        'alfamart' => 'Alfamart', 'indomaret' => 'Indomaret',
        'gopay' => 'GoPay', 'shopeepay' => 'ShopeePay', 'dana' => 'DANA', 'ovo' => 'OVO', 'linkaja' => 'LinkAja',
        'bank_transfer' => 'Virtual Account', 'cstore' => 'Gerai Retail',
        'credit_card' => 'Kartu Kredit/Debit', 'card' => 'Kartu Kredit/Debit',
        'wallet' => 'Saldo Dompet', 'manual_transfer' => 'Transfer Manual',
    ];
    $rawMethod = trim((string) ($details['payment_method'] ?? ''));
    $methodKey = strtolower($rawMethod);
    if ($rawMethod === '' ) {
        $paymentMethodLabel = null;
    } elseif (in_array($methodKey, ['midtrans', 'dummy_gateway'], true)) {
        $paymentMethodLabel = 'Pembayaran';
    } elseif (isset($channelLabels[$methodKey])) {
        $paymentMethodLabel = $channelLabels[$methodKey];
    } elseif (preg_match('/[A-Z]/', $rawMethod) || preg_match('/\s/', $rawMethod)) {
        $paymentMethodLabel = $rawMethod;
    } elseif (preg_match('/^[a-z0-9_\-]+$/i', $rawMethod)) {
        $paymentMethodLabel = 'Pembayaran';
    } else {
        $paymentMethodLabel = $rawMethod;
    }

    $item = $receipt['items'][0] ?? null;
    $serialNumber = $details['serial_number'] ?? null;
    $isPlnToken = !empty($details['is_pln_token']) || !empty($details['token_code']);
    // Serial number is superseded by the token block below for PLN tokens.
    if ($isPlnToken) {
        $serialNumber = null;
    }

    $deliverableLabel = null;
    $deliverableValue = null;
    if ($isPlnToken && !empty($details['token_code_grouped'])) {
        $deliverableLabel = 'Kode Token';
        $deliverableValue = $details['token_code_grouped'];
    } elseif (!empty($details['is_voucher']) && (!empty($details['voucher_code']) || !empty($details['voucher_url']))) {
        $deliverableLabel = 'Kode Voucher / PIN Voucher';
        $deliverableValue = $details['voucher_code'] ?? $details['voucher_url'];
    } elseif (!empty($details['is_langganan']) && (!empty($details['activation_code']) || !empty($details['activation_url']))) {
        $deliverableLabel = 'Kode Voucher / Redeem / Aktivasi';
        $deliverableValue = $details['activation_code'] ?? $details['activation_url'];
    } elseif (!empty($details['is_voucher_internet']) && (!empty($details['voucher_internet_code']) || !empty($details['voucher_internet_url']))) {
        $deliverableLabel = 'Kode Voucher';
        $deliverableValue = $details['voucher_internet_code'] ?? $details['voucher_internet_url'];
    }

    $targetLabel = 'Nomor Target/Tujuan';
    $targetValue = $details['target_number'] ?? null;
    if (!empty($details['is_pajak_negara'])) {
        $targetLabel = (($details['pajak_jenis'] ?? null) === 'samsat') ? 'Nomor Polisi' : 'Nomor Objek Pajak';
        $targetValue = ($details['tax_details']['nop'] ?? null) ?: ($details['tax_details']['nomor_polisi'] ?? $targetValue);
    } elseif (!empty($details['is_langganan']) && !empty($details['langganan_target_display'])) {
        $display = $details['langganan_target_display'];
        $targetLabel = str_contains($display, '@') ? 'Email Tujuan' : 'Data Tujuan';
        $targetValue = $display;
    }

    $money = fn ($v) => 'Rp ' . number_format((float) ($v ?? 0), 0, ',', '.');
    $dateDisplay = null;
    if (!empty($details['date'])) {
        try {
            $dateDisplay = \Illuminate\Support\Carbon::parse($details['date'])->translatedFormat('d F Y, H:i') . ' WIB';
        } catch (\Throwable $e) {
            $dateDisplay = $details['date'];
        }
    }
@endphp
    <div class="paper">
        <div class="header">
            <div class="brand">{{ $receipt['header']['company_name'] ?? config('app.name') }}</div>
            <div class="tagline">Bukti Pembayaran Resmi</div>
        </div>

        <div class="divider"></div>

        <div class="status-block">
            @if($statusKind === 'success')
                <p class="status-title success">Transaksi Berhasil!</p>
                <p class="status-desc">Pembayaran Anda telah sukses diverifikasi oleh provider.</p>
            @elseif($statusKind === 'pending')
                <p class="status-title pending">Transaksi Tertunda (Pending)</p>
                <p class="status-desc">Transaksi Anda sedang diproses. Struk ini akan diperbarui otomatis begitu status berubah.</p>
            @else
                <p class="status-title failed">Transaksi Gagal</p>
                <p class="status-desc">Transaksi tidak dapat diproses. Saldo Anda tidak berubah.</p>
            @endif
        </div>

        <table class="rows">
            @if(!empty($details['invoice_number']))
                <tr><td class="label">Nomor Invoice</td><td class="value mono">{{ $details['invoice_number'] }}</td></tr>
            @endif
            @if($dateDisplay)
                <tr><td class="label">Tanggal</td><td class="value">{{ $dateDisplay }}</td></tr>
            @endif
            @if(!empty($serialNumber))
                <tr><td class="label">Serial Number (SN)</td><td class="value mono">{{ $serialNumber }}</td></tr>
            @endif
            @if(!empty($details['service_name']))
                <tr><td class="label">Kategori</td><td class="value">{{ $details['service_name'] }}</td></tr>
            @endif
            @if(!empty($item['name']))
                <tr><td class="label">Produk</td><td class="value">{{ $item['name'] }}</td></tr>
            @endif
            @if(!empty($targetValue))
                <tr><td class="label">{{ $targetLabel }}</td><td class="value mono">{{ $targetValue }}</td></tr>
            @endif
            @if($paymentMethodLabel)
                <tr><td class="label">Metode Pembayaran</td><td class="value highlight">{{ $paymentMethodLabel }}</td></tr>
            @endif
        </table>

        <table class="summary">
            @if(isset($receipt['payment_summary']['subtotal']))
                <tr><td class="label">Harga</td><td class="value">{{ $money($receipt['payment_summary']['subtotal']) }}</td></tr>
            @endif
            @if(isset($receipt['payment_summary']['admin_fee']))
                <tr><td class="label">Admin</td><td class="value">{{ $money($receipt['payment_summary']['admin_fee']) }}</td></tr>
            @endif
            @if(isset($receipt['payment_summary']['total_payment']))
                <tr class="total"><td class="label">Total Bayar</td><td class="value">{{ $money($receipt['payment_summary']['total_payment']) }}</td></tr>
            @endif
        </table>

        @if($deliverableLabel && $deliverableValue)
            <div class="deliverable">
                <div class="d-label">{{ $deliverableLabel }}</div>
                <div class="d-value">{{ $deliverableValue }}</div>
            </div>
        @endif

        {{-- No GurkyPay verification QR is generated server-side today — intentionally
             omitted rather than shown as a placeholder/dummy image. --}}

        <div class="footer">
            {{ $receipt['footer']['note'] ?? 'Terima kasih telah menggunakan layanan GurkyPay. Simpan struk ini sebagai bukti transaksi yang sah.' }}
        </div>
    </div>
</body>
</html>
