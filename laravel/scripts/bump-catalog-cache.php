<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
\App\Services\ProductProviders\ProductCatalogCache::bump();
echo "ProductCatalogCache bumped\n";
