<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_shop_owner_can_sign_up_and_use_the_token(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'أحمد',
            'email' => '  Ahmed@Example.com ',
            'password' => 'secret-pass',
            'device' => 'Pixel 7',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'أحمد')
            ->assertJsonPath('user.email', 'ahmed@example.com')
            ->assertJsonPath('user.shopName', '');
        $token = $response->json('token');
        $this->assertIsString($token);

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'ahmed@example.com');
    }

    public function test_an_email_can_only_have_one_account(): void
    {
        User::factory()->create(['email' => 'ahmed@example.com']);

        $this->postJson('/api/v1/register', [
            'name' => 'أحمد تاني',
            'email' => 'AHMED@example.com',
            'password' => 'secret-pass',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'البريد الإلكتروني ده مستخدم قبل كده.']);
    }

    public function test_passwords_must_be_at_least_eight_characters(): void
    {
        $this->postJson('/api/v1/register', [
            'name' => 'منى',
            'email' => 'mona@example.com',
            'password' => 'short',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password' => 'كلمة السر: على الأقل 8 حروف.']);
    }

    public function test_login_gives_a_token_and_refuses_a_wrong_password(): void
    {
        User::factory()->create(['email' => 'mona@example.com', 'password' => 'right-password']);

        $this->postJson('/api/v1/login', ['email' => 'mona@example.com', 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'البريد الإلكتروني أو كلمة السر مش صح.']);

        $this->postJson('/api/v1/login', ['email' => 'nobody@example.com', 'password' => 'right-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'البريد الإلكتروني أو كلمة السر مش صح.']);

        $this->postJson('/api/v1/login', ['email' => ' Mona@Example.com', 'password' => 'right-password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'shopName']]);
    }

    public function test_logging_out_signs_out_only_that_device(): void
    {
        $user = User::factory()->create(['password' => 'right-password']);
        $login = fn (string $device) => $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'right-password',
            'device' => $device,
        ])->json('token');
        $phone = $login('phone');
        $laptop = $login('laptop');

        $this->withToken($phone)->postJson('/api/v1/logout')->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/v1/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($laptop)->getJson('/api/v1/me')->assertOk();
    }

    public function test_the_api_answers_in_json_even_without_an_accept_header(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();

        $this->get('/api/v1/me')
            ->assertUnauthorized()
            ->assertHeader('Content-Type', 'application/json');

        $this->post('/api/v1/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_the_owner_can_change_the_shop_name(): void
    {
        Sanctum::actingAs(User::factory()->create(['name' => 'أحمد']));

        $this->patchJson('/api/v1/me', ['shopName' => ' بقالة الأمل '])
            ->assertOk()
            ->assertJsonPath('user.shopName', 'بقالة الأمل')
            ->assertJsonPath('user.name', 'أحمد');

        $this->patchJson('/api/v1/me', ['shopName' => ''])
            ->assertOk()
            ->assertJsonPath('user.shopName', '');
    }

    public function test_signing_up_and_logging_in_are_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/login', ['email' => 'x@example.com', 'password' => 'whatever'])
                ->assertUnprocessable();
        }

        $this->postJson('/api/v1/login', ['email' => 'x@example.com', 'password' => 'whatever'])
            ->assertTooManyRequests();
    }

    public function test_behind_a_proxy_each_visitor_has_their_own_limit(): void
    {
        $from = fn (string $ip, string $email) => $this->withHeaders(['X-Forwarded-For' => $ip])
            ->postJson('/api/v1/login', ['email' => $email, 'password' => 'whatever']);

        // Ten failed logins from one visitor don't block a different visitor...
        for ($i = 0; $i < 10; $i++) {
            $from('203.0.113.1', "user{$i}@example.com")->assertUnprocessable();
        }
        $from('203.0.113.1', 'another@example.com')->assertTooManyRequests();
        $from('198.51.100.7', 'mona@example.com')->assertUnprocessable();
    }

    public function test_guessing_one_accounts_password_from_many_addresses_is_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->withHeaders(['X-Forwarded-For' => "203.0.113.{$i}"])
                ->postJson('/api/v1/login', ['email' => 'mona@example.com', 'password' => "guess-{$i}"])
                ->assertUnprocessable();
        }

        $this->withHeaders(['X-Forwarded-For' => '198.51.100.7'])
            ->postJson('/api/v1/login', ['email' => 'mona@example.com', 'password' => 'one-more'])
            ->assertTooManyRequests();
    }
}
