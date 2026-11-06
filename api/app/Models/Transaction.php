<?php

namespace App\Models;

use App\Sync\SyncTime;
use Illuminate\Database\Eloquent\Model;

/**
 * One entry in the book. "gave" means the owner gave the client goods or money (the client
 * owes more); "got" means the owner got money (the client owes less). Amounts are whole
 * piasters. Entries without a client are the owner's own income and expenses.
 */
class Transaction extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'amount' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'deleted_at' => 'datetime',
            'revision' => 'integer',
        ];
    }

    /** The shape the app keeps on the device. */
    public function toSync(): array
    {
        return [
            'id' => $this->id,
            'clientId' => $this->client_id,
            'type' => $this->type,
            'amount' => $this->amount,
            'date' => substr((string) $this->date, 0, 10),
            'note' => $this->note,
            'createdAt' => SyncTime::format($this->created_at),
            'updatedAt' => SyncTime::format($this->updated_at),
            'deletedAt' => SyncTime::format($this->deleted_at),
        ];
    }
}
