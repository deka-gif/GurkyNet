<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Models\Faq;
use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Support\CekWilayahKartuFaq;
use Illuminate\Validation\ValidationException;

class KnowledgeBaseAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(): array
    {
        return $this->customerSupportRepository->getKnowledgeBase();
    }

    public function show(string|int $id): ?array
    {
        return $this->customerSupportRepository->getKnowledgeBaseArticle($id);
    }

    /**
     * CS-editable FAQ article (used for Cek Wilayah Kartu + other FAQ rows).
     *
     * @param  array{answer: string, question?: string}  $data
     */
    public function updateFaq(int $id, array $data): array
    {
        $faq = Faq::query()->find($id);
        if (! $faq) {
            throw ValidationException::withMessages([
                'id' => ['Artikel FAQ tidak ditemukan.'],
            ]);
        }

        $payload = [
            'answer' => trim((string) $data['answer']),
        ];
        if (array_key_exists('question', $data) && is_string($data['question'])) {
            $nextQuestion = trim($data['question']);
            // Mobile matches exact titles ("Cek Wilayah Kartu — {Brand}") — keep immutable.
            if (CekWilayahKartuFaq::isCekWilayahQuestion((string) $faq->question)
                && $nextQuestion !== (string) $faq->question) {
                throw ValidationException::withMessages([
                    'question' => ['Judul artikel Cek Wilayah Kartu tidak boleh diubah (kontrak Mobile).'],
                ]);
            }
            $payload['question'] = $nextQuestion;
        }

        $faq->update($payload);
        $fresh = $faq->fresh();

        return [
            'id' => $fresh->id,
            'title' => $fresh->question,
            'question' => $fresh->question,
            'content' => $fresh->answer,
            'answer' => $fresh->answer,
            'category' => CekWilayahKartuFaq::isCekWilayahQuestion((string) $fresh->question)
                ? 'Voucher Internet'
                : 'FAQ',
            'type' => 'faq',
            'updated_at' => optional($fresh->updated_at)?->toIso8601String(),
        ];
    }
}
