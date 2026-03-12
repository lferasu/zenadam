import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body'
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display'
});

export const metadata = {
  title: 'Zenadam Admin',
  description: 'Mobile-first source management admin UI for Zenadam.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-[family-name:var(--font-body)] text-text`}>
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="app-header rounded-[28px] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="header-chip flex h-11 w-11 items-center justify-center rounded-2xl">
                  <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-accent">Z</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="header-text-muted text-[11px] font-semibold uppercase tracking-[0.36em]">Zenadam Admin</p>
                    <span className="header-chip rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
                      Source Console
                    </span>
                  </div>
                  <h1 className="header-text mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
                    Source management
                  </h1>
                  <p className="header-text-muted mt-1 text-sm">Fast curation for active feeds and candidate intake.</p>
                </div>
              </div>
              <div className="header-chip inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em]">
                Dark mode
              </div>
            </div>
          </header>

          <main className="mt-6 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
