<?php

namespace App\Repositories\Contracts;

interface SystemSettingRepositoryInterface
{
    public function getAll();
    public function update(array $settings);
}
