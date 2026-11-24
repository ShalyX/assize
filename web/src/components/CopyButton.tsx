// SPDX-License-Identifier: Apache-2.0
// Assize — Accessible Copy-to-Clipboard Control & Truncated Hash Display
// Uses genuine Clipboard API without synthetic timers.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({
  value,
  label = 'Copy',
  ariaLabel,
  compact = false,
}: {
  value: string;
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const isCopied = copiedValue === value && Boolean(value);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!value || /^0+$/.test(value) || value === '—') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
    } catch {
      // Fallback for restricted contexts
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedValue(value);
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn ${isCopied ? 'copied' : ''} ${compact ? 'copy-btn-compact' : ''}`}
      onClick={(e) => void handleCopy(e)}
      onBlur={() => setCopiedValue(null)}
      aria-label={isCopied ? 'Copied to clipboard' : ariaLabel ?? `Copy ${label}`}
      title={isCopied ? 'Copied to clipboard' : `Copy ${value}`}
    >
      {isCopied ? <Check size={12} /> : <Copy size={12} />}
      <span>{isCopied ? 'Copied' : compact ? '' : label}</span>
    </button>
  );
}

export function CopyableHash({
  hex,
  prefixChars = 8,
  suffixChars = 6,
  with0x = true,
  label = 'hash',
}: {
  hex: string | null | undefined;
  prefixChars?: number;
  suffixChars?: number;
  with0x?: boolean;
  label?: string;
}) {
  if (!hex || /^0+$/.test(hex) || hex === '—') {
    return <span className="mono text-muted">—</span>;
  }
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const display =
    clean.length <= prefixChars + suffixChars + 2
      ? `${with0x ? '0x' : ''}${clean}`
      : `${with0x ? '0x' : ''}${clean.slice(0, prefixChars)}…${clean.slice(-suffixChars)}`;

  return (
    <span className="hash-inline">
      <span className="mono">{display}</span>
      <CopyButton value={hex} ariaLabel={`Copy ${label}`} compact />
    </span>
  );
}
