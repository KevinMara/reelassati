# Stripe readiness and top-up value — 6 September 2026

Owner-authorized continuation of the connected-platform release. The existing
public audience and standing production-push instruction remain unchanged.
This change does not modify AI models, marking, publication approval, or the
operator compliance policy. No legal certification is asserted.

## Customer changes

- Subscriber-only packs are 1,000 credits for €9, 2,000 for €17 and 5,000 for
  €39. Each unit price is below every plan, including annual Studio. Larger
  packs have progressively lower unit prices. Plan prices and allowances stay
  €19/€59/€149 and 1,000/4,000/12,000 credits, with ten payments annually.
- Public pricing, account pricing, Stripe catalog provisioning and checkout
  all consume the same catalog. Pack examples cover actual video tariffs.
- Checkout confirmation requires an owned Stripe session and a corresponding
  settled ledger entry or active subscription. The return URL cannot grant
  credits or assert payment success. Status polling is bounded.
- Subscription management remains available when readiness for new purchases
  fails, including tax or catalog validation failures.

## Billing implementation

- Stripe SDK 22.6.1 and API 2026-08-26.dahlia; Fetch transport, bounded timeouts
  and retries, restricted-key support, and structured Checkout/Portal requests.
- Before checkout, check account identity/payment acceptance, all nine EUR
  inclusive prices and intervals, portal capabilities, tax settings and an
  active registration. Readiness is cached for one minute to avoid repeated
  configuration scans. Details are visible only to the operator.
- Durable checkout attempts and atomic leases prevent concurrent duplicate
  sessions, resume previous attempts, and recover a provider response that
  was not persisted. Existing remote subscriptions are checked before sale.
- New top-ups retain their 1,000/2,000/5,000 quantities in signed metadata;
  legacy versions retain historical purchase quantities. No existing balance
  or subscription has been rewritten.
- Migration 0015 adds only the checkout coordination table.
- The provisioning script defaults to a non-mutating plan. An explicit apply
  reuses owned products/prices, sets up a portal and webhook, and checkpoints
  its output to an exclusive 0600 file. It never creates a tax registration,
  supplies identity information, accepts terms, or charges a customer.

## Evidence and limits

- Full suite: 144 passing tests. Focused Stripe/SQLite tests exercise restricted
  keys, catalog/tax/onboarding failures, exact server prices, concurrent
  purchases, recovery, ownership, webhook credit settlement and repeat top-ups.
- TypeScript and ESLint pass. Production build and deployment status are
  recorded separately in the hosting publication record.
- Studio-only providers and entry animation load lazily. The entry JavaScript
  bundle fell from approximately 209 KB to 166 KB gzipped. This measures the
  entry bundle, not total page transfers or a page-load speed benchmark.
- The connected live Stripe account was verified as reelassati@gmail.com,
  account acct_1UCFQXRq0djyYmwU. Charges and payouts are disabled; onboarding
  details, bank details and terms remain due. No products, portal, webhooks or
  active tax registrations were present. The connector exposed GET operations
  only for those resources. No Stripe write, charge or tax change was made.
- The backend's expected account ID and application return origin were set.
  No runtime API key, webhook signing secret or price IDs were supplied. Live
  checkout remains disabled. The script's catalog-only plan was executed;
  live provisioning and a real purchase were not represented as tested.
- The prior release's Zernio activation, provider funding, email, commercial
  hosting, team collaboration and operator data-deletion work remain distinct
  from verified payment-code behavior. No complete commercial launch is claimed.

References: Stripe API versioning, restricted keys, Checkout Sessions, Prices,
Customer Portal configurations and Webhook Endpoints in official Stripe docs.
Rollback baseline: e74e1c9 (existing Site version 66). The new table is additive.
