# Stranerd Launch, Authentication, Credits, Payments, and Landing Page Plan

Last updated: 6 August 2026

## Purpose

This document is the authoritative implementation handoff for taking Stranerd from the current anatomy demo to a public, authenticated, paid product. It defines the approved commercial model, landing-page direction, Google-only authentication, Supabase data architecture, server-enforced AI credits, Spotflow NGN billing, security requirements, rollout phases, and the exact first task after conversation compaction.

Do not copy secrets into this document, source code, commits, browser bundles, logs, or chat messages. Local Supabase and Spotflow setup values are stored in the ignored `Details.md` file. Google OAuth credentials will be supplied later.

## Approved Product Model

### Free Account

- Google sign-in only.
- Twenty one-time signup credits.
- Signup credits are granted once per Supabase user ID.
- Full access to anatomy models, model variants, deterministic quizzes, Activities, Dissect Mode, notes, and non-AI educational content.
- Authentication is optional for browsing but required for AI, billing, credit ownership, and cloud-backed progress.

### Stranerd Plus

- One subscription tier.
- Price: `NGN 2,500` per month.
- Allocation: 500 subscription credits after every successful billing cycle.
- Subscription credits are replaced at renewal rather than accumulated indefinitely.
- Purchased PAYG credits remain separate and are never removed at renewal.
- Cancellation preserves paid access until the current billing period ends.
- Failed or cancelled renewals grant no credits.

### PAYG Credit Pack

- Price: `NGN 500`.
- Allocation: 100 purchased credits.
- Purchased credits do not expire.
- Packs may be purchased repeatedly.
- Purchased credits are consumed only after free and subscription credits.

### Credit Spending Order

```text
1. Free signup credits
2. Current subscription credits
3. Purchased PAYG credits
```

### Initial AI Pricing

- AI Mentor response: 1 credit.
- New AI-generated 20-question quiz: 1 credit.
- Future AI-generated explanations or assessments: default 1 credit unless actual cost justifies another price.
- Failed, timed-out, or invalid AI responses: 0 net credits.
- Authored fallbacks and deterministic features: 0 credits.

Do not charge credits for selecting structures, opening models, using Dissect Mode, moving anatomy, completing authored activities, taking the existing deterministic quiz set, writing notes, or viewing educational text.

## Required AI UX Change

The current app automatically asks Azure OpenAI after some structure selections and dissection actions. This must not consume user credits implicitly.

Before monetization:

1. Structure selection displays authored educational context for free.
2. AI calls require an explicit action labeled with cost, such as `Ask AI Mentor · 1 credit`.
3. The client displays available balance before confirmation.
4. The server authenticates the user and performs the actual debit.
5. The client never decides whether a request is affordable.
6. A failed AI operation releases or refunds the reserved credit.

## Public Application Structure

```text
/                     Marketing landing page
/pricing              Subscription and PAYG pricing
/login                Google sign-in
/app                  Anatomy learning application
/account              Profile, balance, usage, subscription, purchases
/billing/success      Post-checkout status and reconciliation
/billing/cancelled    Cancelled checkout guidance
/legal/privacy        Privacy policy
/legal/terms          Terms of service
/legal/refunds        Refund and cancellation policy
```

Use explicit pathname routing. The marketing shell and authenticated application shell should be separate. Visitors may enter `/app` in guest mode, but AI and billing actions prompt Google sign-in.

## Landing Page Direction

Use General Learning as the stronger editorial reference and Alice as the product-led conversion reference. Do not copy layouts, text, artwork, or branding.

### General Learning Patterns

- Large thesis-led typography.
- Confident editorial pacing.
- Narrative sections with strong transitions.
- Restrained, purposeful motion.
- Evidence and outcomes rather than generic feature claims.

### Alice Patterns

- Immediate product demonstration.
- Clear benefit statements.
- Repeated conversion actions.
- Feature storytelling with real interfaces.
- Pricing and FAQ clarity.
- Student-focused language.

### Stranerd Visual Identity

- Dark anatomical laboratory aesthetic.
- Cobalt blue and magenta accents.
- Scientific grid, precise labels, and strong typography.
- Real Stranerd model and activity captures, not generic stock illustrations.
- A live or pre-rendered 3D anatomy hero.
- Motion built around anatomy layers, selection, labels, and dissection.
- Responsive design and `prefers-reduced-motion` support.
- Use flat black surfaces in dark mode and white/off-white surfaces in light mode across marketing and application shells.
- Do not use gradients. Use borders, spacing, typography, restrained accent color, and subtle solid tonal changes for hierarchy.
- The anatomy canvas must be black in dark mode and white in light mode.

