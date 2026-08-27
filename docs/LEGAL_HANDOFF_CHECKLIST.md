# Legal Handoff Checklist

**SRS:** Bagian 27, 28, 22  
**Sprint:** 18–19  
**Date:** 2026-08-28  
**Status:** PENDING — not legally binding

---

## Current system status (do not change without counsel)

| Document | Slug | `legal_review_status` | Public URL (SRS) | Binding? |
|----------|------|------------------------|------------------|----------|
| Privacy Policy | `privacy_policy` | `pending_legal_review` | https://gurkynet.my.id/legal/privacy-policy | **NO** |
| Terms & Conditions | `terms_conditions` | `pending_legal_review` | https://gurkynet.my.id/legal/terms-conditions | **NO** |
| Refund Policy | `refund_policy` | `pending_legal_review` | (legal center) | **NO** |

Binding requires `legal_review_status = approved_binding` set **only after** counsel sign-off. **Do not set in code or CMS without Owner + lawyer approval.**

---

## Handoff package for legal counsel

Provide to lawyer (no production changes):

- [ ] SRS Bagian 27–28 (Privacy, Terms, Refund themes)
- [ ] Current CMS draft content via Legal Center or `SrsLegalContent` output
- [ ] `policy_acceptances` schema — minimal consent fields (user_id, document_type, version, accepted_at)
- [ ] Registration flow — `accept_policies` required at `finalizeRegistration`
- [ ] SLA numbers in Terms (from `config/sla.php` — Bagian 23 literals)
- [ ] Tax scaffold note — PPN fields exist; **no calculation** until PKP decision
- [ ] Retention policy — `FinancialRetentionGuard` (10y financial, KYC rules)
- [ ] Sprint 18 explicit non-claims (not PKP final, not binding)

---

## Counsel review checklist

| # | Item | Counsel sign-off |
|---|------|------------------|
| 1 | Privacy Policy accuracy vs UU PDP practices | ☐ |
| 2 | Terms & Conditions enforceability | ☐ |
| 3 | Refund Policy vs operational refund flow (FR-DIFF-09) | ☐ |
| 4 | SLA disclosure in public Terms | ☐ |
| 5 | Consent mechanism adequacy (`policy_acceptances`) | ☐ |
| 6 | Cookie / tracking disclosure (if applicable) | ☐ |
| 7 | Material change notification process (7-day — deferred in Sprint 18) | ☐ |
| 8 | PKP / PPN wording if/when applicable | ☐ |

---

## Post-approval steps (Owner + counsel only)

1. Lawyer delivers approved text
2. Marketing/Ops updates Legal Center draft
3. Publish with `legal_review_status` → `approved_binding` (explicit Owner instruction)
4. Record version in `legal_document_versions`
5. Update `docs/OWNER_GO_LIVE_DECISIONS.md` item #8

**Until then:** banner "not legally binding pending lawyer review" remains accurate.

---

## Explicit non-claims

- ❌ Legal documents are binding today
- ❌ PKP status finalized
- ❌ PPN rate or calculation active
- ❌ Go-live authorized on legal basis alone
