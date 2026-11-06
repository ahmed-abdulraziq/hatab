<?php

namespace App\Models;

use App\Sync\SyncTime;
use Illuminate\Database\Eloquent\Model;

/**
 * A customer in a shop owner's book. The id and the timestamps come from the device that
 * created or changed it; `revision` is the server's change number used for syncing.
 */
class Client extends Model
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
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'createdAt' => SyncTime::format($this->created_at),
            'updatedAt' => SyncTime::format($this->updated_at),
            'deletedAt' => SyncTime::format($this->deleted_at),
        ];
    }
}
