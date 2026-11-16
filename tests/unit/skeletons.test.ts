import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  CourseListSkeleton,
  LecturePlanSkeleton,
  OverviewSkeleton,
  SessionListSkeleton,
  SessionWorkspaceSkeleton,
} from '@/components/ui/skeleton';

describe('dashboard skeletons (v0.7.0)', () => {
  it('renders skeleton blocks in the shape of the overview', () => {
    const html = renderToString(createElement(OverviewSkeleton));
    expect(html).toContain('skeleton');
    expect(html).toContain('Loading overview');
    expect(html).toContain('Recent activity');
  });

  it('renders skeleton blocks in the shape of the course list', () => {
    const html = renderToString(createElement(CourseListSkeleton));
    expect(html).toContain('skeleton');
    expect(html).toContain('Loading courses');
  });

  it('renders skeleton rows in the shape of the session table', () => {
    const html = renderToString(createElement(SessionListSkeleton));
    expect(html).toContain('skeleton');
    expect(html).toContain('Loading sessions');
  });

  it('renders the session workspace skeleton with its two sections', () => {
    const html = renderToString(createElement(SessionWorkspaceSkeleton));
    expect(html).toContain('skeleton');
    expect(html).toContain('New session');
    expect(html).toContain('Your sessions');
  });

  it('renders the lecture plan skeleton with its weekday sections', () => {
    const html = renderToString(createElement(LecturePlanSkeleton));
    expect(html).toContain('skeleton');
    expect(html).toContain('Loading your plan');
  });

  it('never shows a spinner while skeleton loading', () => {
    for (const html of [
      renderToString(createElement(OverviewSkeleton)),
      renderToString(createElement(CourseListSkeleton)),
      renderToString(createElement(SessionListSkeleton)),
      renderToString(createElement(LecturePlanSkeleton)),
    ]) {
      expect(html).not.toContain('animate-spin');
    }
  });
});
