<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Faq extends Model
{
    use HasFactory;

    protected $table = 'faq'; // Explicitly set because of non-standard pluralisation

    protected $fillable = [
        'question',
        'answer',
        'order',
    ];

    protected $casts = [
        'order' => 'integer',
    ];
}
