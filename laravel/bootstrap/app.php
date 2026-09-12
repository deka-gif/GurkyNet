<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // API-first app: Laravel 11 defaults redirectGuestsTo(route('login')), but this
        // project has no named "login" route. Calling route('login') on unauthenticated
        // API requests without Accept: application/json caused RouteNotFoundException → 500.
        // Keep auth:sanctum enforcement; null redirect → AuthenticationException → 401 JSON.
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'health.token' => \App\Http\Middleware\ProtectHealthMetrics::class,
            'owner.readonly' => \App\Http\Middleware\EnsureOwnerReadOnly::class,
            'renew.token' => \App\Http\Middleware\RenewTokenExpiration::class,
            'partner.api' => \App\Http\Middleware\AuthenticatePartnerApi::class,
            'partner.api.rate' => \App\Http\Middleware\PartnerApiRateLimit::class,
            'account.not_pending_deletion' => \App\Http\Middleware\EnsureAccountNotPendingDeletion::class,
        ]);
        $middleware->api(prepend: [
            \App\Http\Middleware\TraceRequest::class,
            \App\Http\Middleware\StandardizeApiErrors::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (\Illuminate\Http\Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (\App\Exceptions\AccountDeletionException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'code' => $e->errorCode,
                    'data' => null,
                    'meta' => null,
                    'errors' => $e->errors ?: null,
                ], $e->statusCode);
            }
        });
    })->create();
