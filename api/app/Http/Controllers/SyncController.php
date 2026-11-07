<?php

namespace App\Http\Controllers;

use App\Sync\SyncService;
use App\Sync\SyncTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __invoke(Request $request, SyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'since' => ['required', 'integer', 'min:0'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:'.SyncService::MAX_PAGE],

            'clients' => ['sometimes', 'array', 'max:'.SyncService::MAX_PUSH],
            'clients.*.id' => ['required', 'uuid', 'distinct:ignore_case'],
            'clients.*.name' => ['required', 'string', 'max:80'],
            'clients.*.phone' => ['nullable', 'string', 'max:40'],
            'clients.*.address' => ['nullable', 'string', 'max:200'],
            'clients.*.createdAt' => ['required', SyncTime::RULE],
            'clients.*.updatedAt' => ['required', SyncTime::RULE],
            'clients.*.deletedAt' => ['nullable', SyncTime::RULE],

            'transactions' => ['sometimes', 'array', 'max:'.SyncService::MAX_PUSH],
            'transactions.*.id' => ['required', 'uuid', 'distinct:ignore_case'],
            'transactions.*.clientId' => ['nullable', 'uuid'],
            'transactions.*.type' => ['required', 'in:gave,got'],
            'transactions.*.amount' => ['required', 'integer', 'min:1', 'max:'.SyncService::MAX_AMOUNT],
            'transactions.*.date' => ['required', 'date_format:Y-m-d'],
            'transactions.*.note' => ['nullable', 'string', 'max:200'],
            'transactions.*.createdAt' => ['required', SyncTime::RULE],
            'transactions.*.updatedAt' => ['required', SyncTime::RULE],
            'transactions.*.deletedAt' => ['nullable', SyncTime::RULE],
        ]);

        return response()->json($sync->sync($request->user(), $data));
    }
}
