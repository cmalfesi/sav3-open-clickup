import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "SAV3 · Open ClickUp Lab",
  description: "Prueba privada de gestión SAV3 con copia del respaldo de ClickUp.",
  icons: {
    icon: [
      { url: "/sav3-clickup-amber.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/sav3-clickup-amber-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/sav3-clickup-amber.svg",
    apple: "/sav3-clickup-amber-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('cu-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