### Landing Page Sections

1. Navigation with `Sign in` and `Start learning`.
2. Interactive anatomy hero with a concise product thesis.
3. Student outcome and product-value strip.
4. Anatomy exploration demonstration.
5. Dissect Mode demonstration.
6. AI Mentor demonstration with visible credit transparency.
7. Guided Activities and adaptive quiz demonstration.
8. A narrative explaining how Stranerd improves active learning.
9. Testimonials or launch-user proof when available.
10. Pricing with Free, Plus, and PAYG pack.
11. FAQ.
12. Final CTA.
13. Legal and support footer.

Do not fabricate metrics or testimonials. Use product demonstrations and clearly labeled launch statements until real evidence is available.

## Engineering Removal

Remove Engineering from the public product for this launch.

Remove it from:

- Desktop navigation.
- Mobile navigation.
- Model catalog and search.
- Activities.
- Quizzes and progress totals.
- Landing-page copy.
- Empty-state and help text.

The engineering source files and GLBs may remain temporarily if deleting them creates unnecessary migration risk, but they must be unreachable and must not download in the anatomy product.

## Authentication Architecture

### Provider

- Supabase Auth.
- Google OAuth only.
- No password, magic-link, or anonymous-user account system for the first launch.

### Google OAuth Setup

Google Cloud configuration will require:

- OAuth consent-screen product name.
- Stranerd logo.
- Privacy-policy URL.
- Terms URL.
- Web OAuth Client ID.
- Web OAuth Client Secret.
- Scopes: `openid`, email, and profile only.

Expected origins:

```text
http://localhost:5173
https://stranerd.vercel.app
https://learn.stranerd.com
```

Expected Google redirect URI:

```text
https://<supabase-project-ref>.supabase.co/auth/v1/callback
```

Expected Supabase redirect allow list:

```text
http://localhost:5173/auth/callback
https://stranerd.vercel.app/auth/callback
https://learn.stranerd.com/auth/callback
```

### Session Model

- Browser uses the Supabase publishable key only.
- API calls send the Supabase access token.
- Vercel API handlers validate the token server-side.
- Service-role/secret keys remain server-only.
- User-owned rows use Row Level Security.

## Supabase Data Model

### `profiles`

```text
id uuid primary key references auth.users
email text
display_name text
avatar_url text
created_at timestamptz
updated_at timestamptz
```

### `credit_wallets`

```text
user_id uuid primary key
free_balance integer
subscription_balance integer
purchased_balance integer
subscription_period_key text nullable
updated_at timestamptz
```

This table is a transactionally maintained balance cache. The immutable ledger remains the audit source of truth.

### `credit_transactions`

```text
id uuid primary key
user_id uuid
amount integer
bucket free | subscription | purchased
type grant | reserve | spend | refund | expire | adjustment
feature signup | mentor | ai_quiz | subscription | payg | admin
reference text nullable
idempotency_key text unique
metadata jsonb
created_at timestamptz
```

### `credit_reservations`

