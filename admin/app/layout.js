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
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-3 pb-8 pt-3 sm:px-5 sm:pb-10 sm:pt-5 lg:px-8">
          <header className="app-header rounded-[24px] px-4 py-4 sm:rounded-[28px] sm:px-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="header-chip flex h-10 w-10 items-center justify-center rounded-2xl sm:h-11 sm:w-11">
                <span className="font-[family-name:var(--font-display)] text-base font-semibold text-accent sm:text-lg">Z</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <p className="header-text-muted text-[11px] font-semibold uppercase tracking-[0.28em] sm:tracking-[0.36em]">
                    Zenadam Admin
                  </p>
                  <span className="header-chip rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em]">
                    Source Console
                  </span>
                </div>
                <h1 className="header-text mt-3 font-[family-name:var(--font-display)] text-[1.95rem] font-semibold leading-tight sm:text-2xl">
                  Source management
                </h1>
                <p className="header-text-muted mt-2 max-w-xl text-[15px] leading-6 sm:text-sm">
                  Fast curation for active feeds and candidate intake.
                </p>
              </div>
            </div>
          </header>

          <main className="mt-4 flex-1 sm:mt-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
