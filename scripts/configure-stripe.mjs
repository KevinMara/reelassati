import Stripe from "stripe";
import { build } from "esbuild";
import { open } from "node:fs/promises";
import { resolve } from "node:path";

// Read the same catalog used by the app without maintaining a second price list.
const bundle = await build({
  entryPoints: ["contracts/billing.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { PLAN_IDS, PLAN_NAME_BY_ID, CREDIT_TOP_UPS, planEntitlements } =
  await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
const apiVersion = "2026-08-26.dahlia";
const webhookUrl =
  "https://reelassati.kevinbiz.chatgpt.site/api/billing/stripe-webhook";
const catalog = [
  ...PLAN_IDS.flatMap(id =>
    ["monthly", "annual"].map(cycle => ({
      product: id,
      name: `REELassati ${PLAN_NAME_BY_ID[id]}`,
      key: `${id}_${cycle}`,
      cents:
        planEntitlements(id)[
          cycle === "monthly" ? "monthlyPrice" : "annualTotal"
        ] * 100,
      credits: planEntitlements(id).monthlyCredits,
      interval: cycle === "monthly" ? "month" : "year",
      cycle,
    }))
  ),
  ...Object.values(CREDIT_TOP_UPS).map(pack => ({
    product: pack.id,
    name: `${pack.credits.toLocaleString("en-US")} REELassati credits`,
    key: pack.id,
    cents: pack.price * 100,
    credits: pack.credits,
    interval: null,
  })),
];

class SetupError extends Error {}

if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify(
      {
        mode: "plan",
        currency: "eur",
        taxBehavior: "inclusive",
        catalog,
        webhookUrl,
        note: "No Stripe changes made. To provision, supply STRIPE_SECRET_KEY and STRIPE_ACCOUNT_ID, then --apply --out <private.env.local>. Tax registrations and account onboarding are never created by this script.",
      },
      null,
      2
    )
  );
} else {
  try {
    await configure();
  } catch (cause) {
    // Never dump SDK error objects, request bodies, or secrets.
    console.error(
      cause instanceof SetupError
        ? cause.message
        : "Stripe setup stopped. Check the account permissions and Stripe request logs; any saved progress is retained."
    );
    process.exitCode = 1;
  }
}

async function configure() {
  const key = process.env.STRIPE_SECRET_KEY;
  const expectedAccount = process.env.STRIPE_ACCOUNT_ID;
  const out = process.argv[process.argv.indexOf("--out") + 1];
  if (
    !/^(?:rk|sk)_(?:live|test)_[A-Za-z0-9]+$/.test(key || "") ||
    !/^acct_[A-Za-z0-9]+$/.test(expectedAccount || "")
  )
    throw new SetupError(
      "Set a restricted server key and the expected STRIPE_ACCOUNT_ID first."
    );
  if (!process.argv.includes("--out") || !out?.endsWith(".env.local"))
    throw new SetupError(
      "Supply --out with a new private .env.local file to receive the webhook secret."
    );
  const stripe = new Stripe(key, {
    apiVersion,
    maxNetworkRetries: 2,
    timeout: 15000,
  });
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== expectedAccount)
    throw new SetupError(
      "The API key belongs to a different Stripe account. No changes made."
    );
  const [products, prices, portals, webhooks] = await Promise.all([
    stripe.products.list({ limit: 100 }).autoPagingToArray({ limit: 1000 }),
    stripe.prices.list({ limit: 100 }).autoPagingToArray({ limit: 1000 }),
    stripe.billingPortal.configurations
      .list({ limit: 100 })
      .autoPagingToArray({ limit: 1000 }),
    stripe.webhookEndpoints
      .list({ limit: 100 })
      .autoPagingToArray({ limit: 1000 }),
  ]);
  const existingWebhook = webhooks.find(w => w.url === webhookUrl);
  if (existingWebhook && !process.env.STRIPE_WEBHOOK_SECRET)
    throw new SetupError(
      "This webhook already exists. Supply its original STRIPE_WEBHOOK_SECRET before continuing; an existing signing secret cannot be retrieved."
    );
  if (existingWebhook && existingWebhook.api_version !== apiVersion)
    throw new SetupError(
      "The existing webhook API version differs. Review it in Stripe before changing a live endpoint."
    );
  const file = await open(resolve(out), "wx", 0o600);
  const configuration = {
    plans: { creator: {}, pro: {}, studio: {} },
    topUps: {},
  };
  const settings = {
    STRIPE_ACCOUNT_ID: account.id,
    PUBLIC_APP_URL: "https://reelassati.app",
    STRIPE_TAX_MODE: "automatic",
  };
  const checkpoint = async () => {
    const text =
      Object.entries({
        ...settings,
        STRIPE_PRICE_IDS_JSON: JSON.stringify(configuration),
      })
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n";
    await file.write(text, 0, "utf8");
    await file.truncate(Buffer.byteLength(text));
    await file.sync();
  };
  try {
    await checkpoint();
    const productIds = new Map();
    for (const entry of catalog) {
      let product = products.find(
        p =>
          p.metadata.app === "reelassati" &&
          p.metadata.catalog_id === entry.product
      );
      if (!product) {
        product = await stripe.products.create(
          {
            name: entry.name,
            metadata: { app: "reelassati", catalog_id: entry.product },
          },
          { idempotencyKey: `reelassati-product:${entry.product}` }
        );
        products.push(product);
      }
      if (!product.active)
        throw new SetupError(
          `Catalog product ${entry.product} is archived. Review it before creating prices.`
        );
      productIds.set(entry.product, product.id);
      const lookupKey = `reelassati_${entry.key}_eur_${entry.cents}_v3`;
      let price = prices.find(p => p.lookup_key === lookupKey);
      if (!price)
        price = await stripe.prices.create(
          {
            product: product.id,
            currency: "eur",
            unit_amount: entry.cents,
            tax_behavior: "inclusive",
            lookup_key: lookupKey,
            ...(entry.interval
              ? { recurring: { interval: entry.interval } }
              : {}),
            metadata: {
              app: "reelassati",
              catalog_id: entry.key,
              credits: String(entry.credits),
            },
          },
          { idempotencyKey: `reelassati-price:${lookupKey}` }
        );
      if (
        !price.active ||
        price.product !== product.id ||
        price.currency !== "eur" ||
        price.unit_amount !== entry.cents ||
        price.tax_behavior !== "inclusive" ||
        (price.recurring?.interval || null) !== entry.interval
      )
        throw new SetupError(
          `Existing price ${entry.key} differs from the approved catalog. No replacement made.`
        );
      if (entry.cycle)
        configuration.plans[entry.product][entry.cycle] = price.id;
      else configuration.topUps[entry.product] = price.id;
      await checkpoint();
    }
    const portalParams = {
      business_profile: { headline: "Manage your REELassati plan and billing" },
      default_return_url: "https://reelassati.app/#/dashboard/billing",
      metadata: { app: "reelassati", catalog_version: "3" },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ["name", "address", "tax_id"],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "always_invoice",
          products: PLAN_IDS.map(id => ({
            product: productIds.get(id),
            prices: Object.values(configuration.plans[id]),
          })),
          schedule_at_period_end: {
            conditions: [
              { type: "decreasing_item_amount" },
              { type: "shortening_interval" },
            ],
          },
        },
      },
    };
    const existingPortal = portals.find(p => p.metadata?.app === "reelassati");
    const portal = existingPortal
      ? await stripe.billingPortal.configurations.update(existingPortal.id, {
          ...portalParams,
          active: true,
        })
      : await stripe.billingPortal.configurations.create(portalParams, {
          idempotencyKey: "reelassati-portal:v3",
        });
    settings.STRIPE_PORTAL_CONFIGURATION_ID = portal.id;
    await checkpoint();
    const enabledEvents = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.updated",
      "charge.dispute.closed",
    ];
    if (existingWebhook) {
      await stripe.webhookEndpoints.update(existingWebhook.id, {
        enabled_events: enabledEvents,
        disabled: false,
      });
      settings.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      const webhook = await stripe.webhookEndpoints.create(
        {
          url: webhookUrl,
          api_version: apiVersion,
          enabled_events: enabledEvents,
          metadata: { app: "reelassati" },
        },
        { idempotencyKey: "reelassati-webhook:v3" }
      );
      if (!webhook.secret)
        throw new SetupError(
          "Stripe did not return the webhook secret. Review the endpoint before retrying."
        );
      settings.STRIPE_WEBHOOK_SECRET = webhook.secret;
    }
    await checkpoint();
    const registrations = await stripe.tax.registrations.list({
      status: "active",
      limit: 1,
    });
    console.log(
      JSON.stringify({
        account: account.id,
        catalogReady: true,
        chargesEnabled: account.charges_enabled,
        activeTaxRegistration: registrations.data.length > 0,
        configurationSaved: true,
        next: "Install the saved settings and a restricted runtime API key in the backend secret environment. Finish Stripe onboarding and verify tax setup before a real purchase.",
      })
    );
  } finally {
    await file.close();
  }
}
