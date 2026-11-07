<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Signing up and logging in: a few tries a minute, to slow down password guessing.
        // Counted per address and per email, so guessing one account's password stays slow
        // even when the requests come from many addresses.
        RateLimiter::for('auth', fn (Request $request) => [
            Limit::perMinute(10)->by('ip:'.$request->ip()),
            Limit::perMinute(10)->by('email:'.Str::lower(trim((string) $request->input('email')))),
        ]);

        // Everything else, counted per account.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by(
            $request->user()?->getAuthIdentifier() ?? $request->ip(),
        ));
    }
}
