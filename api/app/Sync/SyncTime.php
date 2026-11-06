<?php

namespace App\Sync;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/** Timestamps travel as the app writes them: "2026-11-05T14:33:12.123Z" (UTC, milliseconds). */
final class SyncTime
{
    /** The formats the sync endpoint accepts, for the date_format validation rule. */
    public const RULE = 'date_format:Y-m-d\TH:i:s.v\Z,Y-m-d\TH:i:s\Z,Y-m-d\TH:i:s.vP,Y-m-d\TH:i:sP';

    public static function parse(string $value): Carbon
    {
        return Carbon::parse($value)->utc();
    }

    public static function format(?CarbonInterface $time): ?string
    {
        return $time?->copy()->utc()->format('Y-m-d\TH:i:s.v\Z');
    }
}
