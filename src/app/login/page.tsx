"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (username !== "12345" || password !== "12345") {
      setError("Usuário ou senha inválidos.");
      return;
    }

    router.push("/classificacaofalhas");
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Image
          className="login-logo"
          src="/Coca-Cola-circular.png"
          alt="Coca-Cola"
          width={96}
          height={96}
          priority
        />
        <p className="eyebrow">COCA GREEN</p>
        <h1 id="login-title">Fazer login</h1>
        <p className="page-subtitle">Acesse sua área de classificação de dados.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuário</span>
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
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
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" type="submit">
            Entrar
          </button>
        </form>

        <Link className="login-back-link" href="/classificacaofalhas">
          Voltar para classificação
        </Link>
      </section>
    </div>
  );
}