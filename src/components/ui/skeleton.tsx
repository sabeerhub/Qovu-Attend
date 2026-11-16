import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

/**
 * Skeleton loading (v0.7.0): grey blocks in the shape of the
 * content that is coming, with a calm opacity pulse — never a
 * spinner, never blank space. The blocks use the same layout,
 * spacing and Card shells as the real content, so the page does
 * not jump when the data arrives. No gradients (design system);
 * the pulse is opacity only (`.skeleton` in globals.css).
 */

function Block({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />;
}

function LoadingLabel({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

/** Mirrors the Overview stat cards + activity card layout. */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading overview">
      <LoadingLabel label="Loading overview…" />
      <Block className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Block className="h-3.5 w-24" />
            </CardHeader>
            <CardContent>
              <Block className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {[0, 1].map((section) => (
            <div key={section}>
              <Block className="mb-2 h-3.5 w-28" />
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Block className="h-4 w-3/4" />
                      <Block className="h-3 w-1/2" />
                    </div>
                    <Block className="h-5 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Courses with no sessions this semester</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Block className="h-4 w-2/3" />
          <Block className="h-3 w-1/2" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Mirrors the course list: header row + a grid of course cards. */
export function CourseListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading courses">
      <LoadingLabel label="Loading courses…" />
      <div className="flex items-center justify-between gap-2">
        <Block className="h-3.5 w-20" />
        <Block className="h-9 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Block className="h-4 w-4/5" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Block className="h-3.5 w-3/5" />
              <Block className="h-3.5 w-2/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the session table: header row + four session rows. */
export function SessionListSkeleton() {
  return (
    <div aria-label="Loading sessions">
      <LoadingLabel label="Loading sessions…" />
      <div className="flex flex-col">
        <div className="flex gap-4 border-b border-line py-2">
          <Block className="h-3 w-1/4" />
          <Block className="h-3 w-16" />
          <Block className="h-3 w-12" />
          <Block className="h-3 w-20" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-3 last:border-b-0">
            <Block className="h-4 w-1/4" />
            <Block className="h-3.5 w-16" />
            <Block className="h-3.5 w-12" />
            <Block className="h-3.5 w-20" />
            <Block className="h-5 w-16" />
            <div className="ml-auto flex gap-2">
              <Block className="h-9 w-20" />
              <Block className="h-9 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the session workspace: new-session form + session list. */
export function SessionWorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-label="Loading sessions">
      <LoadingLabel label="Loading sessions…" />
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">New session</h2>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Block className="h-9 w-full max-w-xs" />
            <Block className="h-9 w-full max-w-xs" />
            <Block className="h-9 w-32" />
          </CardContent>
        </Card>
      </section>
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">Your sessions</h2>
        <SessionListSkeleton />
      </section>
    </div>
  );
}

/** Mirrors the lecture plan: header row + two weekday sections of entry cards. */
export function LecturePlanSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading your plan">
      <LoadingLabel label="Loading your plan…" />
      <div className="flex items-center justify-between gap-2">
        <Block className="h-3.5 w-32" />
        <Block className="h-9 w-28" />
      </div>
      {[0, 1].map((section) => (
        <section key={section}>
          <Block className="mb-3 h-5 w-24" />
          <div className="flex flex-col gap-3">
            {[0, 1].map((row) => (
              <Card key={row}>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-3.5 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
