import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Institut Al-Itqan — Espace familles',
  description: "Plateforme parents de l'Institut Al-Itqan",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
