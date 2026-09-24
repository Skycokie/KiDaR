import type { ReactNode } from "react";
import "./auth-shell.css";

export function AuthShell({
  eyebrow = "kiDAR Studio",
  title,
  children
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell" lang="ro">
      <section className="auth-card">
        <p className="auth-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
