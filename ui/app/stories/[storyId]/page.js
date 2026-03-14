import { StoryDetailShell } from '@/components/story/StoryDetailShell';

export default async function StoryPage({ params }) {
  const resolved = await params;
  return (
    <div className="mx-auto w-full max-w-[1480px]">
      <StoryDetailShell storyId={resolved.storyId} />
    </div>
  );
}
