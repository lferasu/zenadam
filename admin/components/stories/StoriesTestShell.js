'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorRetryState } from '@/components/ui/ErrorRetryState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getStoryArticles, listStories } from '@/services/adminApi';

const toSummary = (value) => {
  if (!value) {
    return 'No summary available yet.';
  }

  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
};

const formatScore = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '--';
};

const formatDate = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
};

function RankingPill({ label, value }) {
  return (
    <span className="panel-subtle rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">
      {label}: {value}
    </span>
  );
}

function StoryArticleCard({ article }) {
  return (
    <article className="panel-subtle rounded-[20px] p-3">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-strong">
          {article.image?.url ? (
            <img src={article.image.url} alt={article.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.18em] text-text-muted">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {article.isPrimary ? (
              <span className="rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Primary
              </span>
            ) : null}
            <RankingPill label="Score" value={formatScore(article.storyItemScore)} />
          </div>
          <h4 className="text-[15px] font-semibold leading-6 text-text">{article.title}</h4>
          <p className="mt-1 text-sm leading-6 text-text-muted">{toSummary(article.summary)}</p>
        </div>
      </div>
    </article>
  );
}

function StoryCard({ story, isOpen, onToggle, articleState }) {
  return (
    <article className="card-surface rounded-[24px] p-4 sm:p-5">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-strong sm:h-24 sm:w-24">
          {story.heroImage?.url ? (
            <img src={story.heroImage.url} alt={story.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.18em] text-text-muted">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="panel-subtle rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {story.articleCount ?? 0} items
            </span>
            <RankingPill label="Story" value={formatScore(story.ranking?.storyScore)} />
            <RankingPill label="Recent" value={formatScore(story.ranking?.signals?.recencyScore)} />
            <RankingPill label="Velocity" value={formatScore(story.ranking?.signals?.velocityScore)} />
          </div>
          <h3 className="mt-3 text-xl font-semibold leading-tight text-text sm:text-2xl">{story.title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">{toSummary(story.summary)}</p>
          <p className="mt-2 text-xs leading-5 text-text-muted">Latest activity: {formatDate(story.ranking?.sortLatestAt)}</p>
        </div>
        <span className="panel-subtle shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {isOpen ? 'Collapse' : 'Open'}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4 border-t border-line pt-4">
          {articleState.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="panel-subtle animate-pulse rounded-[20px] p-3">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 rounded-2xl bg-surface-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 rounded-full bg-surface-muted" />
                      <div className="h-4 w-full rounded-full bg-surface-muted" />
                      <div className="h-4 w-5/6 rounded-full bg-surface-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : articleState.error ? (
            <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm leading-6 text-danger">
              {articleState.error}
            </div>
          ) : (
            <div className="space-y-3">
              {(articleState.articles ?? []).map((article) => (
                <StoryArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function StoriesTestShell() {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openStoryId, setOpenStoryId] = useState(null);
  const [articlesByStoryId, setArticlesByStoryId] = useState({});
  const [sortMode, setSortMode] = useState('relevant');

  const loadStories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listStories({ limit: 30, sort: sortMode });
      setStories(data ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, [sortMode]);

  const sortSummary = useMemo(
    () =>
      sortMode === 'relevant'
        ? 'Hybrid ranking using recency, source quality, popularity, diversity, and velocity.'
        : 'Newest story activity first, with ranking score as the tiebreaker.',
    [sortMode]
  );

  const handleToggle = async (storyId) => {
    if (openStoryId === storyId) {
      setOpenStoryId(null);
      return;
    }

    setOpenStoryId(storyId);

    if (articlesByStoryId[storyId]) {
      return;
    }

    setArticlesByStoryId((current) => ({
      ...current,
      [storyId]: { isLoading: true, error: null, articles: [] }
    }));

    try {
      const payload = await getStoryArticles(storyId);
      setArticlesByStoryId((current) => ({
        ...current,
        [storyId]: {
          isLoading: false,
          error: null,
          articles: payload?.articles ?? []
        }
      }));
    } catch (loadError) {
      setArticlesByStoryId((current) => ({
        ...current,
        [storyId]: {
          isLoading: false,
          error: loadError.message,
          articles: []
        }
      }));
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorRetryState
        title="Could not load stories"
        description="This is only a quick validation page, so retry and keep going."
        onRetry={loadStories}
      />
    );
  }

  if (!stories.length) {
    return (
      <EmptyState
        title="No stories available yet"
        description="Once clustered stories exist, you can inspect them here with article thumbnails and summaries."
        action={
          <Link
            href="/sources"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast"
          >
            Back to sources
          </Link>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="panel-subtle rounded-[22px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Story test</p>
            <h2 className="mt-2 text-2xl font-semibold text-text">Quick story review</h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">{sortSummary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="ghost-surface inline-flex rounded-full p-1">
              {['relevant', 'latest'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    sortMode === mode ? 'bg-accent text-accent-contrast shadow-[0_10px_24px_rgba(34,197,94,0.18)]' : 'text-text-muted'
                  }`}
                >
                  {mode === 'relevant' ? 'Relevant' : 'Latest'}
                </button>
              ))}
            </div>
            <Link
              href="/sources"
              className="ghost-surface inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-text"
            >
              Back to sources
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            isOpen={openStoryId === story.id}
            onToggle={() => handleToggle(story.id)}
            articleState={articlesByStoryId[story.id] ?? { isLoading: false, error: null, articles: [] }}
          />
        ))}
      </div>
    </section>
  );
}
