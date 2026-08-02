<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Actions\Admin\System\SystemSettingAction;
use App\Http\Resources\SystemSettingResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Exception;

class SystemSettingController extends Controller
{
    protected $systemSettingAction;

    public function __construct(SystemSettingAction $systemSettingAction)
    {
        $this->systemSettingAction = $systemSettingAction;
    }

    /**
     * Get all system settings.
     */
    public function index()
    {
        $data = $this->systemSettingAction->getAllSettings();
        
        return new SystemSettingResource($data);
    }

    /**
     * Update system settings.
     */
    public function update(Request $request)
    {
        $data = $request->validate([
            'settings' => 'required|array',
        ]);

        $updatedData = $this->systemSettingAction->updateSettings($data['settings']);

        return new SystemSettingResource($updatedData);
    }

    /**
     * Send test email
     */
    public function sendTestEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        try {
            Mail::raw('This is a test email from GurkyNet System Settings.', function ($message) use ($request) {
                $message->to($request->email)
                        ->subject('GurkyNet Test Email');
            });
            
            return response()->json([
                'success' => true,
                'message' => 'Test email sent successfully to ' . $request->email,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to send test email. Error: ' . $e->getMessage(),
            ], 500);
        }
    }
}
