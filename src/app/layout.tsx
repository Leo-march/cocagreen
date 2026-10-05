import type { Metadata } from "next";
import "./globals.css";
import { AppLayoutShell } from "@/components/app-layout-shell";

export const metadata: Metadata = {
  title: "Pareto | Coca Green",
  description: "Acompanhe seus indicadores de sustentabilidade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppLayoutShell>{children}</AppLayoutShell>
      </body>
    </html>
  );
}
