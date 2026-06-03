export default function LoaderDots() {
  return (
    <span className="inline-flex items-center justify-center gap-1" aria-label="Loading">
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:240ms]" />
    </span>
  );
}
