# DEPRECATED — folder root `database/`

**Sprint 0 keputusan #13:** seeder & skema database berada di `laravel/database/`.

- `DemoUserSeeder` telah dipindahkan ke [`laravel/database/seeders/DemoUserSeeder.php`](../laravel/database/seeders/DemoUserSeeder.php).
- Folder ini dikosongkan dan **tidak boleh** dipakai untuk migration/seeder baru.
- Boleh dihapus manual dari root repo setelah Anda memastikan tidak ada referensi CI/script yang masih menunjuk ke sini.
