<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoryIcon extends Model
{
    protected $fillable = ['key', 'icon_path', 'label'];
}
