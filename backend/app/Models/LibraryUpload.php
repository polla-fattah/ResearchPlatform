<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LibraryUpload extends Model
{
    protected $table = 'library_uploads';

    protected $fillable = [
        'user_id',
        'filename',
        'storage_path',
        'mime_type',
        'file_size',
        'checksum',
        'kind',
        'description',
        'rights_statement',
        'ownership_confirmed',
        'scan_status',
    ];

    protected $hidden = ['storage_path'];

    protected $casts = [
        'file_size' => 'integer',
        'ownership_confirmed' => 'boolean',
    ];
}
