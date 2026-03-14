'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorRetryState } from '@/components/ui/ErrorRetryState';
import { LoadingState } from '@/components/ui/LoadingState';
import { clampText, formatRelativeTime } from '@/lib/utils';
import { getStoryArticles, listStories } from '@/services/publicApi';

const PAGE_SIZE = 12;

function LeadStoryCard({ story }) {
  return (
    <Link href={`/stories/${story.id}`} className="group block">
      <div className="overflow-hidden rounded-[16px] bg-slate-200/70">
        {story.heroImage?.url ? (
          <img
            src={story.heroImage.url}
            alt={story.title}
            className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-60"
          />
        ) : (
          <div className="flex h-52 items-center justify-center text-xs uppercase tracking-[0.22em] text-text-muted sm:h-60">
            Story image pending
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <span className="font-medium text-text">{story.sourcePreview?.[0] ?? 'Zenadam'}</span>
        <span aria-hidden="true">&bull;</span>
        <span>{formatRelativeTime(story.latestPublishedAt)}</span>
      </div>

      <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.95rem] font-semibold leading-tight tracking-[-0.03em] text-text sm:text-[2.2rem]">
        {clampText(story.title, 120)}
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-text-muted">{clampText(story.summary, 190)}</p>
    </Link>
  );
}

function CoveragePreviewCard({ article, compact = false }) {
  return (
    <Link
      href={`/stories/${article.storyId}`}
      className={`block rounded-[18px] bg-white/45 transition duration-200 hover:bg-white/65 ${
        compact ? 'min-w-[280px] p-3.5' : 'p-3.5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`overflow-hidden rounded-[16px] bg-slate-200/70 ${compact ? 'h-18 w-18 shrink-0' : 'h-18 w-22 shrink-0'}`}>
          {article.image?.url ? (
            <img src={article.image.url} alt={article.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.18em] text-text-muted">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="font-medium text-text">{article.sourceName ?? 'Unknown source'}</span>
            <span aria-hidden="true">&bull;</span>
            <span>{formatRelativeTime(article.publishedAt)}</span>
          </div>
          <h3 className="mt-2 text-[1rem] font-medium leading-6 text-text">{clampText(article.title, compact ? 92 : 110)}</h3>
          {article.byline ? <p className="mt-2 text-sm text-text-muted">{clampText(article.byline, 64)}</p> : null}
        </div>
      </div>
    </Link>
  );
}

function SingleArticleStoryCard({ story, article, loading }) {
  return (
    <article className="min-w-0">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-start">
        <div className="min-w-0">
          <Link href={`/stories/${story.id}`} className="block">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <span className="font-medium text-text">{article?.sourceName ?? story.sourcePreview?.[0] ?? 'Zenadam'}</span>
              <span aria-hidden="true">&bull;</span>
              <span>{formatRelativeTime(article?.publishedAt ?? story.latestPublishedAt)}</span>
            </div>

            <h2 className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-[1.85rem] font-semibold leading-tight tracking-[-0.03em] text-text sm:text-[2.05rem]">
              {clampText(story.title, 130)}
            </h2>
          </Link>
        </div>

        <div className="flex items-start gap-3 sm:flex-col sm:items-end">
          <Link href={`/stories/${story.id}`} className="overflow-hidden rounded-[18px] bg-slate-200/70 sm:h-28 sm:w-28">
            {loading ? (
              <div className="flex h-24 w-24 items-center justify-center text-[10px] uppercase tracking-[0.18em] text-text-muted sm:h-full sm:w-full">
                Loading
              </div>
            ) : article?.image?.url || story.heroImage?.url ? (
              <img
                src={article?.image?.url ?? story.heroImage?.url}
                alt={story.title}
                className="h-24 w-24 object-cover sm:h-full sm:w-full"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center text-[10px] uppercase tracking-[0.18em] text-text-muted sm:h-full sm:w-full">
                No image
              </div>
            )}
          </Link>

          <Link
            href={`/stories/${story.id}`}
            className="flex min-h-11 items-center justify-center rounded-full border border-border/80 bg-white/40 px-4 text-base font-medium text-text transition hover:border-border-strong hover:bg-white/70"
          >
            See more
          </Link>
        </div>
      </div>
    </article>
  );
}

function StoryClusterCard({ story, articles, previewsLoading }) {
  const previewArticles = articles.slice(0, 3);

  return (
    <article className="feed-surface feed-separator px-1 py-5 sm:py-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
        <div>
          <LeadStoryCard story={story} />
        </div>

        <div className="space-y-3">
          <div className="hidden lg:block">
            {previewsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-[18px] bg-white/45 p-3.5">
                    <div className="h-4 w-28 rounded-full bg-slate-200/80" />
                    <div className="mt-4 h-4 w-full rounded-full bg-slate-200/80" />
                    <div className="mt-2 h-4 w-4/5 rounded-full bg-slate-200/80" />
                  </div>
                ))}
              </div>
            ) : previewArticles.length ? (
              <div className="space-y-3">
                {previewArticles.map((article) => (
                  <CoveragePreviewCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] bg-white/45 px-4 py-5 text-sm text-text-muted">
                Coverage previews will appear here once related source items are available.
              </div>
            )}
          </div>

          <div className="-mx-1 overflow-x-auto pb-1 lg:hidden">
            <div className="flex gap-3 px-1">
              {previewsLoading ? (
                [0, 1].map((item) => (
                  <div key={item} className="min-w-[280px] rounded-[18px] bg-white/45 p-3.5">
                    <div className="h-4 w-28 rounded-full bg-slate-200/80" />
                    <div className="mt-4 h-4 w-full rounded-full bg-slate-200/80" />
                    <div className="mt-2 h-4 w-4/5 rounded-full bg-slate-200/80" />
                  </div>
                ))
              ) : previewArticles.length ? (
                previewArticles.slice(0, 2).map((article) => <CoveragePreviewCard key={article.id} article={article} compact />)
              ) : (
                <div className="min-w-[280px] rounded-[18px] bg-white/45 px-4 py-5 text-sm text-text-muted">
                  Coverage previews will appear here once related source items are available.
                </div>
              )}
            </div>
          </div>

          <Link
            href={`/stories/${story.id}`}
            className="flex min-h-11 items-center justify-center rounded-full border border-border/80 bg-white/40 px-5 text-base font-medium text-text transition hover:border-border-strong hover:bg-white/70"
          >
            See more headlines &amp; perspectives
          </Link>
        </div>
      </div>
    </article>
  );
}

export function FeedShell() {
  const loadMoreRef = useRef(null);
  const [sortMode, setSortMode] = useState('relevant');
  const [stories, setStories] = useState([]);
  const [storyArticles, setStoryArticles] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const queryFromUrl = new globalThis.URLSearchParams(globalThis.location?.search ?? '').get('q') ?? '';
    setSearchInput(queryFromUrl);
    setServerQuery(queryFromUrl.trim());
  }, []);

  const loadStories = async ({ mode = sortMode, query = serverQuery, initial = false, append = false } = {}) => {
    const skip = append ? stories.length : 0;

    if (initial) {
      setIsLoading(true);
    } else if (append) {
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const payload = await listStories({ sort: mode, limit: PAGE_SIZE, skip, query });
      const nextStories = payload?.data ?? [];
      const pagination = payload?.meta?.pagination ?? {};

      setHasMore(Boolean(pagination.hasMore));

      if (append) {
        setStories((current) => [...current, ...nextStories.filter((story) => !current.some((existing) => existing.id === story.id))]);
      } else {
        setStories(nextStories);
      }

      if (!nextStories.length) {
        if (!append) {
          setStoryArticles({});
        }
        return;
      }

      const articleEntries = await Promise.all(
        nextStories.map(async (story) => {
          try {
            const articlePayload = await getStoryArticles(story.id);
            const articles = (articlePayload?.articles ?? []).map((article) => ({
              ...article,
              storyId: story.id
            }));
            return [story.id, articles];
          } catch {
            return [story.id, []];
          }
        })
      );

      setStoryArticles((current) => ({
        ...(append ? current : {}),
        ...Object.fromEntries(articleEntries)
      }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setServerQuery(searchInput.trim());
    }, 220);

    return () => globalThis.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    loadStories({ mode: sortMode, query: serverQuery, initial: stories.length === 0 && !error });
  }, [sortMode, serverQuery]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoading || isRefreshing || isLoadingMore) {
      return undefined;
    }

    const observer = new globalThis.IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadStories({ mode: sortMode, query: serverQuery, append: true });
        }
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoading, isRefreshing, isLoadingMore, sortMode, serverQuery, stories.length]);

  const visibleStories = useMemo(() => {
    const normalizedQuery = searchInput.trim().toLowerCase();
    if (!normalizedQuery) {
      return stories;
    }

    return stories.filter((story) => {
      const haystack = [story.title, story.summary, ...(story.sourcePreview ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [stories, searchInput]);

  const storyRows = useMemo(() => {
    const rows = [];
    const singletonBuffer = [];

    const flushSingletons = () => {
      while (singletonBuffer.length) {
        rows.push({
          type: 'singletons',
          items: singletonBuffer.splice(0, 2)
        });
      }
    };

    visibleStories.forEach((story) => {
      const articles = storyArticles[story.id] ?? [];
      const previewsLoading = !storyArticles[story.id];
      const isSingleArticleStory = !previewsLoading && articles.length === 1;

      if (isSingleArticleStory) {
        singletonBuffer.push({
          story,
          article: articles[0]
        });
        return;
      }

      flushSingletons();
      rows.push({
        type: 'cluster',
        story,
        articles,
        previewsLoading
      });
    });

    flushSingletons();
    return rows;
  }, [visibleStories, storyArticles]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorRetryState
        title="Could not load the Zenadam feed"
        description="The grouped story feed did not arrive cleanly. Retry and keep the product surface moving."
        onRetry={() => loadStories({ mode: sortMode, query: serverQuery, initial: true })}
      />
    );
  }

  if (!stories.length) {
    return (
      <EmptyState
        title="No grouped stories yet"
        description="Once the backend pipeline has generated stories, they will appear here in the consumer feed."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageBanner
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        menuItems={[
          { key: 'relevant', label: 'Top' },
          { key: 'latest', label: 'Latest' }
        ]}
        activeMenuKey={sortMode}
        onMenuChange={setSortMode}
      />

      <section className="shell-panel rounded-[30px] px-4 py-2 sm:px-6">
        {isRefreshing ? <div className="px-1 py-3 text-sm text-text-muted">Refreshing search results...</div> : null}
        {visibleStories.length ? (
          storyRows.map((row, index) => {
            if (row.type === 'singletons') {
              return (
                <div key={`singletons-${index}`} className="feed-surface feed-separator px-1 py-5 sm:py-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    {row.items.map((item) => (
                      <SingleArticleStoryCard key={item.story.id} story={item.story} article={item.article} loading={false} />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <StoryClusterCard
                key={row.story.id}
                story={row.story}
                articles={row.articles}
                previewsLoading={row.previewsLoading}
              />
            );
          })
        ) : (
          <div className="px-1 py-10">
            <EmptyState
              title="No stories match this search"
              description="Try a different story topic, source name, or keyword from the coverage."
            />
          </div>
        )}
        {visibleStories.length && hasMore ? <div ref={loadMoreRef} className="h-12" aria-hidden="true" /> : null}
        {isLoadingMore ? <div className="px-1 py-3 text-sm text-text-muted">Loading more stories...</div> : null}
      </section>
    </div>
  );
}
