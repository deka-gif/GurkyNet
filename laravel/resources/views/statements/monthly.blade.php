<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Laporan Keuangan {{ $statement['period']['key'] ?? '' }}</title>
    <style>
        @page { margin: 28px 32px; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #0f172a;
            margin: 0;
            padding: 0;
        }
        .brand { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0; }
        .subbrand { font-size: 11px; color: #475569; margin: 2px 0 0; letter-spacing: 0.4px; }
        .doc-title { font-size: 15px; font-weight: bold; margin: 18px 0 4px; }
        .muted { color: #64748b; }
        .section { margin-top: 18px; }
        .section-title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #334155;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 8px;
        }
        table.info { width: 100%; border-collapse: collapse; }
        table.info td { padding: 3px 0; vertical-align: top; }
        table.info td.label { width: 38%; color: #64748b; }
        table.info td.value { font-weight: bold; }
        table.summary { width: 100%; border-collapse: collapse; margin-top: 4px; }
        table.summary td { padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
        table.summary td.label { color: #475569; }
        table.summary td.value { text-align: right; font-weight: bold; }
        table.summary tr.ending td { border-bottom: none; padding-top: 8px; font-size: 12px; }
        table.cats { width: 100%; border-collapse: collapse; }
        table.cats th, table.cats td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        table.cats th { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
        table.cats td.amount { text-align: right; font-weight: bold; white-space: nowrap; }
        table.mut { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        table.mut th, table.mut td { padding: 5px 3px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        table.mut th { font-size: 8.5px; text-transform: uppercase; color: #64748b; letter-spacing: 0.3px; }
        table.mut td.num { text-align: right; white-space: nowrap; }
        table.mut td.desc { width: 34%; }
        .totals { margin-top: 10px; width: 100%; border-collapse: collapse; }
        .totals td { padding: 4px 0; font-weight: bold; }
        .totals td.r { text-align: right; }
        .footer {
            margin-top: 22px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            font-size: 8.5px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.5;
        }
        .empty { color: #94a3b8; font-style: italic; padding: 6px 0; }
    </style>
</head>
<body>
@php
    /** Presentation helpers only — amounts come from $statement (CustomerStatementService). */
    $fmt = function ($n): string {
        return 'Rp '.number_format((float) $n, 0, ',', '.');
    };
    $fmtDate = function (?string $iso) use ($statement): string {
        if (!$iso) {
            return '—';
        }
        try {
            $tz = (string) ($statement['period']['timezone'] ?? 'Asia/Jakarta');
            $c = \Illuminate\Support\Carbon::parse($iso)->timezone($tz);
            $months = [1=>'Jan',2=>'Feb',3=>'Mar',4=>'Apr',5=>'Mei',6=>'Jun',7=>'Jul',8=>'Agu',9=>'Sep',10=>'Okt',11=>'Nov',12=>'Des'];
            return sprintf('%02d %s %d', (int) $c->day, $months[(int) $c->month] ?? '', (int) $c->year);
        } catch (\Throwable $e) {
            return $iso;
        }
    };
    $account = $statement['account'] ?? [];
    $categories = $statement['categories'] ?? [];
    $mutations = $statement['mutations'] ?? [];
@endphp

<div>
    <p class="brand">GurkyNet</p>
    <p class="subbrand">GurkyPay</p>
    <p class="doc-title">Laporan Keuangan</p>
    <p class="muted">Dokumen ringkasan mutasi saldo resmi untuk periode yang dipilih.</p>
</div>

<div class="section">
    <div class="section-title">Informasi akun</div>
    <table class="info">
        <tr>
            <td class="label">Nama</td>
            <td class="value">{{ $account['name'] ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">ID / No. Rekening GurkyPay</td>
            <td class="value">{{ $account['gurky_pay_id'] ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Periode</td>
            <td class="value">{{ $period_label }}</td>
        </tr>
        <tr>
            <td class="label">Mata uang</td>
            <td class="value">{{ $statement['currency'] ?? 'IDR' }}</td>
        </tr>
        <tr>
            <td class="label">Zona waktu</td>
            <td class="value">{{ $statement['period']['timezone'] ?? 'Asia/Jakarta' }}</td>
        </tr>
    </table>
</div>

<div class="section">
    <div class="section-title">Ringkasan</div>
    <table class="summary">
        <tr>
            <td class="label">Saldo Awal</td>
            <td class="value">{{ $fmt($statement['opening_balance'] ?? 0) }}</td>
        </tr>
        <tr>
            <td class="label">Pemasukan</td>
            <td class="value">{{ $fmt($statement['income'] ?? 0) }}</td>
        </tr>
        <tr>
            <td class="label">Pengeluaran</td>
            <td class="value">{{ $fmt($statement['expense'] ?? 0) }}</td>
        </tr>
        <tr class="ending">
            <td class="label">Saldo Akhir</td>
            <td class="value">{{ $fmt($statement['ending_balance'] ?? 0) }}</td>
        </tr>
    </table>
</div>

<div class="section">
    <div class="section-title">Ringkasan kategori</div>
    @if (count($categories) === 0)
        <p class="empty">Tidak ada mutasi pada periode ini.</p>
    @else
        <table class="cats">
            <thead>
                <tr>
                    <th>Kategori</th>
                    <th style="text-align:right;">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($categories as $cat)
                    <tr>
                        <td>{{ $cat['label'] ?? $cat['key'] ?? 'Lainnya' }}</td>
                        <td class="amount">{{ $fmt($cat['amount'] ?? 0) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>

<div class="section">
    <div class="section-title">Rincian mutasi</div>
    @if (count($mutations) === 0)
        <p class="empty">Tidak ada mutasi saldo pada periode ini.</p>
    @else
        <table class="mut">
            <thead>
                <tr>
                    <th style="width:14%;">Tanggal</th>
                    <th style="width:34%;">Keterangan</th>
                    <th style="width:18%;">Kategori</th>
                    <th style="width:17%; text-align:right;">Uang Masuk</th>
                    <th style="width:17%; text-align:right;">Uang Keluar</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($mutations as $row)
                    @php
                        $isCredit = ($row['direction'] ?? '') === 'credit';
                        $amount = (float) ($row['amount'] ?? 0);
                    @endphp
                    <tr>
                        <td>{{ $fmtDate($row['occurred_at'] ?? null) }}</td>
                        <td class="desc">{{ $row['description'] ?? '—' }}</td>
                        <td>{{ $row['category_label'] ?? $row['category_key'] ?? 'Lainnya' }}</td>
                        <td class="num">{{ $isCredit ? $fmt($amount) : '—' }}</td>
                        <td class="num">{{ ! $isCredit ? $fmt($amount) : '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td>Total pemasukan</td>
                <td class="r">{{ $fmt($statement['income'] ?? 0) }}</td>
            </tr>
            <tr>
                <td>Total pengeluaran</td>
                <td class="r">{{ $fmt($statement['expense'] ?? 0) }}</td>
            </tr>
        </table>
    @endif
</div>

<div class="footer">
    GurkyNet · GurkyPay · Laporan dihasilkan otomatis dari ledger wallet.<br>
    Periode {{ $statement['period']['key'] ?? '' }} · {{ $period_label }}
</div>
</body>
</html>
