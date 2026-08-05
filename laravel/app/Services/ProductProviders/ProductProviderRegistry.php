<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class ProductProviderRegistry
{
    /** @var array<string, ProductProviderAdapterInterface> */
    protected array $adapters = [];

    public function __construct(
        DigiflazzProductProviderAdapter $digiflazz,
        VipPulsaProductProviderAdapter $vip,
    ) {
        $this->register($digiflazz);
        $this->register($vip);
    }

    public function register(ProductProviderAdapterInterface $adapter): void
    {
        $this->adapters[$adapter->code()] = $adapter;
    }

    public function get(string $code): ProductProviderAdapterInterface
    {
        if (!isset($this->adapters[$code])) {
            throw new InvalidArgumentException("Unknown product provider adapter: {$code}");
        }

        $adapter = $this->adapters[$code];

        Log::info('EXEC TRACE — ProductProviderRegistry::get()', [
            'requested_provider_code' => $code,
            'adapter_class' => $adapter::class,
        ]);

        return $adapter;
    }

    public function has(string $code): bool
    {
        return isset($this->adapters[$code]);
    }

    /**
     * @return array<string, ProductProviderAdapterInterface>
     */
    public function all(): array
    {
        return $this->adapters;
    }
}
