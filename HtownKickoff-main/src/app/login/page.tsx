"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleAlert,
  CircleCheckBig,
  Lock,
  LogIn,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";
import { ThemeProvider, AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

type AccountType = "fan" | "venue";

export default function LoginPage() {
  const { login, register, logout, isLoading, error: authError } = useAuth();
  const router = useRouter();

  const [accountType, setAccountType] = React.useState<AccountType>("fan");
  const [remember, setRemember] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");

  const [signupName, setSignupName] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = React.useState("");
  const [signupAccepted, setSignupAccepted] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<"signin" | "signup">("signin");
  const [nextPath, setNextPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthTab(params.get("view") === "signup" ? "signup" : "signin");
    const next = params.get("next");
    setNextPath(next && next.startsWith("/") ? next : null);
  }, []);

  const passwordStrong =
    signupPassword.length >= 10 &&
    /[A-Z]/.test(signupPassword) &&
    /[a-z]/.test(signupPassword) &&
    /[0-9]/.test(signupPassword) &&
    /[^A-Za-z0-9]/.test(signupPassword);

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    try {
      const normalizedEmail = loginEmail.trim().toLowerCase();
      await login(normalizedEmail, loginPassword);

      const me = await api.get<{ role: string }>("/user/me");
      const role = me.data.role;
      const isVenueRole = role === "VENUE_OWNER" || role === "ADMIN" || role === "SUPER_ADMIN";

      if (accountType === "venue" && !isVenueRole) {
        await logout();
        setFormError("This account is not a venue owner account.");
        return;
      }

      if (nextPath) {
        router.push(nextPath);
        return;
      }

      router.push(isVenueRole ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setFormError(message);
    }
  };

  const onSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (accountType === "venue") {
      router.push("/for-venues/register");
      return;
    }

    if (!signupName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!passwordStrong) {
      setFormError("Password must include uppercase, lowercase, number, and symbol.");
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!signupAccepted) {
      setFormError("You must accept Terms and Privacy.");
      return;
    }

    try {
      const normalizedEmail = signupEmail.trim().toLowerCase();
      const normalizedName = signupName.trim();
      await register(normalizedEmail, signupPassword, normalizedName);
      await login(normalizedEmail, signupPassword);
      setFormSuccess("Account created successfully.");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setFormError(message);
    }
  };

  return (
    <ThemeProvider>
      <AppShell>
        <main className="mx-auto flex min-h-[calc(100dvh-110px)] w-full items-center justify-center px-4 py-12 sm:px-6 md:py-16">
          <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.2fr_1fr]">
            <Card className="mx-auto w-full max-w-3xl border-[var(--border-glow)] bg-[linear-gradient(180deg,#18202d_0%,#131a26_100%)]">
              <CardHeader className="space-y-4 pb-2">
                <Badge className="w-fit gap-1 text-[11px] tracking-[0.08em]" variant="secondary">
                  {accountType === "venue" ? <Building2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {accountType === "venue" ? "Venue Owner Access" : "Fan Access"}
                </Badge>
                <CardTitle className="font-display text-4xl leading-tight tracking-tight md:text-5xl md:leading-[1.05]">MatchWatch Account</CardTitle>
                <CardDescription className="max-w-2xl text-base leading-relaxed">
                  Switch between fan and venue owner workflows, then sign in or create your account.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={accountType === "fan" ? "default" : "outline"}
                    className="h-12 w-full text-base font-semibold"
                    onClick={() => {
                      setAccountType("fan");
                      setFormError(null);
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Fan
                  </Button>
                  <Button
                    type="button"
                    variant={accountType === "venue" ? "default" : "outline"}
                    className="h-12 w-full text-base font-semibold"
                    onClick={() => {
                      setAccountType("venue");
                      setFormError(null);
                    }}
                  >
                    <Building2 className="h-4 w-4" />
                    Venue
                  </Button>
                </div>

                {(formError || authError) && (
                  <Alert variant="destructive">
                    <CircleAlert className="mb-2 h-4 w-4" />
                    <AlertTitle>Action required</AlertTitle>
                    <AlertDescription className="leading-relaxed">{formError || authError}</AlertDescription>
                  </Alert>
                )}

                {formSuccess && (
                  <Alert>
                    <CircleCheckBig className="mb-2 h-4 w-4" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription className="leading-relaxed">{formSuccess}</AlertDescription>
                  </Alert>
                )}

                <Tabs value={authTab} onValueChange={(value) => setAuthTab(value as "signin" | "signup")} className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2">
                    <TabsTrigger value="signin" className="text-base font-semibold">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="text-base font-semibold">
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="pt-4">
                    <form className="space-y-5" onSubmit={onLogin}>
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-semibold">Email</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                          <Input
                            id="login-email"
                            type="email"
                            className="h-12 pl-9 text-base"
                            placeholder="you@example.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-semibold">Password</Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                          <Input
                            id="login-password"
                            type="password"
                            className="h-12 pl-9 text-base"
                            placeholder="Enter your password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                          <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
                          Remember this device
                        </label>
                        <Link href="/account" className="text-sm font-semibold text-[var(--accent-primary)]">
                          Need help?
                        </Link>
                      </div>
                      <Button className="h-12 w-full text-base font-semibold" type="submit" disabled={isLoading}>
                        {isLoading ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="pt-4">
                    {accountType === "venue" ? (
                      <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">Venue onboarding</h3>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                          Venue accounts require business details, map location, amenities, and branding setup.
                        </p>
                        <Button className="h-12 w-full text-base font-semibold" onClick={() => router.push("/for-venues/register")}>
                          Continue to Venue Registration
                        </Button>
                      </div>
                    ) : (
                      <form className="space-y-5" onSubmit={onSignup}>
                        <div className="space-y-2">
                          <Label htmlFor="signup-name" className="text-sm font-semibold">Full name</Label>
                          <Input
                            id="signup-name"
                            className="h-12 text-base"
                            placeholder="Your full name"
                            value={signupName}
                            onChange={(e) => setSignupName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email" className="text-sm font-semibold">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            className="h-12 text-base"
                            placeholder="you@example.com"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password" className="text-sm font-semibold">Password</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            className="h-12 text-base"
                            placeholder="At least 10 chars with strong complexity"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password-confirm" className="text-sm font-semibold">Confirm password</Label>
                          <Input
                            id="signup-password-confirm"
                            type="password"
                            className="h-12 text-base"
                            placeholder="Confirm your password"
                            value={signupPasswordConfirm}
                            onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                            required
                          />
                        </div>
                        <label className="flex items-start gap-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                          <Checkbox
                            checked={signupAccepted}
                            onCheckedChange={(checked) => setSignupAccepted(checked === true)}
                            className="mt-0.5"
                          />
                          <span>
                            I agree to the{" "}
                            <Link href="/terms" className="text-[var(--accent-primary)]">
                              Terms
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="text-[var(--accent-primary)]">
                              Privacy Policy
                            </Link>
                            .
                          </span>
                        </label>
                        <Button className="h-12 w-full text-base font-semibold" type="submit" disabled={isLoading}>
                          {isLoading ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="mx-auto h-fit w-full max-w-xl">
              <CardHeader className="space-y-3">
                <CardTitle className="font-display text-3xl leading-tight">Why Teams Use MatchWatch</CardTitle>
                <CardDescription className="text-base leading-relaxed">Production-ready booking and event operations in one place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-base leading-relaxed text-[var(--text-secondary)]">
                <div className="space-y-2">
                  <h4 className="font-semibold text-[var(--text-primary)]">Fan accounts</h4>
                  <p>Track matches, reserve seats, and manage bookings with live updates.</p>
                </div>
                <Separator className="opacity-80" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-[var(--text-primary)]">Venue accounts</h4>
                  <p>Create events, handle capacity, and publish your venue profile for discovery.</p>
                </div>
                <Separator className="opacity-80" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-[var(--text-primary)]">Secure sessions</h4>
                  <p>JWT access tokens with refresh-session rotation and role-scoped controls.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </AppShell>
    </ThemeProvider>
  );
}