```text
id uuid primary key
user_id uuid
feature text
amount integer
status reserved | spent | refunded | expired
request_id text unique
expires_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `subscriptions`

```text
id uuid primary key
user_id uuid
provider text default spotflow
provider_subscription_id text unique
provider_plan_id text
status pending | active | past_due | cancelled | completed
current_period_start timestamptz nullable
current_period_end timestamptz nullable
cancel_at_period_end boolean
metadata jsonb
created_at timestamptz
updated_at timestamptz
```

### `payment_intents`

```text
id uuid primary key
user_id uuid
provider_reference text unique
product_type subscription | payg_100
amount_minor bigint
currency text
credits integer
status pending | successful | failed | cancelled | refunded
checkout_url text nullable
provider_payment_id text nullable
metadata jsonb
created_at timestamptz
updated_at timestamptz
```

### `webhook_events`

```text
provider text
event_id text
event_type text
payload jsonb
status received | processed | ignored | failed
error text nullable
received_at timestamptz
processed_at timestamptz nullable
primary key (provider, event_id)
```

### `ai_usage`

```text
id uuid primary key
user_id uuid
feature mentor | ai_quiz
request_id text unique
reservation_id uuid
provider text
model text nullable
status requested | successful | failed
metadata jsonb
created_at timestamptz
completed_at timestamptz nullable
```

## Database Functions and Triggers

Implement server-controlled Postgres functions:

### New User Provisioning

On first Supabase user creation:

1. Insert `profiles` row.
2. Insert `credit_wallets` row.
3. Insert one `+20` free-credit ledger transaction.
4. Update wallet free balance to 20.
5. Use stable idempotency key `signup:<user-id>`.

### Reserve Credits

An atomic transaction must:

1. Lock the wallet row.
2. Confirm sufficient combined balance.
3. Reserve from free, then subscription, then purchased balance.
4. Record the bucket breakdown.
5. Create one reservation with unique request ID.
6. Prevent simultaneous requests from overspending.

### Finalize Spend

- Convert reservation to spent.
- Add final ledger records.
- Be idempotent for repeated completion calls.

### Refund Reservation

- Return exact reserved amounts to their source buckets.
- Mark reservation refunded.
- Be idempotent.

### Subscription Allocation

On a successful initial payment or renewal:

1. Set subscription balance to 500 for the new period.
2. Record expiry/replacement of any old subscription balance.
3. Preserve free and purchased balances.
4. Use Spotflow event/reference as the idempotency key.

### PAYG Allocation

On verified successful payment:

1. Add 100 to purchased balance.
2. Add immutable ledger transaction.
3. Use provider payment reference as idempotency key.

## Row Level Security

- Users may read their own profile, wallet, transaction history, subscriptions, payment intents, and usage.
- Users must not directly insert or update balances, transactions, subscriptions, payment statuses, webhook events, or AI usage records.
- Server-only functions use service credentials and explicit authorization checks.
- Public/anonymous access receives no wallet data.
- Administrative adjustment functions must not be callable by normal users.

## AI Request Architecture

Protected endpoints:

```text
POST /api/mentor
POST /api/quiz
```

Request flow:

```text
Validate Supabase access token
→ Generate unique request ID
→ Reserve one credit atomically
→ Call Azure OpenAI
→ Validate response
→ Finalize credit on success
→ Refund reservation on failure or timeout
→ Return response and current balances
```

Important rules:

- Do not trust user IDs, balances, costs, or feature names from the browser.
- Endpoint code defines the feature cost.
- Rate-limit per user and per IP.
- A repeated request ID must not be charged twice.
- Invalid quiz JSON counts as failure and refunds the reservation.
- Authored fallback text is free and clearly distinguished from a successful AI call.
- Pending reservations should expire and be recoverable by a scheduled cleanup process.

## Spotflow Integration

### API

Production API base documented by Spotflow:

```text
https://api.spotflow.co/api/v1
```

Use hosted Redirect Checkout through:

```text
POST /payments/initialize
```

The Spotflow secret key must be server-only in Vercel.

### Monthly Plan

Create one Spotflow plan:

```text
title: Stranerd Plus
frequency: MONTHLY
currency: NGN
price: NGN 2,500
internal reference: STRANERD-PLUS-NGN-MONTHLY
```

The checkout initialization includes the plan ID. Including `planId` changes the payment into a subscription according to Spotflow documentation.

### PAYG Checkout

Initialize a normal one-time payment without `planId`:

```text
product: 100 Stranerd Credits
currency: NGN
price: NGN 500
credits: 100
```

### Amount Validation Blocker

Spotflow payment initialization documentation describes one-time amounts as currency subunits, while plan examples describe ordinary currency amounts. Before writing live prices, verify in Spotflow test mode whether:

```text
NGN 500 is sent as 500 or 50000
NGN 2,500 is sent as 2500 or 250000
```

Do not infer this in production.

### Checkout Creation

Server endpoint:

```text
POST /api/billing/checkout
```

The authenticated server:

1. Validates product ID against a server-owned catalog.
2. Creates a local `payment_intents` row and unique reference.
3. Sends Spotflow amount/plan, NGN currency, email, callback URL, and metadata.
4. Stores the returned checkout URL and provider data.
5. Returns only the hosted checkout URL to the browser.

Required metadata should include non-secret identifiers:

```text
productName: Stranerd
productType: subscription | payg_100
paymentIntentId: local UUID
userId: Supabase UUID
```

### Webhook Endpoint

```text
POST /api/webhooks/spotflow
```

Spotflow uses the Standard Webhooks pattern and sends:

- `webhook-id` for idempotency.
- `x-spotflow-signature` containing an HMAC SHA-256 signature.

Implementation requirements:

1. Read the raw request body before JSON parsing.
2. Verify signature and timestamp using the configured webhook secret.
3. Insert `webhook_events` row using `webhook-id` as part of the primary key.
4. Return success for already processed duplicate events.
5. Never assume event delivery order.
6. Match references against local payment intents and expected products.
7. Optionally verify payment status through Spotflow’s verify/fetch endpoint before granting value.
8. Award credits only from verified server-to-server processing.

### Spotflow Events

Handle at minimum:

- `payment_successful`
- `payment_failed`
- `subscription_successful`
- `subscription_cancelled`
- `subscription_payment_failed`
- `subscription_failed`
- `subscription_completed`

Initial subscription checkout may include both payment and subscription information. Processing must ensure the first successful cycle grants 500 credits only once.

### Billing Return Pages

The browser redirect is informational only.

On `/billing/success`:

1. Show `Confirming payment`.
2. Poll the authenticated billing-status endpoint.
3. Display success only after the local webhook-processed payment becomes successful.
4. Never grant credits from query parameters or redirect data.

### Cancellation

Use Spotflow’s cancellation endpoint through a protected server route. Confirm whether Spotflow cancellation is immediate or end-of-period during test integration. Stranerd should represent end-of-period access unless provider behavior requires otherwise.

## Account and Billing UI

Account page should show:

- Google name, email, and avatar.
- Total balance.
- Free, subscription, and purchased balance breakdown.
- Current plan and renewal date.
- Subscribe button when free.
- Buy 100 credits button.
- Cancel subscription action.
- Recent credit transactions.
- Recent AI usage.
- Sign out.
- Account deletion request.

Always show credit cost before an AI action.

## Analytics

Vercel Analytics is installed. Add explicit funnel events after consent requirements are reviewed:

- Landing CTA clicked.
- Google sign-in started/completed.
- Pricing viewed.
- Subscription checkout started.
- PAYG checkout started.
- Checkout confirmed.
- First AI request.
- Credit depleted.
- Activity completed.

Do not send sensitive anatomy queries, email addresses, payment identifiers, or raw AI prompts to analytics.

## Legal and Operational Requirements

Before live billing:

- Privacy policy.
- Terms of service.
- Refund policy.
- Subscription renewal and cancellation disclosure.
- AI limitations disclosure.
- Educational/not-medical-advice disclaimer.
- Support email and response expectations.
- Spotflow KYB and live-mode approval.
- Google OAuth production consent screen.
- Custom domain strongly preferred before final OAuth verification.

## Security Rules

- Ignore `Details.md`, `.env*`, `.vercel/`, and all secret files in Git.
- Never expose Supabase secret/service key to Vite variables.
- Only variables prefixed with `VITE_` may be considered browser-public.
- Spotflow secret and webhook secret are server-only.
- Validate every checkout product against a hard-coded or database-controlled server catalog.
- Use database transactions and unique idempotency constraints.
- Use raw-body webhook signature verification.
- Add API request size limits and rate limits.
- Log references and statuses, not secrets or full payment payloads containing unnecessary personal data.

## Environment Variables

### Browser-Public

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

### Server-Only

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
SPOTFLOW_SECRET_KEY
SPOTFLOW_WEBHOOK_SECRET
SPOTFLOW_PLUS_PLAN_ID
SPOTFLOW_MODE
APP_BASE_URL
```

