'use client';

import Link from 'next/link';

function BannerMenu({ items, activeKey, onChange }) {
  return (
    <div className="flex items-center gap-8">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`relative pb-3 text-[17px] font-medium transition ${
            activeKey === item.key ? 'text-accent' : 'text-text-muted hover:text-text'
          }`}
        >
          {item.label}
          <span
            className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-accent transition ${
              activeKey === item.key ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function PageBanner({
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  menuItems,
  activeMenuKey,
  onMenuChange
}) {
  return (
    <header className="shell-panel relative left-1/2 w-screen -translate-x-1/2 rounded-none border-x-0 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Link href="/" className="flex min-h-12 items-center gap-3 rounded-full px-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-contrast shadow-[0_14px_30px_rgba(37,99,235,0.22)]">
              Z
            </span>
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-text">Zenadam</span>
          </Link>

          <div className="input-surface flex min-h-13 flex-1 items-center rounded-full px-5">
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search stories, sources, or coverage"
              className="w-full border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-text-muted"
              aria-label="Search stories"
            />
          </div>
        </div>

        <div className="mt-4 flex pl-1 pt-1 sm:pl-1.5">
          <BannerMenu items={menuItems} activeKey={activeMenuKey} onChange={onMenuChange} />
        </div>
      </div>
    </header>
  );
}
