/**
 * Unit tests — Cek Wilayah Kartu FAQ title contract + answer parser.
 * Run: npx --yes tsx src/services/help.cekWilayah.test.ts
 *
 * Titles must stay byte-identical to laravel/app/Support/CekWilayahKartuFaq.php
 * (prefix uses U+2014 EM DASH).
 */
import assert from 'node:assert/strict';
import {
  CEK_WILAYAH_FAQ_PREFIX,
  cekWilayahFaqTitle,
  customerFacingFaqs,
  findCekWilayahFaq,
  isCekWilayahFaq,
  parseCekWilayahAnswer,
  type HelpFaqItem,
} from './help.cekWilayah';

assert.equal(CEK_WILAYAH_FAQ_PREFIX, 'Cek Wilayah Kartu — ');
assert.equal(CEK_WILAYAH_FAQ_PREFIX.codePointAt(CEK_WILAYAH_FAQ_PREFIX.length - 2), 0x2014);

const brands = [
  ['telkomsel', 'Telkomsel'],
  ['indosat', 'Indosat'],
  ['tri', 'Tri'],
  ['axis', 'Axis'],
  ['xl', 'XL'],
  ['smartfren', 'Smartfren'],
] as const;

for (const [, label] of brands) {
  assert.equal(cekWilayahFaqTitle(label), `Cek Wilayah Kartu — ${label}`);
}

const faqs: HelpFaqItem[] = brands.map(([, label], i) => ({
  id: i + 1,
  question: cekWilayahFaqTitle(label),
  answer: [
    '1. Buka aplikasi resmi.',
    '2. Masuk menu kuota.',
    '3. Lihat wilayah.',
    '',
    'Alternatif: cek kode dial di aplikasi resmi.',
  ].join('\n'),
}));

faqs.push({
  id: 99,
  question: 'Bagaimana cara top up?',
  answer: 'Buka Dompet lalu Top Up.',
});

for (const [slug] of brands) {
  const hit = findCekWilayahFaq(faqs, slug);
  assert.ok(hit, `missing FAQ for ${slug}`);
  assert.equal(
    hit!.question,
    cekWilayahFaqTitle(brands.find(([s]) => s === slug)![1])
  );
}

assert.equal(
  findCekWilayahFaq(
    [{ id: 1, question: 'Cek Wilayah Kartu - Telkomsel', answer: '1. x' }],
    'telkomsel'
  ),
  null
);
assert.equal(
  findCekWilayahFaq(
    [{ id: 1, question: 'Cek Wilayah Kartu — Telkomsel MyTS', answer: '1. x' }],
    'telkomsel'
  ),
  null
);

const facing = customerFacingFaqs(faqs);
assert.equal(facing.length, 1);
assert.equal(facing[0].question, 'Bagaimana cara top up?');
assert.ok(isCekWilayahFaq(faqs[0]));
assert.ok(!isCekWilayahFaq(faqs[faqs.length - 1]));

const parsed = parseCekWilayahAnswer(faqs[0].answer);
assert.deepEqual(parsed.steps, [
  'Buka aplikasi resmi.',
  'Masuk menu kuota.',
  'Lihat wilayah.',
]);
assert.equal(parsed.note, 'cek kode dial di aplikasi resmi.');

assert.deepEqual(parseCekWilayahAnswer(''), { steps: [], note: null });
assert.deepEqual(parseCekWilayahAnswer('hanya teks tanpa nomor'), {
  steps: [],
  note: 'hanya teks tanpa nomor',
});
assert.equal(findCekWilayahFaq([], 'telkomsel'), null);

console.log('help.cekWilayah.test.ts: ALL PASS');
