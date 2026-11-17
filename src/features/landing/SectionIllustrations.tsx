/**
 * Scroll-story cartoons (v0.8.2): three small hand-built flat SVG
 * illustrations, one per landing section. Ink line art with exactly
 * one accent-blue element each, no gradients, no extra colours.
 * They illustrate the idea of their section and nothing else.
 */

const QR5: number[][] = [
  [1, 1, 1, 0, 1],
  [1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 0, 1],
  [1, 0, 1, 1, 1],
];

/** A 5×5 QR grid. The centre cell is accent blue. */
function QrLarge({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {QR5.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={x + c * 12}
              y={y + r * 12}
              width="10"
              height="10"
              fill={r === 2 && c === 2 ? '#0071e3' : '#111111'}
            />
          ) : null,
        ),
      )}
    </g>
  );
}

/** "Show the code." — a projector screen with the QR, and the 6-digit code below it. */
export function CodeIllustration() {
  return (
    <svg
      viewBox="0 0 560 220"
      role="img"
      aria-label="A projector screen showing a QR code and a six-digit code"
      className="h-auto w-full"
    >
      {/* Screen */}
      <rect x="180" y="28" width="200" height="112" rx="8" fill="#ffffff" stroke="#111111" strokeWidth="3" />
      <QrLarge x={250} y={52} />
      {/* Stand */}
      <line x1="240" y1="140" x2="230" y2="172" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <line x1="320" y1="140" x2="330" y2="172" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <line x1="48" y1="172" x2="512" y2="172" stroke="#e5e5e5" strokeWidth="1" />
      {/* The 6-digit code, in plain type */}
      <text
        x="280"
        y="208"
        textAnchor="middle"
        fontSize="28"
        fontWeight="600"
        letterSpacing="8"
        fill="#111111"
      >
        482917
      </text>
    </svg>
  );
}

/** "Only the hall counts." — the 30 m ring around the lecturer. Inside counts; outside does not. */
export function HallCheckIllustration() {
  return (
    <svg
      viewBox="0 0 560 220"
      role="img"
      aria-label="A circle showing the thirty metre area around the lecturer, with students inside it and one person outside it"
      className="h-auto w-full"
    >
      {/* The 30 m ring */}
      <circle cx="280" cy="102" r="76" fill="none" stroke="#111111" strokeWidth="3" strokeDasharray="3 8" />
      {/* The lecturer, at the centre — the accent dot */}
      <circle cx="280" cy="102" r="8" fill="#0071e3" />
      {/* Two students inside the ring */}
      <circle cx="238" cy="76" r="7" fill="#f5f5f7" stroke="#111111" strokeWidth="3" />
      <circle cx="326" cy="130" r="7" fill="#f5f5f7" stroke="#111111" strokeWidth="3" />
      {/* One person outside the ring */}
      <circle cx="452" cy="52" r="7" fill="#86868b" />
      <text x="280" y="210" textAnchor="middle" fontSize="15" fill="#6e6e73">
        30 m
      </text>
    </svg>
  );
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S'];
/** Lecture blocks per day: [column, y, height]. Wednesday's block is the accent one. */
const BLOCKS: Array<{ col: number; y: number; h: number; accent?: boolean }> = [
  { col: 0, y: 60, h: 32 },
  { col: 0, y: 100, h: 32 },
  { col: 1, y: 76, h: 32 },
  { col: 2, y: 60, h: 48, accent: true },
  { col: 3, y: 100, h: 32 },
  { col: 4, y: 60, h: 24 },
  { col: 4, y: 116, h: 32 },
  { col: 5, y: 84, h: 32 },
];

/** "Your week, planned." — Monday to Saturday, one block per lecture. */
export function WeekPlanIllustration() {
  return (
    <svg
      viewBox="0 0 560 220"
      role="img"
      aria-label="A week from Monday to Saturday with one block for each planned lecture"
      className="h-auto w-full"
    >
      {DAYS.map((day, i) => (
        <g key={i}>
          <text x={70 + i * 72 + 33} y="28" textAnchor="middle" fontSize="15" fontWeight="600" fill="#6e6e73">
            {day}
          </text>
          <rect
            x={70 + i * 72}
            y="44"
            width="66"
            height="140"
            rx="8"
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="1"
          />
        </g>
      ))}
      {BLOCKS.map((block, i) => (
        <rect
          key={i}
          x={70 + block.col * 72 + 8}
          y={block.y}
          width="50"
          height={block.h}
          rx="6"
          fill={block.accent ? '#0071e3' : '#ffffff'}
          stroke={block.accent ? 'none' : '#111111'}
          strokeWidth={block.accent ? 0 : 3}
        />
      ))}
    </svg>
  );
}
