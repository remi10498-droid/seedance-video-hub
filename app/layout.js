export const metadata = {
  title: 'Seedance 2.5 Video Generator',
  description: 'AI Video Generator powered by Picsart',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#121318' }}>
        {children}
      </body>
    </html>
  )
}
