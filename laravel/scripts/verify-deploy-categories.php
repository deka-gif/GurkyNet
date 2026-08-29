<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (\App\Models\ProductCategory::whereIn('slug', [
    'pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk', 'pbb', 'samsat', 'multifinance',
])->orderBy('slug')->get(['id', 'slug', 'name']) as $c) {
    print_r($c->toArray());
}
