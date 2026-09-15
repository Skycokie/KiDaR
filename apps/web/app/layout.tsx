import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "kidAR Studio",
  description: "Create playful WebAR experiences from children's drawings."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
