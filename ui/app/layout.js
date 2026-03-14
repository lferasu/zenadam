import { Manrope, Sora } from 'next/font/google';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body'
});

const displayFont = Sora({
  subsets: ['latin'],
  variable: '--font-display'
});

export const metadata = {
  title: 'Zenadam',
  description: 'Story-first mobile news experience for Zenadam.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-[family-name:var(--font-body)] text-text`}>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
