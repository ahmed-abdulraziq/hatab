<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The day the client promised to pay by ("ميعاد السداد"). Null when there is none.

    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('due_date');
        });
    }
};
