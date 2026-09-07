<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

App\Services\ProductProviders\ProductCatalogCache::bump();
echo 'bumped to '.App\Services\ProductProviders\ProductCatalogCache::version().PHP_EOL;
