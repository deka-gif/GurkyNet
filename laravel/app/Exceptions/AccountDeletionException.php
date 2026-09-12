<?php

namespace App\Exceptions;

use Exception;

/**
 * Account deletion / pending_deletion gate failures with stable API codes.
 */
class AccountDeletionException extends Exception
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $statusCode = 422,
        public readonly array $errors = []
    ) {
        parent::__construct($message);
    }

    public static function walletNotEmpty(): self
    {
        return new self(
            'Saldo wallet harus Rp0 sebelum mengajukan hapus akun. Habiskan atau tarik saldo terlebih dahulu.',
            'wallet_not_empty',
            422,
            ['balance' => ['Saldo wallet harus Rp0.']]
        );
    }

    public static function openTransactions(): self
    {
        return new self(
            'Masih ada transaksi yang belum selesai. Tunggu hingga semua transaksi final sebelum mengajukan hapus akun.',
            'open_transactions',
            422,
            ['transactions' => ['Terdapat transaksi non-terminal.']]
        );
    }

    public static function invalidPin(): self
    {
        return new self(
            'PIN transaksi tidak valid.',
            'invalid_pin',
            422,
            ['pin' => ['PIN transaksi tidak valid.']]
        );
    }

    public static function pinMismatch(): self
    {
        return new self(
            'Konfirmasi PIN tidak cocok.',
            'pin_mismatch',
            422,
            ['pin_confirmation' => ['PIN dan konfirmasi PIN harus sama.']]
        );
    }

    public static function alreadyPending(): self
    {
        return new self(
            'Penghapusan akun sudah diajukan sebelumnya.',
            'already_pending',
            422,
            ['deletion' => ['Akun sudah berstatus terjadwal dihapus.']]
        );
    }

    public static function notPending(): self
    {
        return new self(
            'Tidak ada pengajuan hapus akun yang aktif.',
            'not_pending',
            422,
            ['deletion' => ['Tidak ada pengajuan hapus akun.']]
        );
    }

    public static function pendingDeletionBlocksMoney(): self
    {
        return new self(
            'Akun sedang dalam masa tunggu penghapusan. Batalkan penghapusan di menu Akun sebelum melakukan transaksi.',
            'account_pending_deletion',
            403,
            ['account' => ['Transaksi diblokir selama masa tunggu penghapusan akun.']]
        );
    }

    public static function roleNotAllowed(): self
    {
        return new self(
            'Hanya akun pelanggan yang dapat mengajukan atau membatalkan hapus akun.',
            'role_not_allowed',
            403,
            ['role' => ['Endpoint ini hanya untuk pelanggan.']]
        );
    }

    public static function reasonRequired(): self
    {
        return new self(
            'Alasan penghapusan wajib diisi.',
            'reason_required',
            422,
            ['reason' => ['Alasan penghapusan wajib diisi.']]
        );
    }
}
