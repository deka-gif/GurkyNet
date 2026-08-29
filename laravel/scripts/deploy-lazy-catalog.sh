#!/bin/bash
set -e
cd /var/www/GurkyNet/laravel
sudo cp /tmp/gurkynet-deploy/AvailabilityService.php app/Services/
sudo cp /tmp/gurkynet-deploy/ProductResource.php app/Http/Resources/
sudo cp /tmp/gurkynet-deploy/ProductRepository.php app/Repositories/Eloquent/
sudo cp /tmp/gurkynet-deploy/ProductRepositoryInterface.php app/Repositories/Contracts/
sudo cp /tmp/gurkynet-deploy/GetCategoryProviderSummaryAction.php app/Actions/Product/
sudo cp /tmp/gurkynet-deploy/SearchProductAction.php app/Actions/Product/
sudo cp /tmp/gurkynet-deploy/ProductController.php app/Http/Controllers/Api/v1/
sudo cp /tmp/gurkynet-deploy/ProductRoutingService.php app/Services/ProductProviders/
sudo cp /tmp/gurkynet-deploy/api.php routes/
sudo cp /tmp/gurkynet-deploy/benchmark-lazy-catalog.php scripts/
php artisan config:clear
php artisan route:clear
php artisan optimize:clear
php scripts/benchmark-lazy-catalog.php 21
