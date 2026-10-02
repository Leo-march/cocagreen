"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...(isRegister ? { confirmPassword } : {}) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "Não foi possível validar seu acesso.");
        return;
      }

      const requestedPage = new URLSearchParams(window.location.search).get("next");
      const destination = requestedPage?.startsWith("/") && !requestedPage.startsWith("//") && !requestedPage.startsWith("/login") && !requestedPage.startsWith("/cadastro")
        ? requestedPage
        : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-panel">
          <Image src="/Coca-Cola-circular.png" alt="Coca-Cola" width={84} height={84} priority />
          <p className="auth-brand-kicker">COCA GREEN</p>
          <h1>Indicadores para decisões com impacto.</h1>
          <p>Acesse as análises, dados e gráficos da operação.</p>
          <span className="auth-brand-orb auth-brand-orb-one" />
          <span className="auth-brand-orb auth-brand-orb-two" />
        </div>

        <div className="auth-form-panel">
          <p className="auth-eyebrow">ÁREA RESTRITA</p>
          <h2 id="auth-title">{isRegister ? "Criar acesso" : "Bem-vinda de volta"}</h2>
          <p className="auth-description">{isRegister ? "Cadastre seus dados para entrar no painel." : "Entre com seu usuário e senha para continuar."}</p>
<form className="auth-form" onSubmit={submit}>
            <label>Usuário
              <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label>Senha
              <input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {isRegister && <label>Confirmar senha
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? "Validando..." : isRegister ? "Criar acesso" : "Entrar"}</button>
          </form>

          <p className="auth-footer">Acesso protegido · Coca Green</p>
        </div>
      </section>
    </main>
  );
}
