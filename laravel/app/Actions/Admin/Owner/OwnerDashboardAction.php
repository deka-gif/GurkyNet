<?php

namespace App\Actions\Admin\Owner;

use App\Services\Executive\ExecutiveCommandCenterService;

class OwnerDashboardAction
{
    public function __construct(
        protected ExecutiveCommandCenterService $executive
    ) {}

    public function execute(): array
    {
        return $this->executive->overview();
    }
}
