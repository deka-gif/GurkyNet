<?php

namespace App\Services\Payment;

/**
 * FR-USR03 / Bagian 16 — user-initiated wallet top-up Snap channels.
 * Catalog is Midtrans Snap payment types only. Not AUTO_TOPUP. Not a second gateway.
 */
class MidtransTopUpChannelCatalog
{
    public const MIN_AMOUNT = 10000;

    /** @var list<int> */
    public const QUICK_AMOUNTS = [10000, 50000, 100000, 250000, 500000];

    /**
     * Midtrans Snap `enabled_payments` values that this integration actually maps.
     * Do not add banks/outlets that are not in this table.
     *
     * @var array<string, array{method:string,label:string,enabled_payments:list<string>}>
     */
    public const CHANNELS = [
        'qris' => [
            'method' => 'qris',
            'label' => 'QRIS',
            'enabled_payments' => ['other_qris'],
        ],
        'bca_va' => [
            'method' => 'va',
            'label' => 'BCA',
            'enabled_payments' => ['bca_va'],
        ],
        'bni_va' => [
            'method' => 'va',
            'label' => 'BNI',
            'enabled_payments' => ['bni_va'],
        ],
        'bri_va' => [
            'method' => 'va',
            'label' => 'BRI',
            'enabled_payments' => ['bri_va'],
        ],
        'echannel' => [
            'method' => 'va',
            'label' => 'Mandiri',
            'enabled_payments' => ['echannel'],
        ],
        'alfamart' => [
            'method' => 'retail',
            'label' => 'Alfamart',
            'enabled_payments' => ['alfamart'],
        ],
        'indomaret' => [
            'method' => 'retail',
            'label' => 'Indomaret',
            'enabled_payments' => ['indomaret'],
        ],
    ];

    /**
     * @var array<string, string>
     */
    public const ALIASES = [
        'qris' => 'qris',
        'other_qris' => 'qris',
        'va' => 'va',
        'bca' => 'bca_va',
        'bca_va' => 'bca_va',
        'bni' => 'bni_va',
        'bni_va' => 'bni_va',
        'bri' => 'bri_va',
        'bri_va' => 'bri_va',
        'mandiri' => 'echannel',
        'mandiri_va' => 'echannel',
        'echannel' => 'echannel',
        'retail' => 'retail',
        'alfamart' => 'alfamart',
        'indomaret' => 'indomaret',
    ];

    public function __construct(
        protected MidtransCredentialResolver $credentials
    ) {}

    /**
     * @return list<string>
     */
    public function enabledChannelCodes(): array
    {
        $raw = config('services.midtrans.enabled_channels');
        if ($raw === null || $raw === '') {
            return array_keys(self::CHANNELS);
        }

        if (is_array($raw)) {
            $codes = $raw;
        } else {
            $codes = preg_split('/\s*,\s*/', (string) $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }

        $resolved = [];
        foreach ($codes as $code) {
            $canonical = $this->canonicalize((string) $code);
            if ($canonical !== null && isset(self::CHANNELS[$canonical])) {
                $resolved[] = $canonical;
            }
        }

        return array_values(array_unique($resolved));
    }

    public function isChannelEnabled(string $code): bool
    {
        $canonical = $this->canonicalize($code);
        if ($canonical === null) {
            return false;
        }

        return in_array($canonical, $this->enabledChannelCodes(), true);
    }

    public function canonicalize(?string $code): ?string
    {
        if ($code === null || trim($code) === '') {
            return null;
        }

        $key = strtolower(trim($code));

        return self::ALIASES[$key] ?? null;
    }

    /**
     * @return array{
     *   method:string,
     *   channel:string,
     *   label:string,
     *   enabled_payments:list<string>
     * }
     */
    public function resolve(string $paymentMethod, ?string $channel = null): array
    {
        $method = strtolower(trim($paymentMethod));
        if ($method === '') {
            $method = 'qris';
        }

        if (! in_array($method, ['qris', 'va', 'retail'], true)) {
            $asChannel = $this->canonicalize($method);
            if ($asChannel !== null && isset(self::CHANNELS[$asChannel])) {
                $method = self::CHANNELS[$asChannel]['method'];
                $channel = $asChannel;
            }
        }

        if ($method === 'qris') {
            if (! $this->isChannelEnabled('qris')) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'payment_method' => ['Metode QRIS sedang tidak tersedia.'],
                ]);
            }

