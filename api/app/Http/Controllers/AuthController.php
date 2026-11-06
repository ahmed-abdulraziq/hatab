<?php

namespace App\Http\Controllers;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', Password::min(8), $this->fitsBcrypt(...)],
            'device' => ['nullable', 'string', 'max:80'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        return response()->json($this->newSession($user, $data['device'] ?? null), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device' => ['nullable', 'string', 'max:80'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        // Check a hash even for an unknown email, so the response time doesn't reveal
        // which emails have accounts.
        $valid = Hash::check($data['password'], $user?->password ?? self::dummyHash());
        if (! $user || ! $valid) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        return response()->json($this->newSession($user, $data['device'] ?? null));
    }

    /** Logs out this device only; the owner's other devices stay logged in. */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    /** A login token for this device, plus the account details the app shows. */
    private function newSession(User $user, ?string $device): array
    {
        return [
            'token' => $user->createToken($device ?: 'HATAB')->plainTextToken,
            'user' => $user->toProfile(),
        ];
    }

    private function normalizeEmail(Request $request): void
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => Str::lower(trim($email))]);
        }
    }

    /** bcrypt only reads the first 72 bytes, and an Arabic letter takes two. */
    private function fitsBcrypt(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && strlen($value) > 72) {
            $fail('كلمة السر طويلة قوي.');
        }
    }

    private static function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= Hash::make(Str::random(32));
    }
}
