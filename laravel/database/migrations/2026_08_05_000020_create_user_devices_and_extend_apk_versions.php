<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('user_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('device_uuid', 191);
            $table->string('platform', 32); // android | ios | web | pwa
            $table->string('push_token', 512)->nullable();
            $table->string('push_provider', 32)->nullable(); // fcm | apns | webpush
            $table->string('app_version', 64)->nullable();
            $table->unsignedInteger('app_build')->nullable();
            $table->string('device_model', 128)->nullable();
            $table->string('os_version', 64)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['device_uuid', 'platform']);
            $table->index(['user_id', 'is_active']);
            $table->index('push_token');
        });

        Schema::table('apk_versions', function (Blueprint $table) {
            if (!Schema::hasColumn('apk_versions', 'platform')) {
                $table->string('platform', 32)->default('android')->after('id');
            }
            if (!Schema::hasColumn('apk_versions', 'min_supported_version_code')) {
                $table->unsignedInteger('min_supported_version_code')->nullable()->after('version_code');
            }
            if (!Schema::hasColumn('apk_versions', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('is_force_update');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_devices');

        Schema::table('apk_versions', function (Blueprint $table) {
            if (Schema::hasColumn('apk_versions', 'platform')) {
                $table->dropColumn('platform');
            }
            if (Schema::hasColumn('apk_versions', 'min_supported_version_code')) {
                $table->dropColumn('min_supported_version_code');
            }
            if (Schema::hasColumn('apk_versions', 'is_active')) {
                $table->dropColumn('is_active');
            }
        });
    }
};