Existing Azure/OpenAI variables remain server-only.

Do not add these values to the plan or commit them.

## Implementation Phases

### Phase 1: Product and Route Foundation

- Remove Engineering from all public UI and data flows.
- Add client pathname routing.
- Add marketing, app, login, pricing, account, billing-return, and legal shells.
- Preserve existing query-based model opening where useful.
- Keep the current anatomy app functional while routes change.

### Phase 2: Supabase Foundation

- Install Supabase client and CLI.
- Run `supabase init`.
- Link the existing Supabase project using its project reference.
- Create migrations for all auth, wallet, ledger, payment, subscription, webhook, and usage tables.
- Add RLS policies.
- Add signup trigger and 20-credit allocation.
- Add atomic reserve/finalize/refund functions.
- Push migrations to the linked Supabase project after review.

### Phase 3: Google Authentication

- Configure Google provider after credentials are supplied.
- Add Google sign-in and sign-out.
- Add auth callback/session restoration.
- Add guest-to-auth return path.
- Add protected account and billing actions.
- Verify production and localhost redirect flows.

### Phase 4: Credit-Protected AI

- Replace implicit AI calls with explicit credit-cost actions.
- Add authenticated API helper.
- Protect Mentor and AI quiz endpoints.
- Add reservation/finalization/refund flow.
- Return updated balance with every AI result.
- Add insufficient-credit UX linking to pricing/PAYG.
- Add usage and concurrency tests.

