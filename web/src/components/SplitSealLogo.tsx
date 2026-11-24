// SPDX-License-Identifier: Apache-2.0
// Assize — Geometric Split-Seal SVG Mark (Private Sealed Half + Verified Public Half)

export function SplitSealLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="24" height="24" rx="3" stroke="#1B3B6F" strokeWidth="2" />
      <rect x="4" y="4" width="9.5" height="20" rx="1" fill="#1B3B6F" />
      <line x1="14" y1="2" x2="14" y2="26" stroke="#1B3B6F" strokeWidth="1.5" />
      <path d="M17.2 14.2L19.6 16.6L23.5 11.4" stroke="#166534" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
