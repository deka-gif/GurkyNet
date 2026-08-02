<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Validation\ValidationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class StandardizeApiErrors
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $response = $next($request);

            // If it is a JsonResponse, ensure it matches our strict response contract
            if ($response instanceof \Illuminate\Http\JsonResponse) {
                $data = $response->getData(true);
                if (is_array($data)) {
                    $keys = ['success', 'message', 'data', 'meta', 'errors'];
                    $missing = false;
                    foreach ($keys as $key) {
                        if (!array_key_exists($key, $data)) {
                            $missing = true;
                            break;
                        }
                    }

                    if ($missing) {
                        $success = $data['success'] ?? ($response->getStatusCode() < 400);
                        $message = $data['message'] ?? ($success ? 'Request successful.' : 'An error occurred.');
                        
                        $payloadData = $data['data'] ?? null;
                        if ($payloadData === null && $success) {
                            $filtered = array_diff_key($data, array_flip(['success', 'message', 'meta', 'errors']));
                            if (!empty($filtered)) {
                                $payloadData = $filtered;
                            }
                        }

                        $payloadMeta = $data['meta'] ?? null;
                        $payloadErrors = $data['errors'] ?? null;
                        if (!$success && $payloadErrors === null) {
                            $filteredErrors = array_diff_key($data, array_flip(['success', 'message', 'data', 'meta']));
                            if (!empty($filteredErrors)) {
                                $payloadErrors = $filteredErrors;
                            }
                        }

                        $response->setData([
                            'success' => $success,
                            'message' => $message,
                            'data' => $payloadData,
                            'meta' => $payloadMeta,
                            'errors' => $payloadErrors,
                        ]);
                    }
                }
            } else {
                // Non-JSON HTTP response errors (e.g. 404, 500 HTML) converted to JSON
                $statusCode = $response->getStatusCode();
                if ($statusCode >= 400) {
                    $content = $response->getContent();
                    $message = 'An error occurred (Status Code: ' . $statusCode . ')';
                    
                    $decoded = json_decode($content, true);
                    if (is_array($decoded)) {
                        $message = $decoded['message'] ?? $message;
                    }

                    return response()->json([
                        'success' => false,
                        'message' => $message,
                        'data' => null,
                        'meta' => null,
                        'errors' => is_array($decoded) ? ($decoded['errors'] ?? $decoded) : null
                    ], $statusCode);
                }
            }

            return $response;

        } catch (Throwable $e) {
            $statusCode = 500;
            $message = $e->getMessage();
            $errors = null;

            if ($e instanceof ValidationException) {
                $statusCode = 422;
                $message = $e->getMessage();
                $errors = $e->errors();
            } elseif ($e instanceof AuthenticationException) {
                $statusCode = 401;
                $message = 'Unauthenticated.';
            } elseif ($e instanceof AuthorizationException) {
                $statusCode = 403;
                $message = 'This action is unauthorized.';
            } elseif ($e instanceof NotFoundHttpException) {
                $statusCode = 404;
                $message = 'Resource not found.';
            } elseif ($e instanceof MethodNotAllowedHttpException) {
                $statusCode = 405;
                $message = 'Method not allowed.';
            } elseif ($e instanceof HttpExceptionInterface) {
                $statusCode = $e->getStatusCode();
                $message = $e->getMessage();
            }

            return response()->json([
                'success' => false,
                'message' => $message,
                'data' => null,
                'meta' => null,
                'errors' => $errors
            ], $statusCode);
        }
    }
}
