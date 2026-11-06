<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->toProfile()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'shopName' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        $user = $request->user();
        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('shopName', $data)) {
            $user->shop_name = $data['shopName'] ?? '';
        }
        $user->save();

        return response()->json(['user' => $user->toProfile()]);
    }
}
