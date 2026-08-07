<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Models\DigiflazzTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DigiflazzWebhookAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected Product $product;

    protected string $webhookSecret = 'testing_webhook_secret';

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);
        Queue::fake();

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.webhook_secret' => $this->webhookSecret,
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        $this->user = User::create([
            'name' => 'Webhook User',
            'email' => 'webhook@example.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104277700001',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa-webhook',
            'icon' => 'phone',
        ]);
        $brand = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 't.png',
            'is_active' => true,
        ]);
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'sku_code' => 'TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $headers
     */
    protected function postDigiflazzWebhook(array $payload, array $headers = [], ?string $secret = null): \Illuminate\Testing\TestResponse
    {
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $this->assertIsString($body);

        $secret ??= $this->webhookSecret;
        $autoSig = 'sha1='.hash_hmac('sha1', $body, $secret);

        $server = [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ];

        $hub = $headers['X-Hub-Signature'] ?? null;
        $legacy = $headers['X-Digiflazz-Signature'] ?? null;

        if ($hub === '__AUTO__') {
            $server['HTTP_X_HUB_SIGNATURE'] = $autoSig;
        } elseif (is_string($hub)) {
            $server['HTTP_X_HUB_SIGNATURE'] = $hub;
        } elseif ($legacy === '__AUTO__') {
            $server['HTTP_X_DIGIFLAZZ_SIGNATURE'] = $autoSig;
        } elseif (is_string($legacy)) {
            $server['HTTP_X_DIGIFLAZZ_SIGNATURE'] = $legacy;
        } else {
            $server['HTTP_X_HUB_SIGNATURE'] = $autoSig;
        }

        foreach ($headers as $name => $value) {
            if (in_array($name, ['X-Hub-Signature', 'X-Digiflazz-Signature'], true)) {
                continue;
            }
            $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
        }

        return $this->call('POST', '/api/v1/webhooks/digiflazz', [], [], [], $server, $body);
    }

    protected function seedPendingTransaction(string $status = 'Success'): array
    {
        $tx = app(CreateTransactionAction::class)->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456',
        );

        $digi = DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => 'TSEL10K',
            'customer_no' => '081234567890',
            'digiflazz_status' => 'pending',
        ]);

        return [$tx, $digi, [
            'data' => [
                'ref_id' => $tx->invoice_number,
                'buyer_sku_code' => 'TSEL10K',
                'customer_no' => '081234567890',
                'status' => $status,
                'sn' => 'SN-WH-1',
                'rc' => '00',
                'price' => 10100,
                'buyer_last_saldo' => 999000,
                'tele' => '@seller',
                'wa' => '08123456789',
                'message' => 'Transaksi Sukses',
            ],
        ]];
    }

    public function test_x_hub_signature_valid_is_accepted(): void
    {
        [, $digi, $payload] = $this->seedPendingTransaction('Sukses');

        $response = $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'update',
            'User-Agent' => 'Digiflazz-Hookshot',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertSame('success', $digi->fresh()->digiflazz_status);
        $this->assertSame('00', $digi->fresh()->rc);
        $this->assertSame(10100, $digi->fresh()->price);
        $this->assertSame('@seller', $digi->fresh()->tele);
        $this->assertSame('08123456789', $digi->fresh()->wa);
        $this->assertSame('Transaksi Sukses', $digi->fresh()->message);
    }

    public function test_x_hub_signature_invalid_is_rejected(): void
    {
        [, , $payload] = $this->seedPendingTransaction();

        $response = $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => 'sha1=deadbeef',
        ]);

        $response->assertStatus(401)->assertJsonPath('success', false);
    }

    public function test_legacy_x_digiflazz_signature_is_accepted(): void
    {
        [$tx, $digi, $payload] = $this->seedPendingTransaction('Success');

        $response = $this->postDigiflazzWebhook($payload, [
            'X-Digiflazz-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'create',
        ]);

        $response->assertOk();
        $this->assertSame('success', $tx->fresh()->status);
        $this->assertSame('success', $digi->fresh()->digiflazz_status);
    }

    public function test_event_create_is_logged_and_processed(): void
    {
        Log::spy();
        [, , $payload] = $this->seedPendingTransaction('Sukses');

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'create',
            'User-Agent' => 'Digiflazz-Hookshot',
        ])->assertOk();

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = null) {
            return $message === 'Digiflazz webhook received'
                && is_array($context)
                && ($context['event'] ?? null) === 'create';
        })->atLeast()->once();
    }

    public function test_event_update_is_logged_and_processed(): void
    {
        Log::spy();
        [, , $payload] = $this->seedPendingTransaction('Sukses');

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'update',
        ])->assertOk();

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = null) {
            return $message === 'Digiflazz webhook received'
                && is_array($context)
                && ($context['event'] ?? null) === 'update';
        })->atLeast()->once();
    }

    public function test_event_resend_is_logged_and_processed(): void
    {
        Log::spy();
        [, , $payload] = $this->seedPendingTransaction('Sukses');

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'resend',
        ])->assertOk();

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = null) {
            return $message === 'Digiflazz webhook received'
                && is_array($context)
                && ($context['event'] ?? null) === 'resend';
        })->atLeast()->once();
    }

    public function test_ping_event_returns_200_without_transaction_lookup(): void
    {
        Log::spy();

        $payload = [
            'sed' => 'AgXXtVAHp',
            'hook_id' => '11aaabbb',
            'hook' => [
                'url' => 'https://awesomesite.com/webhooks',
                'secret' => 'somesecretkeywords',
                'type' => 'application/json',
                'status' => 1,
            ],
        ];

        $response = $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'ping',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Webhook ping acknowledged.');

        Log::shouldHaveReceived('info')->withArgs(function ($message) {
            return $message === 'Digiflazz webhook ping';
        })->atLeast()->once();
    }

    public function test_user_agent_prepaid_is_classified(): void
    {
        Log::spy();
        [, , $payload] = $this->seedPendingTransaction('Pending');

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'User-Agent' => 'Digiflazz-Hookshot',
            'X-Digiflazz-Event' => 'update',
        ])->assertOk();

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = null) {
            return $message === 'Digiflazz webhook received'
                && is_array($context)
                && ($context['user_agent_class'] ?? null) === 'prepaid';
        })->atLeast()->once();
    }

    public function test_user_agent_pasca_is_classified(): void
    {
        Log::spy();
        [, , $payload] = $this->seedPendingTransaction('Pending');

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'User-Agent' => 'Digiflazz-Pasca-Hookshot',
            'X-Digiflazz-Event' => 'update',
        ])->assertOk();

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = null) {
            return $message === 'Digiflazz webhook received'
                && is_array($context)
                && ($context['user_agent_class'] ?? null) === 'postpaid';
        })->atLeast()->once();
    }

    public function test_duplicate_webhook_does_not_create_new_transaction_or_double_settle(): void
    {
        [$tx, $digi, $payload] = $this->seedPendingTransaction('Sukses');
        $countBefore = DigiflazzTransaction::count();

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'create',
        ])->assertOk();

        $this->assertSame('success', $tx->fresh()->status);

        Log::spy();
        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'update',
        ])->assertOk();

        $this->assertSame($countBefore, DigiflazzTransaction::count());
        $this->assertSame('success', $tx->fresh()->status);
        $this->assertSame($digi->id, DigiflazzTransaction::where('ref_id', $tx->invoice_number)->value('id'));

        Log::shouldHaveReceived('info')->withArgs(function ($message) {
            return $message === 'Digiflazz webhook duplicate — transaction already terminal';
        })->atLeast()->once();
    }

    public function test_mapping_status_sukses(): void
    {
        [$tx, , $payload] = $this->seedPendingTransaction('Sukses');
        $this->postDigiflazzWebhook($payload, ['X-Hub-Signature' => '__AUTO__'])->assertOk();
        $this->assertSame('success', $tx->fresh()->status);
    }

    public function test_mapping_status_gagal(): void
    {
        [$tx, $digi, $payload] = $this->seedPendingTransaction('Gagal');
        $payload['data']['status'] = 'Gagal';
        $payload['data']['sn'] = '';
        $payload['data']['message'] = 'Transaksi Gagal';
        $payload['data']['rc'] = '99';

        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->postDigiflazzWebhook($payload, ['X-Hub-Signature' => '__AUTO__'])->assertOk();

        $this->assertSame('failed', $tx->fresh()->status);
        $this->assertSame('failed', $digi->fresh()->digiflazz_status);
        $this->assertEquals($balanceBefore + 11500, (float) $this->wallet->fresh()->balance);
    }

    public function test_mapping_status_pending(): void
    {
        [$tx, $digi, $payload] = $this->seedPendingTransaction('Pending');
        $payload['data']['status'] = 'Process';

        $this->postDigiflazzWebhook($payload, [
            'X-Hub-Signature' => '__AUTO__',
            'X-Digiflazz-Event' => 'update',
        ])->assertOk();

        $this->assertSame('processing', $tx->fresh()->status);
        $this->assertSame('pending', $digi->fresh()->digiflazz_status);
    }
}
