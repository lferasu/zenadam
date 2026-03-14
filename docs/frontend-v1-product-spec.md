# Zenadam Frontend V1 Product Spec

This document captures the recommended first consumer-facing frontend direction for Zenadam.

The goal is not to clone Google News feature-for-feature. The goal is to replicate the grouped-news usage pattern in a Zenadam-specific, mobile-first product.

## Product goal

Validate the core Zenadam loop:

- open feed
- scan grouped stories
- open one
- understand it quickly
- inspect source coverage
- optionally leave to the original article

If that loop works, the product has a real foundation.

## Product shape

Zenadam V1 should be a story-first consumer app:

- mobile-first
- desktop as a cleaner, roomier extension of mobile
- grouped-story experience
- ranked stories and ranked coverage
- low-friction reading and browsing

## Core routes

### 1. `/`

Primary feed screen.

Responsibilities:

- show ranked grouped stories
- support `Top` and `Latest`
- give users a fast scan-and-open experience

### 2. `/stories/:id`

Story detail screen.

Responsibilities:

- show one grouped story
- show the story summary
- show ranked source-item coverage

### Postpone for later

Do not build these in V1:

- `/topics/:slug`
- `/search`
- source pages
- account/personalization routes

## Home feed

### Purpose

- fast scan
- strong hierarchy
- clear story selection

### Each story card should show

- hero image
- story title
- short story summary
- freshness
- source diversity preview
- possibly article count

### Mobile layout

- single column
- strong image-title-summary rhythm
- large tap area
- minimal chrome

### Desktop layout

- still card-based
- wider cards
- optional 2-column feed only if readability remains strong

### Top bar

- Zenadam wordmark
- feed mode toggle: `Top` / `Latest`
- maybe a simple search icon later

## Story detail

This should be the strongest screen in V1.

### Top section

- hero image
- title
- summary
- freshness
- source count / article count

### Coverage section

Ranked source items/articles.

Each item should show:

- source name
- article title
- article image if available
- short summary or excerpt
- publish time
- `Open original` action

### Optional highlight

Highlight the top-ranked article subtly as:

- `Top source`
- or `Best overview`

This should stay subtle, not noisy.

### Mobile

- stacked layout
- summary first
- coverage list immediately below

### Desktop

- split layout works well
- left: story summary block
- right: coverage list

## Components

### Feed

- `FeedShell`
- `FeedHeader`
- `FeedModeToggle`
- `StoryFeedList`
- `StoryCard`
- `SourcePreviewRow`

### Story detail

- `StoryDetailShell`
- `StoryHero`
- `StorySummaryBlock`
- `CoverageList`
- `CoverageCard`
- `OpenOriginalButton`

### System

- `LoadingState`
- `EmptyState`
- `ErrorRetryState`

## Mobile UX priorities

- reading and scanning first
- minimal chrome
- fast transitions
- strong card rhythm
- no dashboard feel
- no dense admin-like controls

Users should reach useful content immediately.

Avoid:

- oversized headers
- extra panels above the feed
- layout chrome that delays the first story card

## Desktop UX priorities

Desktop should not become a different product.

It should be:

- a roomier version of mobile
- cleaner to scan
- better spaced
- more comfortable for side-by-side story detail reading

Avoid:

- newspaper-portal complexity
- heavy sidebars
- many competing modules

## Visual direction

Target feel:

- calm
- editorial
- modern
- highly readable
- image-supported, not image-dominated

Use:

- soft neutral background
- crisp cards
- strong typography hierarchy
- restrained accent color
- subtle shadows and borders
- clean spacing

Avoid:

- dashboard styling
- loud gradients
- too many chips and badges
- table-like layouts

## Backend/API usage

Use the existing backend story APIs directly.

### Home feed

- `GET /stories?sort=relevant`
- `GET /stories?sort=latest`

### Story detail

- `GET /stories/:id`
- `GET /stories/:id/articles`

The frontend should not invent its own ranking logic. It should use backend ranking directly.

## What to postpone

Do not build these in V1:

- personalization
- auth
- bookmarks
- followed topics
- many topic pages
- source pages
- deep search
- notifications
- broad discovery systems

## What success looks like

After V1, Zenadam should be able to answer:

- does the feed feel useful?
- do grouped stories make sense?
- are summaries good enough?
- are rankings believable?
- does story detail feel better than raw article browsing?
- is mobile browsing pleasant enough to return to?

## Suggested build order

1. Feed page
2. Story card component
3. Top/Latest toggle
4. Story detail page
5. Coverage cards
6. Loading/error/empty polish
7. Desktop refinement

## Strategic note

The backend is already becoming story-centric. That is a strength.

The frontend should lean into that directly. Zenadam V1 should feel like a grouped-news reader, not a generic article feed.

