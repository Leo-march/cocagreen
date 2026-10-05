"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { setLoggedInUser, setVisitorSession } from "@/lib/client-auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedName = username.trim();
    setIsSigningIn(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedName, password }),
      });
      const payload = await response.json() as { username?: string; error?: string };
      if (!response.ok || !payload.username) {
        throw new Error(payload.error || "Não foi possível validar as credenciais administrativas.");
      }
      setLoggedInUser(payload.username, "admin");
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível iniciar a sessão.");
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleVisitorAccess() {
    setVisitorSession();
    router.push("/dashboard");
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Image
          className="login-logo"
          src="/imagem-login.jpg"
          alt="Ícone do usuário"
          width={96}
          height={96}
          priority
        />
        <p className="eyebrow">COCA GREEN</p>
        <h1 id="login-title">Acesso ao sistema</h1>
        <p className="page-subtitle">Entre como visitante para visualizar ou use as credenciais administrativas configuradas para gerenciar.</p>

        <div className="login-role-switch" aria-label="Tipo de acesso">
          <button type="button" className="login-role-button login-role-button-active" onClick={handleVisitorAccess}>
            Entrar como visitante
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Nome</span>
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nome"
              required
              value={username}
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" type="submit" disabled={isSigningIn}>
            {isSigningIn ? "Validando acesso..." : "Entrar com cadastro"}
          </button>
        </form>
      </section>
    </div>
  );
}