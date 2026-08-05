<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Align legacy default 'customer' with UserRole::USER ('user')
        if (Schema::hasTable('users')) {
            DB::table('users')->where('role', 'customer')->update(['role' => 'user']);

            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE users MODIFY role VARCHAR(255) NOT NULL DEFAULT 'user'");
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users')) {
            DB::table('users')->where('role', 'user')->update(['role' => 'customer']);
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE users MODIFY role VARCHAR(255) NOT NULL DEFAULT 'customer'");
            }
        }
    }
};
