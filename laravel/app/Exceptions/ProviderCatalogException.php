<?php

namespace App\Exceptions;

use Exception;

/**
 * Catalog sync / provider probe failures that must NOT be remapped to Laravel ValidationException (422).
 * Carry Digiflazz/VIP response codes through to Operations UI as-is.
 */
class ProviderCatalogException extends Exception
{
    public function __construct(
        string $message,
        public readonly string $provider,
        public readonly string $providerCode,
        public readonly bool $retryable = false,
        public readonly array $meta = [],
        int $code = 0,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }

    public function toArray(): array
    {
        return [
            'success' => false,
            'provider' => $this->provider,
            'provider_code' => $this->providerCode !== ''
                ? (str_starts_with(strtoupper($this->providerCode), 'RC')
                    ? strtoupper($this->providerCode)
                    : 'RC'.$this->providerCode)
                : null,
            'message' => $this->getMessage(),
            'retryable' => $this->retryable,
            'data' => $this->meta ?: null,
        ];
    }
}
