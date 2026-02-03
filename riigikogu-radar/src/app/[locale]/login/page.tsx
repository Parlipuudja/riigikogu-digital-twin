"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || `/${locale}`;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(locale === "et" ? "Vale kasutajanimi või parool" : "Invalid username or password");
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(locale === "et" ? "Midagi läks valesti" : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-center mb-8">
          {locale === "et" ? "Administraatori sisselogimine" : "Administrator Login"}
        </h1>

        <div className="card">
          <div className="card-content">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-vote-against bg-vote-against-light rounded">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className="input-label">
                  {locale === "et" ? "Kasutajanimi" : "Username"}
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="input-label">
                  {locale === "et" ? "Parool" : "Password"}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading
                  ? (locale === "et" ? "Sisenen..." : "Signing in...")
                  : (locale === "et" ? "Logi sisse" : "Sign in")}
              </button>
            </form>
          </div>
        </div>

        <p className="text-sm text-ink-500 text-center mt-4">
          {locale === "et"
            ? "Ainult administraatoritele. Avalik sisu on saadaval ilma sisselogimiseta."
            : "For administrators only. Public content is available without login."}
        </p>
      </div>
    </div>
  );
}
