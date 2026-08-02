<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => config('app.name', 'GurkyPay API Engine'),
        'version' => '1.0.0',
        'status' => 'operational',
        'timestamp' => now()->toIso8601String()
    ]);
});
