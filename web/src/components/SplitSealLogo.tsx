// SPDX-License-Identifier: Apache-2.0
// Assize — Geometric Split-Seal SVG Mark & Engraved Municipal Crest
// Left half: Sealed Private Witness · Right half: Verified Public Ledger

export function SplitSealLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="1.75" y="1.75" width="24.5" height="24.5" rx="3" fill="#F8F7F4" stroke="#1B3B6F" strokeWidth="1.8" />
      <rect x="4" y="4" width="9" height="20" rx="1" fill="#1B3B6F" />
      <line x1="6.5" y1="8.5" x2="10.5" y2="8.5" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.65" />
      <line x1="6.5" y1="12" x2="10.5" y2="12" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.65" />
      <line x1="6.5" y1="15.5" x2="9.5" y2="15.5" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.65" />
      <line x1="14" y1="1.75" x2="14" y2="26.25" stroke="#1B3B6F" strokeWidth="1.5" />
      <path
        d="M17.1 14.3L19.5 16.7L23.6 11.3"
        stroke="#166534"
        strokeWidth="2.1"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function SplitSealCrest({ size = 56, contested = false }: { size?: number; contested?: boolean }) {
  const rightAccent = contested ? '#991B1B' : '#166534';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="32" cy="32" r="30" fill="#F8F7F4" stroke="#1B3B6F" strokeWidth="2" />
      <circle cx="32" cy="32" r="26" stroke="#1B3B6F" strokeWidth="0.9" strokeDasharray="2 2" />
      <rect x="15" y="15" width="34" height="34" rx="3" fill="#FFFFFF" stroke="#1B3B6F" strokeWidth="1.75" />
      <rect x="17.5" y="17.5" width="13.5" height="29" rx="1" fill="#1B3B6F" />
      <line x1="20.5" y1="23" x2="28" y2="23" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="20.5" y1="28" x2="28" y2="28" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="20.5" y1="33" x2="26" y2="33" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="20.5" y1="38" x2="28" y2="38" stroke="#F8F7F4" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="32" y1="13" x2="32" y2="51" stroke="#1B3B6F" strokeWidth="1.6" />
      {contested ? (
        <>
          <line x1="37.5" y1="26.5" x2="44.5" y2="37.5" stroke={rightAccent} strokeWidth="2.3" strokeLinecap="square" />
          <line x1="44.5" y1="26.5" x2="37.5" y2="37.5" stroke={rightAccent} strokeWidth="2.3" strokeLinecap="square" />
        </>
      ) : (
        <path
          d="M36.5 32.5L40 36L46 27.5"
          stroke={rightAccent}
          strokeWidth="2.4"
          strokeLinecap="square"
        />
      )}
    </svg>
  );
}