            $meta = self::CHANNELS['qris'];

            return [
                'method' => 'qris',
                'channel' => 'qris',
                'label' => $meta['label'],
                'enabled_payments' => $meta['enabled_payments'],
            ];
        }

        if ($method === 'va') {
            if ($channel === null || trim($channel) === '') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Pilih bank Virtual Account terlebih dahulu.'],
                ]);
            }

            $canonical = $this->canonicalize($channel);
            if ($canonical === null || ! isset(self::CHANNELS[$canonical]) || self::CHANNELS[$canonical]['method'] !== 'va') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Bank Virtual Account tidak didukung.'],
                ]);
            }

            if (! $this->isChannelEnabled($canonical)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Bank Virtual Account tersebut sedang tidak tersedia.'],
                ]);
            }

            $meta = self::CHANNELS[$canonical];

            return [
                'method' => 'va',
                'channel' => $canonical,
                'label' => $meta['label'],
                'enabled_payments' => $meta['enabled_payments'],
            ];
        }

        if ($method === 'retail') {
            if ($channel === null || trim($channel) === '') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Pilih gerai Alfamart atau Indomaret terlebih dahulu.'],
                ]);
            }

            $canonical = $this->canonicalize($channel);
            if ($canonical === null || ! isset(self::CHANNELS[$canonical]) || self::CHANNELS[$canonical]['method'] !== 'retail') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Metode gerai tidak didukung.'],
                ]);
            }

            if (! $this->isChannelEnabled($canonical)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'channel' => ['Metode gerai tersebut sedang tidak tersedia.'],
                ]);
            }

            $meta = self::CHANNELS[$canonical];

            return [
                'method' => 'retail',
                'channel' => $canonical,
                'label' => $meta['label'],
                'enabled_payments' => $meta['enabled_payments'],
            ];
        }

        throw \Illuminate\Validation\ValidationException::withMessages([
            'payment_method' => ['Metode pembayaran tidak didukung.'],
        ]);
    }

    /**
     * Public catalog for GET /wallet/payment-config. Never includes server_key.
     *
     * @return array<string, mixed>
     */
    public function publicCatalog(): array
    {
        $configured = (bool) ($this->credentials->publicConfig()['configured'] ?? false);
        $enabled = $this->enabledChannelCodes();

        $qrisOn = $configured && in_array('qris', $enabled, true);
        $vaBanks = [];
        foreach (['bca_va', 'bni_va', 'bri_va', 'echannel'] as $code) {
            $on = $configured && in_array($code, $enabled, true);
            $vaBanks[] = [
                'code' => $code,
                'label' => self::CHANNELS[$code]['label'],
                'enabled' => $on,
            ];
        }
        $vaOn = collect($vaBanks)->contains(fn (array $b) => $b['enabled']);

        $outlets = [];
        foreach (['alfamart', 'indomaret'] as $code) {
            $on = $configured && in_array($code, $enabled, true);
            $outlets[] = [
                'code' => $code,
                'label' => self::CHANNELS[$code]['label'],
                'enabled' => $on,
            ];
        }
        $retailOn = collect($outlets)->contains(fn (array $o) => $o['enabled']);

        return [
            'min_amount' => self::MIN_AMOUNT,
            'quick_amounts' => self::QUICK_AMOUNTS,
            'methods' => [
                [
                    'id' => 'qris',
                    'label' => 'QRIS',
                    'enabled' => $qrisOn,
                ],
                [
                    'id' => 'va',
                    'label' => 'Virtual Account',
                    'enabled' => $vaOn,
                    'banks' => $vaBanks,
                ],
                [
                    'id' => 'retail',
                    'label' => 'Alfa/Indomaret',
                    'enabled' => $retailOn,
                    'outlets' => $outlets,
                ],
            ],
        ];
    }
}
