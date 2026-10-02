import "./globals.css";

export const metadata = {
  title: "Coca Green",
  description: "Dashboard e análises de manutenção",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
