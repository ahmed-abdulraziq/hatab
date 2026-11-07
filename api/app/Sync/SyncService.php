<?php

namespace App\Sync;

use App\Models\Client;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Two-way sync between the owner's devices and the server.
 *
 * A device sends what changed on it since its last sync, and gets back everything that
 * changed on the server since the change number it last saw:
 *
 *  - Push: each record wins if its `updatedAt` is newer than the server's copy ("last
 *    write wins"). Deleted records come as tombstones with `deletedAt` set.
 *  - Pull: every account has one growing change number (`users.revision`). Each saved
 *    record takes the next number, so "everything above N" is exact and never misses or
 *    repeats a change. Long histories come in pages (`hasMore`).
 *
 * The account row is locked for the whole request, so two devices syncing at once take
 * turns and change numbers never interleave.
 */
class SyncService
{
    public const MAX_PUSH = 500;

    public const MAX_PAGE = 500;

    /** One billion pounds, in piasters. */
    public const MAX_AMOUNT = 100_000_000_000;

    public function sync(User $user, array $data): array
    {
        return DB::transaction(function () use ($user, $data) {
            $owner = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            $rejected = [];

            $revision = $owner->revision;
            $revision = $this->pushClients($owner, $data['clients'] ?? [], $revision, $rejected);
            $revision = $this->pushTransactions($owner, $data['transactions'] ?? [], $revision, $rejected);

            if ($revision !== $owner->revision) {
                $owner->revision = $revision;
                $owner->save();
            }

            $page = $this->pull($owner, (int) $data['since'], (int) ($data['limit'] ?? self::MAX_PAGE));

            return [...$page, 'rejected' => $rejected];
        });
    }

    private function pushClients(User $owner, array $incoming, int $revision, array &$rejected): int
    {
        if ($incoming === []) {
            return $revision;
        }

        $ids = array_map(fn (array $item) => strtolower($item['id']), $incoming);
        $existing = Client::query()->whereIn('id', $ids)->get()->keyBy('id');

        foreach ($incoming as $item) {
            $id = strtolower($item['id']);
            $current = $existing->get($id);

            if ($current && $current->user_id !== $owner->id) {
                $rejected[] = ['kind' => 'client', 'id' => $id, 'reason' => 'not_yours'];

                continue;
            }

            $updatedAt = SyncTime::parse($item['updatedAt']);
            if ($current && $current->updated_at->greaterThanOrEqualTo($updatedAt)) {
                continue; // the server already has this change or a newer one
            }

            $client = $current ?? new Client;
            $client->id = $id;
            $client->user_id = $owner->id;
            $client->name = $item['name'];
            $client->phone = $item['phone'] ?? '';
            $client->address = $item['address'] ?? '';
            $client->created_at = SyncTime::parse($item['createdAt']);
            $client->updated_at = $updatedAt;
            $client->deleted_at = isset($item['deletedAt']) ? SyncTime::parse($item['deletedAt']) : null;
            $client->revision = ++$revision;
            $client->save();
        }

        return $revision;
    }

    private function pushTransactions(User $owner, array $incoming, int $revision, array &$rejected): int
    {
        if ($incoming === []) {
            return $revision;
        }

        $ids = array_map(fn (array $item) => strtolower($item['id']), $incoming);
        $existing = Transaction::query()->whereIn('id', $ids)->get()->keyBy('id');

        // Clients are pushed first, so an entry may point at a client from the same request.
        $clientIds = array_values(array_unique(array_filter(array_map(
            fn (array $item) => isset($item['clientId']) ? strtolower($item['clientId']) : null,
            $incoming,
        ))));
        $ownClients = $clientIds === [] ? [] : array_flip(
            Client::query()->where('user_id', $owner->id)->whereIn('id', $clientIds)->pluck('id')->all(),
        );

        foreach ($incoming as $item) {
            $id = strtolower($item['id']);
            $clientId = isset($item['clientId']) ? strtolower($item['clientId']) : null;
            $current = $existing->get($id);

            if ($current && $current->user_id !== $owner->id) {
                $rejected[] = ['kind' => 'transaction', 'id' => $id, 'reason' => 'not_yours'];

                continue;
            }

            if ($clientId !== null && ! isset($ownClients[$clientId])) {
                $rejected[] = ['kind' => 'transaction', 'id' => $id, 'reason' => 'unknown_client'];

                continue;
            }

            $updatedAt = SyncTime::parse($item['updatedAt']);
            if ($current && $current->updated_at->greaterThanOrEqualTo($updatedAt)) {
                continue;
            }

            $transaction = $current ?? new Transaction;
            $transaction->id = $id;
            $transaction->user_id = $owner->id;
            $transaction->client_id = $clientId;
            $transaction->type = $item['type'];
            $transaction->amount = $item['amount'];
            $transaction->date = $item['date'];
            $transaction->note = $item['note'] ?? '';
            $transaction->created_at = SyncTime::parse($item['createdAt']);
            $transaction->updated_at = $updatedAt;
            $transaction->deleted_at = isset($item['deletedAt']) ? SyncTime::parse($item['deletedAt']) : null;
            $transaction->revision = ++$revision;
            $transaction->save();
        }

        return $revision;
    }

    /** Everything that changed after `$since`, oldest first, at most `$limit` records. */
    private function pull(User $owner, int $since, int $limit): array
    {
        $clients = Client::query()
            ->where('user_id', $owner->id)
            ->where('revision', '>', $since)
            ->orderBy('revision')
            ->limit($limit + 1)
            ->get();
        $transactions = Transaction::query()
            ->where('user_id', $owner->id)
            ->where('revision', '>', $since)
            ->orderBy('revision')
            ->limit($limit + 1)
            ->get();

        // Both tables share the account's change numbers, so merging by number gives the
        // oldest changes across both; the page ends exactly at its last record's number.
        $changes = $clients->concat($transactions)->sortBy('revision')->values();
        $hasMore = $changes->count() > $limit;
        $page = $changes->take($limit);

        return [
            'revision' => $hasMore ? $page->last()->revision : max($since, $owner->revision),
            'hasMore' => $hasMore,
            'clients' => $page->filter(fn ($record) => $record instanceof Client)
                ->map(fn (Client $client) => $client->toSync())->values()->all(),
            'transactions' => $page->filter(fn ($record) => $record instanceof Transaction)
                ->map(fn (Transaction $transaction) => $transaction->toSync())->values()->all(),
        ];
    }
}