### Phase 5: Spotflow Test Integration

- Confirm amount units in test mode.
- Create the test monthly NGN plan.
- Add server product catalog.
- Implement subscription and PAYG checkout initialization.
- Implement signed webhook handler and idempotency.
- Implement status polling and cancellation.
- Simulate success, failure, duplicate, renewal, cancellation, and out-of-order events.

### Phase 6: Landing Page

- Build the editorial/product-led landing page.
- Add responsive navigation and CTA flow.
- Add real Stranerd product demonstrations.
- Add pricing, FAQ, and legal links.
- Add restrained animations and reduced-motion support.
- Add conversion analytics.

### Phase 7: Launch Hardening

- Add custom domain.
- Complete Google branding and verification if required.
- Complete Spotflow KYB/live approval.
- Create live subscription plan.
- Add production secrets directly to Vercel.
- Run payment reconciliation tests.
- Test RLS and concurrent spending.
- Test desktop, mobile, keyboard, reduced motion, and accessibility.
- Review legal text.
- Enable live Spotflow mode.

## Required Tests Before Launch

### Authentication

- New Google user is provisioned once.
- Returning Google user receives no second signup bonus.
- Signed-out users cannot access wallet data.
- Users cannot read another user’s records.

### Credits

- Signup grants exactly 20 free credits.
- Spending order is free, subscription, purchased.
- Two simultaneous requests cannot overspend.
- Successful AI call costs exactly one credit.
- Failed AI call restores exactly one credit.
- Duplicate request ID cannot duplicate a charge.
- Expired reservation is recoverable.

### Subscription

- First successful subscription payment grants exactly 500 credits.
- Renewal replaces subscription balance with 500 exactly once.
- Duplicate renewal webhook grants nothing extra.
- Failed renewal grants no credits.
- Cancellation preserves PAYG credits.
- Subscription event processing is safe out of order.

### PAYG

- Successful `NGN 500` pack grants exactly 100 purchased credits.
- Failed payment grants nothing.
- Redirect without webhook grants nothing.
- Duplicate webhook grants nothing extra.
- Wrong amount, currency, product, reference, or user mapping is rejected.

### Webhooks

- Invalid signature is rejected.
- Missing event ID is rejected.
- Raw-body verification works in Vercel.
- Duplicate event returns safely.
- Processing failures are recorded and retryable.

## Inputs Available and Pending

### Available Locally

- Supabase setup details in ignored `Details.md`.
- Spotflow setup details in ignored `Details.md`.
- Existing Vercel project and Azure OpenAI integration.

Do not commit or reproduce those values.

### Still Needed

- Google OAuth Web Client ID.
- Google OAuth Web Client Secret.
- Custom domain: `https://learn.stranerd.com`.
- Privacy-policy and terms URLs for Google consent configuration.
- Confirmation that Spotflow KYB/live access is approved.
- Confirmation of the checkout-facing product/business name.
- Confirmation of Spotflow NGN amount units from test transactions.

## Immediate First Task After Compaction

Begin Phase 1 and Phase 2 foundation work in this order:

1. Read this plan and `Details.md` locally; never print or copy secret values into conversation output.
2. Remove Engineering from navigation, catalogs, activities, quizzes, and progress calculations while leaving unrelated assets untouched.
3. Add pathname routing and separate `/`, `/app`, `/pricing`, `/login`, `/account`, billing-return, and legal page shells.
4. Install the Supabase JavaScript client and Supabase CLI as project dependencies.
5. Run `npx supabase init`.
6. Link the project using the Supabase project reference from `Details.md`.
7. Create the first reviewed migration containing profiles, wallets, immutable transactions, signup allocation, and RLS.
8. Stop before pushing the migration if any credential, project, or schema assumption is ambiguous.

Google provider setup and live Spotflow calls must wait until their required inputs and test-mode assumptions are confirmed.

## Definition of Launch Ready

Stranerd is launch ready only when:

- The marketing site and anatomy app are separated and responsive.
- Engineering is absent from the public product.
- Google auth works on localhost and production.
- Signup credits, subscriptions, and PAYG credits are server-enforced.
- AI endpoints cannot be used without valid auth and available credits.
- Spotflow webhooks are signature-verified and idempotent.
- Subscription and PAYG test scenarios pass.
- Legal and cancellation disclosures are published.
- Analytics contain no sensitive data.
- Mobile anatomy, Activities, Mentor, auth, checkout, and account UX are verified.
