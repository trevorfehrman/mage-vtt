export function VideoPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-3">
      <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-center">
        <p className="text-muted-foreground text-sm">Video coming soon</p>
      </div>
    </div>
  )
}
