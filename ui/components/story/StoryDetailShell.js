'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageBanner } from '@/components/layout/PageBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorRetryState } from '@/components/ui/ErrorRetryState';
import { LoadingState } from '@/components/ui/LoadingState';
import { clampText, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { getStory, getStoryArticles } from '@/services/publicApi';

function CoverageCard({ article }) {
  return (
    <article className="card-surface rounded-[24px] p-4">
      <div className="flex items-start gap-3">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-[16px] bg-slate-200/70 sm:h-24 sm:w-28">
          {article.image?.url ? (
            <img src={article.image.url} alt={article.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.22em] text-text-muted">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <span className="soft-surface rounded-full px-3 py-1">{article.sourceName ?? 'Unknown source'}</span>
            <span className="soft-surface rounded-full px-3 py-1">{formatRelativeTime(article.publishedAt)}</span>
            {article.isPrimary ? <span className="rounded-full bg-accent px-3 py-1 text-accent-contrast">Top source</span> : null}
          </div>
        </div>
      </div>
      <h3 className="mt-4 font-[family-name:var(--font-display)] text-[1.8rem] font-semibold leading-tight text-text">
        {article.title}
      </h3>
      <p className="mt-3 text-[15px] leading-7 text-text-muted">{clampText(article.summary, 260)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {article.storyItemScore !== null && article.storyItemScore !== undefined ? (
          <span className="soft-surface rounded-full px-3 py-1.5 text-sm text-text-muted">
            Score {Number(article.storyItemScore).toFixed(2)}
          </span>
        ) : null}
        {article.canonicalUrl ? (
          <a
            href={article.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Open original
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function StoryDetailShell({ storyId }) {
  const router = useRouter();
  const [story, setStory] = useState(null);
  const [articles, setArticles] = useState([]);
  const [emphasis, setEmphasis] = useState('balanced');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [storyPayload, articlesPayload] = await Promise.all([getStory(storyId), getStoryArticles(storyId)]);
      setStory(storyPayload);
      setArticles(articlesPayload?.articles ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStory();
  }, [storyId]);

  if (isLoading) {
    return <LoadingState title="Loading story" description="Collecting the summary and ranked coverage for this story." />;
  }

  if (error) {
    return (
      <ErrorRetryState
        title="Could not load this story"
        description="The story detail screen did not load cleanly. Retry and keep the consumer surface stable."
        onRetry={loadStory}
      />
    );
  }

  if (!story) {
    return (
      <EmptyState
        title="Story unavailable"
        description="The requested grouped story could not be found."
        action={
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast">
            Back to feed
          </Link>
        }
      />
    );
  }

  const summaryFirst = emphasis === 'summary';
  const coverageFirst = emphasis === 'coverage';

  const summarySection = (
    <section className="shell-panel rounded-[30px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
          <span className="soft-surface rounded-full px-3 py-1">{formatRelativeTime(story.latestPublishedAt)}</span>
          <span className="soft-surface rounded-full px-3 py-1">{story.sourceCount ?? 0} sources</span>
          <span className="soft-surface rounded-full px-3 py-1">{story.articleCount ?? 0} articles</span>
        </div>
        <Link href="/" className="text-sm font-medium text-text-muted">
          Back to feed
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-[26px] bg-slate-200/70">
        {story.heroImage?.url ? (
          <img src={story.heroImage.url} alt={story.title} className="h-64 w-full object-cover sm:h-80" />
        ) : (
          <div className="flex h-64 items-center justify-center text-xs uppercase tracking-[0.24em] text-text-muted sm:h-80">
            Story image pending
          </div>
        )}
      </div>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-[2.25rem] font-semibold leading-tight text-text sm:text-[3rem]">
        {story.title}
      </h1>
      <p className="mt-4 max-w-3xl text-[16px] leading-8 text-text-muted">{story.summary ?? 'Summary will appear here once available.'}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-muted">
        {story.ranking?.storyScore !== null && story.ranking?.storyScore !== undefined ? (
          <span className="soft-surface rounded-full px-4 py-2">Relevance {Number(story.ranking.storyScore).toFixed(2)}</span>
        ) : null}
        <span className="soft-surface rounded-full px-4 py-2">Updated {formatDateTime(story.updatedAt)}</span>
      </div>
    </section>
  );

  const coverageSection = (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-text-muted">Coverage</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">Ranked source coverage</h2>
      </div>

      {articles.length ? (
        <div className="space-y-4">
          {articles.map((article) => (
            <CoverageCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <EmptyState title="No coverage yet" description="This story does not have ranked source items available yet." />
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <PageBanner
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onSearchKeyDown={(event) => {
          if (event.key === 'Enter') {
            const query = searchInput.trim();
            router.push(query ? `/?q=${encodeURIComponent(query)}` : '/');
          }
        }}
        menuItems={[
          { key: 'balanced', label: 'Balanced' },
          { key: 'summary', label: 'Summary' },
          { key: 'coverage', label: 'Coverage' }
        ]}
        activeMenuKey={emphasis}
        onMenuChange={setEmphasis}
      />
      {coverageFirst ? (
        <>
          {coverageSection}
          {summarySection}
        </>
      ) : summaryFirst ? (
        <>
          {summarySection}
          {coverageSection}
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.88fr)_minmax(360px,0.72fr)] 2xl:grid-cols-[minmax(0,2.02fr)_minmax(380px,0.76fr)]">
          <div className="min-w-0 xl:pr-3">{summarySection}</div>
          <div className="min-w-0 xl:max-w-[440px] xl:justify-self-end">{coverageSection}</div>
        </div>
      )}
    </div>
  );
}
