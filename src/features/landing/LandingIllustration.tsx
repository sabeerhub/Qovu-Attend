/**
 * Landing illustration (v0.8.1): one small hand-built flat SVG
 * cartoon — a lecturer holding up a phone with the QR code, two
 * students scanning it. Line art in ink `#111111` with a single
 * accent-blue square in the lecturer's QR (the Qovu dot, nodding
 * to the mark). No gradients, no extra colours, no decoration
 * beyond the scene itself. It supports the hero; it never crowds
 * it.
 */

const QR_CELLS: Array<[number, number]> = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
];

/** A tiny 3×3 QR grid. The centre cell is accent blue when `accent`. */
function QrMini({ x, y, accent = false }: { x: number; y: number; accent?: boolean }) {
  return (
    <g>
      {QR_CELLS.map(([row, col]) => (
        <rect key={`${row}-${col}`} x={x + col * 5} y={y + row * 5} width="4" height="4" fill="#111111" />
      ))}
      <rect x={x + 5} y={y + 5} width="4" height="4" fill={accent ? '#0071e3' : '#111111'} />
    </g>
  );
}

export function LandingIllustration() {
  return (
    <svg
      viewBox="0 0 560 200"
      role="img"
      aria-label="A lecturer showing a QR code and students scanning it"
      className="h-auto w-full"
    >
      {/* Ground hairline */}
      <line x1="48" y1="172" x2="512" y2="172" stroke="#e5e5e5" strokeWidth="1" />
      {/* The scan, suggested — a quiet dashed arc from the lecturer's phone to the students */}
      <path
        d="M 196 84 Q 280 42 366 76"
        fill="none"
        stroke="#86868b"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />

      {/* Lecturer, left — holding the phone up */}
      <circle cx="120" cy="62" r="15" fill="#f5f5f7" stroke="#111111" strokeWidth="3" />
      <path
        d="M 100 172 V 128 Q 100 110 120 110 Q 140 110 140 128 V 172"
        fill="#ffffff"
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="137" y1="122" x2="162" y2="96" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <rect x="158" y="62" width="24" height="38" rx="5" fill="#ffffff" stroke="#111111" strokeWidth="3" />
      <QrMini x={163} y={71} accent />

      {/* Student one, centre-right — phone up, scanning */}
      <circle cx="392" cy="76" r="13" fill="#f5f5f7" stroke="#111111" strokeWidth="3" />
      <path
        d="M 374 172 V 138 Q 374 122 392 122 Q 410 122 410 138 V 172"
        fill="#ffffff"
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="378" y1="132" x2="360" y2="106" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <rect x="344" y="72" width="22" height="34" rx="5" fill="#ffffff" stroke="#111111" strokeWidth="3" />
      <QrMini x={347} y={80} />

      {/* Student two, right — looking at their own phone */}
      <circle cx="474" cy="84" r="13" fill="#f5f5f7" stroke="#111111" strokeWidth="3" />
      <path
        d="M 456 172 V 144 Q 456 130 474 130 Q 492 130 492 144 V 172"
        fill="#ffffff"
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="462" y1="140" x2="448" y2="122" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <rect x="434" y="94" width="20" height="30" rx="5" fill="#ffffff" stroke="#111111" strokeWidth="3" />
      <QrMini x={438} y={101} />
    </svg>
  );
}
