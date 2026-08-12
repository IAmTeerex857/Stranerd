import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, CreditCard, ExternalLink, LogOut, Volume2, WalletCards } from "lucide-react";
import { useAuth } from "./auth-context";
import { safeReturnPath } from "./auth-utils";
import { supabase } from "./lib/supabase";
import { Page } from "./PublicLayout";
import { GoogleIcon } from "./components/GoogleIcon";
import { BillingButton } from "./components/BillingButton";
import { cancelSubscription, checkoutRail, useBillingOptions } from "./lib/billing";
import { sendWelcomeEmail } from "./lib/email";
import { ThemeControl } from "./theme";
import { MotionControl } from "./preferences";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AccountData = {
  profile: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  wallet: {
    free_balance: number;
    subscription_balance: number;
    purchased_balance: number;
  } | null;
  transactions: {
    id: string;
    amount: number;
    type: string;
    bucket: string;
    feature: string;
    created_at: string;
  }[];
  subscription: {
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  payments: {
    id: string;
    product_type: string;
    amount_minor: number;
    currency: string;
    provider: string;
    credits: number;
    status: string;
    created_at: string;
  }[];
};

export function LoginPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string>();
  const params = new URLSearchParams(window.location.search);
  const next = safeReturnPath(params.get("next"), "/app");
  const signingUp = params.get("mode") === "signup";

  async function signIn() {
    setError(undefined);
    try {
      await signInWithGoogle(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Google sign-in could not be started.",
      );
    }
  }

  return (
    <Page>
      <main className="status-page auth-page">
        <div>
          <h1>{user ? "You are signed in." : `${signingUp ? "Sign up" : "Sign in"} to access quizzes, 3D models, and AI guidance.`}</h1>
          {!user && <p>Continue securely with your Google account.</p>}
          {error && (
            <p className="auth-error">
              <CircleAlert size={16} />
              {error}
            </p>
          )}
          {!configured && (
            <p className="auth-error">
              <CircleAlert size={16} />
              Supabase browser variables are not configured.
            </p>
          )}
          {user ? (
            <a className="public-cta" href={next}>
              Continue
              <ArrowRight size={15} />
            </a>
          ) : (
            <button
              className="google-button"
              disabled={loading || !configured}
              onClick={signIn}
            >
              <GoogleIcon />
              {loading ? "Checking session..." : "Continue with Google"}
            </button>
          )}
          <small>
            By continuing, you agree to the Terms of Service and acknowledge the
            Privacy Policy.
          </small>
        </div>
      </main>
    </Page>
  );
}

export function AuthCallbackPage() {
  const [error, setError] = useState<string>();
  const next = safeReturnPath(
    new URLSearchParams(window.location.search).get("next") ||
      window.sessionStorage.getItem("stranerd.auth.next"),
    "/app",
  );

  useEffect(() => {
    let active = true;
    async function complete() {
      if (!supabase) {
        setError("Supabase browser variables are not configured.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const providerError =
        params.get("error_description") || params.get("error");
      if (providerError) {
        setError(providerError);
        return;
      }
      const code = params.get("code");
      if (!code) {
        setError("The authentication response did not include a code.");
        return;
      }
      const { data: exchange, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (exchangeError) setError(exchangeError.message);
      else {
        if (exchange.session) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              await sendWelcomeEmail();
              break;
            } catch {
              if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 750));
            }
          }
        }
        window.sessionStorage.removeItem("stranerd.auth.next");
        window.location.replace(next);
      }
    }
    void complete();
    return () => {
      active = false;
    };
  }, [next]);

  return (
    <Page>
      <main className="status-page">
        <div>
          <span className="status-mark" />
          <span className="eyebrow">Secure sign-in</span>
          <h1>
            {error ? "Sign-in was not completed." : "Completing sign-in."}
          </h1>
          <p>
            {error ||
              "Confirming your Google session and preparing your account."}
          </p>
          {error && (
            <a
              className="public-cta"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              Try again
            </a>
          )}
        </div>
      </main>
    </Page>
  );
}

