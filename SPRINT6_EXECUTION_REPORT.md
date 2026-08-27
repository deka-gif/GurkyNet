# SPRINT 6 — EXECUTION REPORT

**Project:** GurkyNet PPOB  
**Sprint:** 6 — Customer Service (Live Chat, Tiket, Eskalasi, FAQ)  
**Source of truth:** SRS v2.2 CLEAN Bagian 4.4 / 6.3 / 7.8 / 13.5 + locked Sprint 6 decisions  
**Date:** 2026-08-27  
**Verdict:** **SPRINT 6 READY FOR VERIFICATION**

---

## 1. Scope terkunci

### Implemented (Wajib)
| ID | Status |
|----|--------|
| FR-CS-01 Live chat real-time (SSE primary) | DONE |
| FR-CS-02 Ticket/complaint management + SRS statuses | DONE |
| FR-CS-04 Transaction investigation read-only | DONE |
| FR-CS-06 Eskalasi Operations (Workflow SSOT) | DONE |
| FR-CS-07 Eskalasi Finance (Workflow SSOT) | DONE |
| FR-CS-08 Notifikasi balik ke CS | DONE |
| FR-USR05 Bantuan / komplain + bukti attachment | DONE |

### Out of scope (tidak dikerjakan)
FR-CS-03 (SLA), FR-CS-05 (saldo eksplisit), FR-CS-09 (FAQ CRUD), FR-DIFF, Sprint 7+, Finance/Ops rebuild, WebSocket/Reverb baru, redesign besar.

---

## 2. Locked decisions applied

### A. Real-time = SSE primary
- `RealtimeManager` memakai **fetch stream** ke `GET /api/v1/realtime/stream` (Authorization Bearer).
- Poll `GET /api/v1/realtime/poll` tetap sebagai **fallback** jika SSE gagal.
- Tidak menambah WebSocket/Reverb.

### B. CS tidak boleh mutate saldo (SRS 4.4.5)
- `PUT /admin/customer-support/refunds/{id}` dengan status approve/reject → **403**.
- Repository CS menolak path approve/reject yang mengubah wallet.
- CS tetap bisa **create / note / escalate** refund → Finance via Workflow.
- Finance approve path Sprint 3/4 **tetap** (idempotent).
- Sprint3 gap tests diperbarui: CS approve forbidden; Finance approve idempotent.

### C. Ticket status = SRS 7.8
Canonical: `open | assigned_cs | escalated_ops | escalated_finance | resolved | closed`  
Helper: `App\Support\Support\TicketStatus` (normalize + label + legacy map).  
Legacy `Terbuka`/`Pending`/`Selesai` tetap terbaca via compatibility mapping (tanpa destructive backfill).

### D. Escalation SSOT = Workflow
- Inbox escalate → `WorkflowEngineService::createFromCs`.
- Auto-convert chat→ticket bila belum ada ticket.
- Ticket status di-set `escalated_ops` / `escalated_finance`.
- Resolve workflow → notifikasi CS + ticket → `resolved`/`closed`.
- Legacy `support_escalations` tidak dihapus.

---

## 3. Implementation summary

### Live chat (FR-CS-01)
- User: Help Center / chat conversation + messages.
- CS: Inbox assign/reply/close/convert/escalate.
- SSE primary + poll fallback; channel auth existing.

### Ticketing (FR-CS-02 + FR-USR05)
- User complaints: create/list/show + attachment (jpg/png/pdf ≤4MB) + replies history + status labels.
- CS: queue, reply (`/reply`), status update + assignment, convert from chat.
- Lifecycle: open → assigned_cs → escalated_* → resolved → closed.

### Investigation (FR-CS-04)
- Existing investigation endpoints (read-only).
- Explicit tests: CS cannot approve refund / no wallet mutation.

### Escalation + notifikasi (FR-CS-06/07/08)
- Ops/Finance escalate via Workflow.
- `DivisionNotification` ke CS pada escalate/update/resolve.
- CS Dashboard menampilkan panel **Notifikasi Eskalasi**.

### RBAC
- CS routes: `customer_support,owner` + OwnerReadOnly.
- Non-CS mutation ditolak (403).
- User hanya melihat complaint miliknya.

---

## 4. Tests

### Baru
`tests/Feature/Sprint6CustomerSupportTest.php` — **7/7 PASS**

### Updated
- `Sprint3GapClosureTest` — CS approve forbidden; Finance approve idempotent
- `CustomerSupportTest::update_ticket_status` — expects `assigned_cs`

### Full suite
```
Tests: 1 failed, 620 passed (4479 assertions)
```

**1 fail pre-existing (bukan Sprint 6):**
- `FinanceTest::finance_user_can_list_settlements` — key `pagination`

Baseline Sprint 5: ~612 pass / 1 fail → Sprint 6: **620 pass / 1 fail**.

---

## 5. Findings / notes

1. FAQ CRUD (FR-CS-09) dan SLA (FR-CS-03) sengaja tidak diimplementasikan.
2. Attachment bukti resmi = **complaint upload**, bukan chat message attachment (sesuai keputusan scope).
3. Metode `approveRefund` lama di repository masih ada sebagai dead path internal; CS API tidak memanggilnya.
4. Parallel unused schema `tickets` (SRS 7.8 name) vs runtime `support_tickets` — sama pola Sprint 5; fungsional compliance via vocabulary helper.

---

## 6. Ready for user verification

Silakan audit/konfirmasi Sprint 6 sebelum Sprint 7.
