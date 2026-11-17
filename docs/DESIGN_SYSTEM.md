# Design System — UniAttend

## Direction

Apple-level minimalist. Quiet, confident, and out of the way. The
interface should feel like a well-made utility, not a showcase.
White/light background, clear typography, strong hierarchy, restrained
color, generous whitespace. **No AI slop.**

Explicitly forbidden in this product:

- Gradients of any kind (especially purple/blue gradient blobs).
- Glassmorphism, frosted panels, heavy shadows, glow effects —
  with ONE owner-approved exception (v0.13.1, deepened in
  v0.13.2): the mobile pill navigation below is real Apple
  liquid glass, because the owner asked for exactly that look.
  The glass lives only in that one pill; nothing else frosts.
- Oversized decorative icons, illustration packs, emoji in the UI.
- Cluttered dashboards, stat-card walls, unnecessary animation.
- More than one accent color, and the accent used for decoration
  rather than action.

## Color

| Token | Value | Use |
|---|---|---|
| Background | `#ffffff` | Page background |
| Canvas | `#f5f5f7` | App canvas behind content, sidebar |
| Text | `#111111` | Primary text |
| Secondary text | `#6e6e73` | Descriptions, metadata |
| Faint text | `#86868b` | Placeholders, captions |
| Border | `#e5e5e5` | 1px hairlines, card borders |
| Accent | `#0071e3` | Primary actions and links only |
| Accent hover | `#0077ed` | Hover state |
| Accent pressed | `#0060c5` | Pressed state |
| Success | `#1d7a3d` | Success text / status dot |
| Danger | `#c9242e` | Destructive actions, errors |
| Warning | `#8a5a00` | Warnings |

Neutrals only, plus one blue. Status is shown with a small dot and a
word (`Active`, `Finalized`), not with a loud colored chip.

## Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text",
  "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial,
  sans-serif`. No webfont download is required; use the system font.
- Page title: 24px, weight 600, tight letter spacing.
- Section title: 17px, weight 600.
- Body: 15px, weight 400, line height 1.5 — 17px on phones (v0.13.0, iOS type scale).
- Secondary / caption: 13px, `#6e6e73`.
- Numbers in summaries: 34px, weight 600 — plain, no colored
  backgrounds behind them (Overview stat card, v0.13.1).

## Spacing

8px scale: 4, 8, 16, 24, 32, 48, 64. Content max width 1120px.
Page padding: 24px on desktop, 16px on mobile. Cards have 16–24px
internal padding.

## Components

- **Radius:** 8px small controls, 10px cards, 12px large panels.
- **Borders:** 1px `#e5e5e5`. Shadow: at most `0 1px 2px
  rgba(0,0,0,0.04)` on cards. No other shadows.
- **Buttons:** primary = solid `#0071e3`, white text, 8px radius,
  height 44px on phones / 36px on desktop (v0.13.0, 44pt iOS
  touch target), 17px label on phones / 14px on desktop.
  Secondary = white, 1px border. Destructive = text /
  border in `#c9242e`, never a solid red block. Disabled = 40%
  opacity, no pointer events.
- **Inputs:** white, 1px `#e5e5e5` border, 8px radius, 44px height
  on phones / 36px on desktop, 16px text on phones (16px is what
  stops iOS Safari auto-zooming on focus) / 14px on desktop,
  focus ring `2px rgba(0,113,227,0.35)`.
- **Tables:** plain rows, 1px bottom hairline, 13–14px text, header
  in 12px uppercase secondary text. No zebra striping, no colored
  row backgrounds. On phones (v0.13.0) tables become stacked card
  rows — never a sideways scroll with tiny text.
- **Sidebar (desktop):** 240px, `#f5f5f7` background, 15px nav items,
  active item is `#111111` text with a white pill background — not a
  colored bar.
- **Mobile (v0.13.2):** real Apple liquid glass in our colors —
  a floating pill tab bar, centred, floating 16px above the safe
  area, fully rounded. The material is layered, not flat:
  translucent white (65%) + strong blur and saturation, a
  hairline border, a bright inset top highlight (the specular
  rim), a soft inner bottom shadow for depth, and one soft drop
  shadow underneath; a slow sheen (a soft blurred white shape)
  drifts across the pill on a 7s loop. The active item is a
  glassy blue pill-within-a-pill that GLIDES slot to slot on a
  springy 450ms transform transition, carrying the active icon +
  label with it; a tap squashes the pressed item slightly
  (~150ms press morph). Reduced motion: static glass, static
  highlight, no sheen, no press morph. Four tabs (Overview,
  Courses, Sessions, History) plus a "More" tab that opens a
  bottom sheet with the remaining sections; the sheet also
  carries a Sign out row (log-out icon + label, danger color).
  Active tab: accent-blue icon + small label inside the gliding
  glass pill; inactive tabs: ink icon only, with the section name
  as the button's aria-label (screen readers still hear it). No
  gradients, no dark pill. The glass lives only in this pill —
  the owner-approved exception to the no-glassmorphism rule.
  Phone rules (v0.13.0): 44pt minimum touch targets, primary
  actions full-width and thumb-friendly at the bottom of the
  screen, safe-area insets respected (notch / home indicator —
  needs `viewport-fit=cover`), tables as stacked cards, 17px
  body copy, 16px form text (no iOS zoom on focus).
- **Sign out** is an icon action everywhere (v0.13.1): a
  log-out icon button in the header (icon-only, aria-label
  "Sign out"), an icon + "Sign out" row in the More sheet, and
  an icon + "Sign out" full-width row on the Profile screen. It
  signs out immediately — there is no confirmation step.
- **Status:** a 6px dot + label text.

## States (every screen must handle all four)

- **Loading:** a single centered spinner or skeleton lines in the
  content area; no fake content while loading.
- **Empty:** a short sentence and one action, e.g. “No attendance
  sessions yet. Create your first session.” Nothing decorative.
- **Error:** a plain sentence explaining what happened and what to
  do next, plus a retry action.
- **Success:** a one-line confirmation, no modal fireworks.

## Layout

- Mobile-first. One column on mobile, sidebar + content from 768px.
- Desktop sidebar navigation; mobile navigation bar.
- No hardcoded statistics anywhere: every number on the Overview
  comes from a database query, and the empty state is shown when
  there is no data.

## Accessibility

- Semantic headings, labels on every input, focus-visible outlines.
- Color is never the only signal (status always has text).
- Minimum touch target 44pt on phones, 36px on desktop (v0.13.0);
  text contrast meets WCAG AA.