export function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [data, setData] = useState<AccountData>();
  const [error, setError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState<string>();
  const [activityExpanded, setActivityExpanded] = useState(false);
  const billingOptions = useBillingOptions();

  async function cancelCurrentSubscription() {
    setCancelling(true);
    setError(undefined);
    setCancellationNotice(undefined);
    try {
      await cancelSubscription();
      setData((current) =>
        current
          ? {
              ...current,
              subscription: current.subscription
                ? { ...current.subscription, cancel_at_period_end: true }
                : null,
            }
          : current,
      );
      setCancellationNotice("Cancellation is scheduled for the end of the current billing period.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Subscription cancellation could not be requested.",
      );
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    async function loadAccount() {
      const [profile, wallet, transactions, subscription, payments] = await Promise.all([
        supabase!
          .from("profiles")
          .select("display_name,email,avatar_url")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase!
          .from("credit_wallets")
          .select("free_balance,subscription_balance,purchased_balance")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase!
          .from("credit_transactions")
          .select("id,amount,type,bucket,feature,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase!
          .from("subscriptions")
          .select("status,current_period_end,cancel_at_period_end")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase!
          .from("payment_intents")
          .select("id,provider,product_type,amount_minor,currency,credits,status,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (!active) return;
      setData({
        profile: profile.data,
        wallet: wallet.data,
        transactions: transactions.data ?? [],
        subscription: subscription.data,
        payments: payments.data ?? [],
      });
      const firstError = profile.error || wallet.error || transactions.error || subscription.error || payments.error;
      if (firstError) setError(`Some account information could not be loaded. ${firstError.message}`);
    }
    void loadAccount();
    return () => {
      active = false;
    };
  }, [user]);

  if (authLoading)
    return (
      <Page themed account>
        <main className="status-page">
          <Card>
            <span className="status-mark" />
            <h1>Loading account.</h1>
          </Card>
        </main>
      </Page>
    );
  if (!user)
    return (
      <Page themed>
        <main className="status-page">
          <Card>
            <span className="eyebrow">Authentication required</span>
            <h1>Sign in to view your account.</h1>
            <p>
              Your balance and billing records are private to your Stranerd
              account.
            </p>
            <Button asChild><a className="public-cta" href="/login?next=/account">
              Continue with Google
              <ArrowRight size={15} />
            </a></Button>
          </Card>
        </main>
      </Page>
    );

  const wallet = data?.wallet;
  const total = wallet ? wallet.free_balance + wallet.subscription_balance + wallet.purchased_balance : undefined;
  const name =
    data?.profile?.display_name ||
    user.user_metadata.full_name ||
    user.email ||
    "Stranerd learner";
  const avatar = data?.profile?.avatar_url || user.user_metadata.avatar_url;
  const subscription = data?.subscription;
  const subscriptionLabels: Record<string, string> = { pending: "Plus activation pending", active: "Stranerd Plus", past_due: "Plus payment past due", cancelled: "Plus cancelled", completed: "Previous Plus plan completed" };
  const subscriptionTitle = subscription ? subscriptionLabels[subscription.status] || `Plan status: ${subscription.status}` : "Free account";
  const canCancel = Boolean(subscription && ["active", "past_due"].includes(subscription.status) && !subscription.cancel_at_period_end);
  const showSubscribe = !subscription || ["cancelled", "completed"].includes(subscription.status);
  const nigeria = billingOptions?.country === "NG";
  const subscriptionRail = checkoutRail(billingOptions, "subscription");
  const packRail = checkoutRail(billingOptions, "payg_100");
  const formatMoney = (amountMinor: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100);
  const meterTotal = total || 1;
  const planDate = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : undefined;
  const planUsed = Math.max(0, 500 - (wallet?.subscription_balance || 0));

  return (
    <Page themed account>
      <main className="account-page account-redesign">
        <header className="account-heading">
          <div className="account-profile-mobile">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{String(name).split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()}</span>}<div><h2>{name}</h2><p>{data?.profile?.email || user.email}</p></div></div>
          <div className="account-billing-heading"><span className="account-kicker">Billing</span><h1>Credits &amp; plan</h1></div>
        </header>
        {error && (
          <p className="auth-error" role="alert">
            <CircleAlert size={16} />
            {error}
          </p>
        )}
        <section className="account-dashboard" aria-labelledby="billing-title">
          <Card className="credit-meter"><header><span>Credit balance</span><WalletCards size={18} /></header><div className="credit-meter-total"><strong>{total ?? "--"}</strong><span>{data ? "credits available" : "loading credits"}</span></div><div className="credit-meter-bar" aria-label="Credit balance by source"><i className="free" style={{ width: `${((wallet?.free_balance || 0) / meterTotal) * 100}%` }} /><i className="plan" style={{ width: `${((wallet?.subscription_balance || 0) / meterTotal) * 100}%` }} /><i className="purchased" style={{ width: `${((wallet?.purchased_balance || 0) / meterTotal) * 100}%` }} /></div><dl><div><dt><i className="free" />Free</dt><dd>{wallet?.free_balance ?? "--"}</dd><small>signup grant</small></div><div><dt><i className="plan" />Plan</dt><dd>{wallet?.subscription_balance ?? "--"}</dd><small>{planDate ? `resets ${planDate}` : "monthly credits"}</small></div><div><dt><i className="purchased" />Purchased</dt><dd>{wallet?.purchased_balance ?? "--"}</dd><small>never expires</small></div></dl><p>Spent in that order: free first, then monthly plan credits, then purchased packs last, so paid credits do not expire before use.</p>{packRail && <div className="mobile-credit-cta"><BillingButton productId="payg_100" rail={packRail}>Buy more credits</BillingButton></div>}</Card>
          <Card className="current-plan"><header><span>Current plan</span></header><div className="plan-title-row"><h2 id="billing-title">{subscriptionTitle}</h2><span className={`account-status ${subscription?.status || "free"}`}>{subscription?.cancel_at_period_end ? "cancellation scheduled" : subscription?.status || "free"}</span></div><p>{planDate ? `${nigeria ? "NGN 2,500" : "$5"} monthly · 500 credits each billing cycle. ${subscription?.cancel_at_period_end ? "Ends" : "Renews"} ${planDate}.` : "Subscribe when you need a larger monthly AI allowance."}</p>{subscription && ["active", "past_due"].includes(subscription.status) && <div className="plan-usage"><div><span>Used this cycle</span><strong>{planUsed} / 500</strong></div><i><span style={{ width: `${Math.min(100, (planUsed / 500) * 100)}%` }} /></i></div>}<div className="billing-actions">{packRail && <BillingButton productId="payg_100" rail={packRail}>Buy credits</BillingButton>}{subscription?.cancel_at_period_end && <Button disabled>Cancellation scheduled</Button>}{canCancel && <Button variant="outline" onClick={cancelCurrentSubscription} disabled={cancelling}>{cancelling ? "Cancelling..." : "Cancel plan"}</Button>}{showSubscribe && subscriptionRail && <BillingButton productId="subscription" rail={subscriptionRail}>Get Plus · {nigeria ? "₦2,500" : "$5"}</BillingButton>}{!billingOptions && <Button disabled>Loading checkout...</Button>}{billingOptions?.unavailable && <Button disabled>Checkout unavailable</Button>}</div>{cancellationNotice && <small className="account-notice" aria-live="polite">{cancellationNotice}</small>}<Button variant="ghost" asChild><a href="/pricing">Compare options<ArrowRight size={14} /></a></Button></Card>
        </section>

        <section className="account-lower-grid">
          <Card className="account-section account-activity" aria-labelledby="activity-title"><header><div><span className="section-kicker">History</span><h2 id="activity-title">Recent activity</h2></div>{data && (data.transactions.length > 8 || data.payments.length > 8) && <Button variant="ghost" onClick={() => setActivityExpanded((value) => !value)}>{activityExpanded ? "Show less" : "See more"}</Button>}</header><div className="account-activity-grid"><div className="transaction-list"><header><CreditCard size={17} /><h3>Credit activity</h3></header>{!data && <p>Loading credit activity...</p>}{data?.transactions.length === 0 && <p>No credit activity yet.</p>}{data?.transactions.slice(0, activityExpanded ? undefined : 8).map((transaction) => <div key={transaction.id}><span><b>{transaction.feature.replaceAll("_", " ")}</b><small>{transaction.type} · {transaction.bucket}</small></span><strong className={transaction.amount > 0 ? "positive" : ""}>{transaction.amount > 0 ? "+" : ""}{transaction.amount}</strong><time dateTime={transaction.created_at}>{new Date(transaction.created_at).toLocaleDateString()}</time></div>)}</div><div className="transaction-list payment-list"><header><WalletCards size={17} /><h3>Payments</h3></header>{!data && <p>Loading payments...</p>}{data?.payments.length === 0 && <p>No payment activity yet.</p>}{data?.payments.slice(0, activityExpanded ? undefined : 8).map((payment) => <div key={payment.id}><span><b>{payment.product_type === "subscription" ? "Stranerd Plus" : "100-credit pack"}</b><small>{payment.status}</small></span><strong>{formatMoney(payment.amount_minor, payment.currency)}</strong><time dateTime={payment.created_at}>{new Date(payment.created_at).toLocaleDateString()}</time></div>)}</div></div></Card>
          <div className="account-side-stack"><Card className="account-section preferences-section" aria-labelledby="preferences-title"><header><span className="section-kicker" id="preferences-title">Preferences</span></header><div className="preferences-grid"><article><div><h3>Theme</h3><p>Switch light and dark instantly.</p></div><ThemeControl /></article><article><div><h3>Reduced motion</h3><p>Suppress auto-rotation and panel transitions.</p></div><MotionControl /></article></div></Card><Card className="account-section voice-privacy"><span className="section-kicker"><Volume2 size={15} />Voice privacy</span><p>Your microphone is used only while a Voice session runs. Live captions and raw audio are not stored by Stranerd.</p><div><a href="/legal/privacy">Read privacy policy<ArrowRight size={13} /></a><a className="danger-link" href="mailto:officialstranerd@gmail.com?subject=Stranerd%20account%20deletion%20request">Request account deletion<ExternalLink size={13} /></a></div></Card><Button className="account-signout" variant="outline" onClick={() => void signOut()}><LogOut size={16} />Sign out</Button></div>
        </section>
      </main>
    </Page>
  );
}
