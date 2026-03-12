import { SourceCard } from './SourceCard';

export function SourceAccordionList({ sources, onCandidateSaved }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sources.map((source) => (
        <SourceCard key={`${source.sourceSet}-${source.id}`} source={source} onCandidateSaved={onCandidateSaved} />
      ))}
    </div>
  );
}
