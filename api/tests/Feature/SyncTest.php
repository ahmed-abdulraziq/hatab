<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    private function client(array $fields = []): array
    {
        return [
            'id' => (string) Str::uuid(),
            'name' => 'أحمد',
            'phone' => '01012345678',
            'address' => '',
            'createdAt' => '2026-11-05T10:00:00.000Z',
            'updatedAt' => '2026-11-05T10:00:00.000Z',
            'deletedAt' => null,
            ...$fields,
        ];
    }

    private function entry(array $fields = []): array
    {
        return [
            'id' => (string) Str::uuid(),
            'clientId' => null,
            'type' => 'gave',
            'amount' => 15000,
            'date' => '2026-11-05',
            'note' => '',
            'createdAt' => '2026-11-05T10:00:00.000Z',
            'updatedAt' => '2026-11-05T10:00:00.000Z',
            'deletedAt' => null,
            ...$fields,
        ];
    }

    private function sync(int $since, array $clients = [], array $transactions = [], array $extra = []): TestResponse
    {
        return $this->postJson('/api/v1/sync', [
            'since' => $since,
            'clients' => $clients,
            'transactions' => $transactions,
            ...$extra,
        ]);
    }

    public function test_changes_from_one_device_reach_the_other(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $ahmed = $this->client();
        $sugar = $this->entry(['clientId' => $ahmed['id'], 'note' => '2 كيلو سكر']);
        $expense = $this->entry(['type' => 'got', 'amount' => 2550, 'note' => 'بيع نقدي']);

        // The phone pushes a client and two entries.
        $this->sync(0, [$ahmed], [$sugar, $expense])
            ->assertOk()
            ->assertJsonPath('revision', 3)
            ->assertJsonPath('hasMore', false)
            ->assertJsonPath('rejected', []);

        // The laptop has never synced: it gets everything, exactly as the phone sent it.
        $this->sync(0)
            ->assertOk()
            ->assertJsonPath('revision', 3)
            ->assertJsonPath('clients', [$ahmed])
            ->assertJsonPath('transactions', [$sugar, $expense]);

        // Nothing new after that.
        $this->sync(3)
            ->assertOk()
            ->assertJsonPath('revision', 3)
            ->assertJsonPath('clients', [])
            ->assertJsonPath('transactions', []);
    }

    public function test_the_newest_edit_wins(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = $this->client(['name' => 'أحمد', 'updatedAt' => '2026-11-05T12:00:00.000Z']);
        $this->sync(0, [$client])->assertOk();

        // An older edit from a device that was offline doesn't overwrite the newer one...
        $this->sync(1, [[...$client, 'name' => 'قديم', 'updatedAt' => '2026-11-05T11:00:00.000Z']])
            ->assertOk()
            ->assertJsonPath('revision', 1)
            ->assertJsonPath('clients', []);
        // ...and neither does the same edit sent twice.
        $this->sync(1, [$client])->assertOk()->assertJsonPath('revision', 1);
        $this->assertSame('أحمد', Client::find($client['id'])->name);

        // A newer edit does, and the other devices get it.
        $newer = [...$client, 'name' => 'أحمد علي', 'updatedAt' => '2026-11-05T13:00:00.123Z'];
        $this->sync(1, [$newer])
            ->assertOk()
            ->assertJsonPath('revision', 2)
            ->assertJsonPath('clients', [$newer]);
        $this->assertSame('أحمد علي', Client::find($client['id'])->name);
    }

    public function test_deletions_travel_as_tombstones(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = $this->client();
        $entry = $this->entry(['clientId' => $client['id']]);
        $this->sync(0, [$client], [$entry])->assertOk();

        $deleted = '2026-11-05T15:00:00.000Z';
        $this->sync(2, [[...$client, 'updatedAt' => $deleted, 'deletedAt' => $deleted]], [[...$entry, 'updatedAt' => $deleted, 'deletedAt' => $deleted]])
            ->assertOk()
            ->assertJsonPath('revision', 4);

        // A device that synced before the deletion learns about it.
        $this->sync(2)
            ->assertOk()
            ->assertJsonPath('clients.0.deletedAt', $deleted)
            ->assertJsonPath('transactions.0.deletedAt', $deleted);
        $this->assertDatabaseCount('clients', 1);
        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_accounts_never_see_or_change_each_others_data(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        Sanctum::actingAs($owner);
        $client = $this->client(['name' => 'عميل المالك']);
        $entry = $this->entry(['clientId' => $client['id']]);
        $this->sync(0, [$client], [$entry])->assertOk();

        Sanctum::actingAs($other);
        $this->sync(0)
            ->assertOk()
            ->assertJsonPath('revision', 0)
            ->assertJsonPath('clients', [])
            ->assertJsonPath('transactions', []);

        // Reusing the owner's ids, or pointing an entry at the owner's client, is refused.
        $later = '2026-11-06T10:00:00.000Z';
        $this->sync(0, [[...$client, 'name' => 'اتغيّر', 'updatedAt' => $later]], [
            [...$entry, 'amount' => 1, 'updatedAt' => $later],
            $mine = $this->entry(['clientId' => $client['id']]),
        ])
            ->assertOk()
            ->assertJsonPath('rejected', [
                ['kind' => 'client', 'id' => $client['id'], 'reason' => 'not_yours'],
                ['kind' => 'transaction', 'id' => $entry['id'], 'reason' => 'not_yours'],
                ['kind' => 'transaction', 'id' => $mine['id'], 'reason' => 'unknown_client'],
            ]);

        $this->assertSame('عميل المالك', Client::find($client['id'])->name);
        $this->assertSame(15000, Transaction::find($entry['id'])->amount);
        $this->assertSame(0, $other->fresh()->revision);
    }

    public function test_an_entry_needs_a_client_that_exists(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $orphan = $this->entry(['clientId' => (string) Str::uuid()]);

        $this->sync(0, [], [$orphan])
            ->assertOk()
            ->assertJsonPath('rejected.0.reason', 'unknown_client');
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_long_histories_come_in_pages(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $clients = [$this->client(), $this->client(), $this->client()];
        $entries = [$this->entry(), $this->entry()];
        $this->sync(0, $clients, $entries)->assertOk()->assertJsonPath('revision', 5);

        // Pages follow the change numbers across both kinds of records.
        $this->sync(0, extra: ['limit' => 2])
            ->assertJsonPath('revision', 2)
            ->assertJsonPath('hasMore', true)
            ->assertJsonPath('clients', [$clients[0], $clients[1]])
            ->assertJsonPath('transactions', []);
        $this->sync(2, extra: ['limit' => 2])
            ->assertJsonPath('revision', 4)
            ->assertJsonPath('hasMore', true)
            ->assertJsonPath('clients', [$clients[2]])
            ->assertJsonPath('transactions', [$entries[0]]);
        $this->sync(4, extra: ['limit' => 2])
            ->assertJsonPath('revision', 5)
            ->assertJsonPath('hasMore', false)
            ->assertJsonPath('transactions', [$entries[1]]);
    }

    public function test_ids_match_whatever_their_letter_case(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = $this->client();
        $this->sync(0, [[...$client, 'id' => strtoupper($client['id'])]])->assertOk();
        $this->sync(1, [[...$client, 'name' => 'جديد', 'updatedAt' => '2026-11-06T00:00:00.000Z']])->assertOk();

        $this->assertDatabaseCount('clients', 1);
        $this->assertSame('جديد', Client::find($client['id'])->name);
    }

    public function test_invalid_records_are_refused_with_the_reason(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->sync(0, [$this->client(['name' => '', 'updatedAt' => 'yesterday'])], [
            $this->entry(['type' => 'other', 'amount' => 0, 'date' => '2026-13-40', 'id' => 'not-a-uuid']),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'clients.0.name',
                'clients.0.updatedAt',
                'transactions.0.id',
                'transactions.0.type',
                'transactions.0.amount',
                'transactions.0.date',
            ]);

        $this->postJson('/api/v1/sync', [])->assertUnprocessable()->assertJsonValidationErrors('since');
        $this->assertDatabaseCount('clients', 0);
    }

    public function test_sync_needs_a_login(): void
    {
        $this->sync(0)->assertUnauthorized();
    }
}
