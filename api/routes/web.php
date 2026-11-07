<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'name' => 'HATAB API',
    'docs' => 'https://github.com/ahmed-abdulraziq/hatab/tree/main/api#readme',
]));
