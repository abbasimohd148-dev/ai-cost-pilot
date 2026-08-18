import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Gauge, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function AuthShell({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 p-12 text-white relative overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Gauge className="h-5 w-5" strokeWidth={2.2} />
          </div>

          <span className="font-bold text-lg font-heading">
            Autopilot
          </span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold tracking-tight leading-tight font-heading">
            Actionable AI cost intelligence.
          </h1>

          <p className="mt-4 text-slate-300 leading-relaxed">
            Understand exactly where your AI spend goes, catch reliability
            problems, and quantify savings — built on your real usage data.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
            {[
              "Cost breakdowns",
              "Reliability metrics",
              "Event ingestion",
            ].map((f) => (
              <div
                key={f}
                className="rounded-lg bg-white/5 border border-white/10 p-3 text-slate-200"
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Phase 1 · Data foundation
        </div>

        <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 border-slate-200 shadow-sm">
          {children}
        </Card>
      </div>
    </div>
  );
}

function GoogleButton({ onClick, loading }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="w-full h-10 border-slate-300 bg-white hover:bg-slate-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <svg
            className="h-4 w-4 mr-2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
            />

            <path
              fill="#34A853"
              d="M12 21.82c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.82Z"
            />

            <path
              fill="#FBBC05"
              d="M6.54 13.89a5.86 5.86 0 0 1 0-3.78V7.58H3.3a9.81 9.81 0 0 0 0 8.84l3.24-2.53Z"
            />

            <path
              fill="#EA4335"
              d="M12 6.08c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 3.1 14.63 2.18 12 2.18a9.74 9.74 0 0 0-8.7 5.4l3.24 2.53C7.31 7.8 9.46 6.08 12 6.08Z"
            />
          </svg>

          Continue with Google
        </>
      )}
    </Button>
  );
}

export function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setLoading(true);

    const { error } = await signIn(email, password);

    setLoading(false);

    if (error) {
      return toast.error("Login failed", {
        description: error.message,
      });
    }

    navigate("/dashboard");
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    const { error } = await signInWithGoogle();

    if (error) {
      setGoogleLoading(false);

      toast.error("Google sign-in failed", {
        description: error.message,
      });
    }
  };

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">
        Welcome back
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Sign in to your Autopilot workspace.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="login-email">Email</Label>

          <Input
            id="login-email"
            type="email"
            data-testid="login-email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <Label htmlFor="login-password">Password</Label>

          <Input
            id="login-password"
            type="password"
            data-testid="login-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          data-testid="login-submit"
          disabled={loading || googleLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>

        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-500">
            OR
          </span>
        </div>
      </div>

      <GoogleButton
        onClick={handleGoogleSignIn}
        loading={googleLoading}
      />

      <p className="mt-6 text-sm text-slate-500 text-center">
        No account?{" "}
        <Link
          to="/signup"
          data-testid="link-signup"
          className="font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      return toast.error(
        "Password must be at least 6 characters"
      );
    }

    setLoading(true);

    const { data, error } = await signUp(email, password);

    setLoading(false);

    if (error) {
      return toast.error("Sign up failed", {
        description: error.message,
      });
    }

    if (data?.session) {
      toast.success("Account created");
      navigate("/dashboard");
    } else {
      toast.info(
        "Check your email to confirm your account, then sign in."
      );
      navigate("/login");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    const { error } = await signInWithGoogle();

    if (error) {
      setGoogleLoading(false);

      toast.error("Google sign-in failed", {
        description: error.message,
      });
    }
  };

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">
        Create your account
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Start tracking AI cost & reliability.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="signup-email">Email</Label>

          <Input
            id="signup-email"
            type="email"
            data-testid="signup-email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <Label htmlFor="signup-password">Password</Label>

          <Input
            id="signup-password"
            type="password"
            data-testid="signup-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
            placeholder="At least 6 characters"
          />
        </div>

        <Button
          type="submit"
          data-testid="signup-submit"
          disabled={loading || googleLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>

        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-500">
            OR
          </span>
        </div>
      </div>

      <GoogleButton
        onClick={handleGoogleSignIn}
        loading={googleLoading}
      />

      <p className="mt-6 text-sm text-slate-500 text-center">
        Already have an account?{" "}
        <Link
          to="/login"
          data-testid="link-login"
          className="font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
