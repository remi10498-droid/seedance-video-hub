export const metadata = {
  title: "Picsart AI Studio",
  description: "AI Generation Studio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0b0c10" }}>
        {children}
      </body>
    </html>
  );
}
