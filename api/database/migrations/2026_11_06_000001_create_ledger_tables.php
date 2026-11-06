<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Clients and entries are created on the phone, offline, so their ids are UUIDs made
    // there and their timestamps are the phone's. Deleted rows stay as "tombstones"
    // (deleted_at set) so the deletion reaches the owner's other devices.
    // `revision` is the account's change number at the time of the last change; devices
    // ask for everything above the last number they saw.

    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('phone', 40)->default('');
            $table->string('address', 200)->default('');
            $table->dateTime('created_at', precision: 3);
            $table->dateTime('updated_at', precision: 3);
            $table->dateTime('deleted_at', precision: 3)->nullable();
            $table->unsignedBigInteger('revision');
            $table->index(['user_id', 'revision']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // No foreign key on purpose: the sync checks that the client is the same owner's.
            $table->uuid('client_id')->nullable();
            $table->string('type', 4);
            $table->unsignedBigInteger('amount');
            $table->date('date');
            $table->string('note', 200)->default('');
            $table->dateTime('created_at', precision: 3);
            $table->dateTime('updated_at', precision: 3);
            $table->dateTime('deleted_at', precision: 3)->nullable();
            $table->unsignedBigInteger('revision');
            $table->index(['user_id', 'revision']);
            $table->index(['user_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('clients');
    }
};
