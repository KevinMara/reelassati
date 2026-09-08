# Fixed worldwide USD proposal — not applied

Date: 2026-09-08. User approval required before changing prices, currency defaults, currency options, or live Stripe configuration.

Current source: Creator 19 / Pro 59 / Studio 149 monthly, 190 / 590 / 1490 annually (10 monthly payments). Included monthly credits 1000 / 4000 / 12000. Top-ups 1000 at 9, 2000 at 17, 5000 at 39.

Model assumptions, not measured unit profitability:
- All prices in USD excluding customer tax; tax is neither revenue nor a cost in the denominator.
- ECB 2026-09-08: EUR 1 = USD 1.1614. https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
- Conservative delivery budget EUR 0.003/credit = USD 0.0034842/credit. This is a planning allowance, not an enforced provider-cost ceiling.
- Full consumption of included credits and connected accounts.
- Reference scale: 100 customers, 60 Creator / 30 Pro / 10 Studio, 420 connected accounts. Retain the previous pool estimate of USD 638/month ($1.519/account). Current exact negotiated Zernio charges are not verified. https://zernio.com/pricing
- Infrastructure allowance USD 45/month pooled across 100 subscribers. No duplicate infrastructure/social allocation to subscriber-only top-ups.
- Conservative international card assumption: Payments 3.15%, currency conversion 2%, Managed Payments 3.5%, Billing allowance 0.7% for subscriptions, fixed EUR 0.25 = USD 0.29035. The model conservatively charges all percentage fees on a tax-inclusive transaction with 22% customer tax. Actual fees depend on country/card/settlement and contract. No separate Tax fee on top of Managed Payments. https://stripe.com/it/pricing ; https://docs.stripe.com/payments/managed-payments
- Additional operating reserve: 3% of base price.
- Contribution excludes salaries, acquisition, accounting, income tax, and infrastructure/storage overages. Annual model includes 12 monthly allowances and service costs; one fixed payment fee.

{
  "fx": 1.1614,
  "packs": [
    {
      "costs": 4.99432,
      "credits": 1000,
      "left": 4.00568,
      "margin": 44.507555555555555,
      "price": 9
    },
    {
      "costs": 9.562759999999999,
      "credits": 2000,
      "left": 7.437240000000001,
      "margin": 43.7484705882353,
      "price": 17
    },
    {
      "costs": 22.99702,
      "credits": 5000,
      "left": 16.00298,
      "margin": 41.03328205128206,
      "price": 39
    }
  ],
  "rows": [
    {
      "ai": 3.4842,
      "annual": 190,
      "annualcost": 111.33119285714285,
      "annualleft": 78.66880714285715,
      "annualmargin": 41.40463533834587,
      "costs": 9.999975238095239,
      "credits": 1000,
      "fees": 2.4576800000000003,
      "infra": 0.45,
      "left": 9.000024761904761,
      "margin": 47.368551378446114,
      "monthly": 19,
      "name": "Creator",
      "social": 3.038095238095238
    },
    {
      "ai": 13.9368,
      "annual": 590,
      "annualcost": 367.30467857142855,
      "annualleft": 222.69532142857145,
      "annualmargin": 37.74496973365618,
      "costs": 32.29156571428572,
      "credits": 4000,
      "fees": 7.020480000000001,
      "infra": 0.45,
      "left": 26.708434285714283,
      "margin": 45.26853268765132,
      "monthly": 59,
      "name": "Pro",
      "social": 9.114285714285714
    },
    {
      "ai": 41.8104,
      "annual": 1490,
      "annualcost": 940.8223071428572,
      "annualleft": 549.1776928571428,
      "annualmargin": 36.857563279002875,
      "costs": 82.24575142857144,
      "credits": 12000,
      "fees": 17.28678,
      "infra": 0.45,
      "left": 66.75424857142856,
      "margin": 44.801509108341314,
      "monthly": 149,
      "name": "Studio",
      "social": 18.228571428571428
    }
  ]
}

Alternative top-ups to preserve a slightly higher contribution margin than monthly plans under the same model: 1000/$10 (~48.7%), 2000/$19 (~48.2%), 5000/$45 (~47.1%). Proposal only, no changes applied.

USD 19 = EUR 16.36 at the reference rate, before processor conversion charges. Switching EUR 19 to USD 19 reduces EUR-equivalent base revenue by 13.9%; identical numbers do not mean identical margins. Keeping provider usage per credit unchanged avoids silently weakening existing credit purchasing power.

