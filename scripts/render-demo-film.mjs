#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assize — 2.5-Minute Problem-First Product Film Renderer (1920x1080p, 30fps, BT.709, AAC)

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEMO_DIR = path.join(ROOT, 'demo');
const SCENES_DIR = path.join(DEMO_DIR, 'scenes');
const FRAMES_DIR = path.join(DEMO_DIR, 'frames');
const AUDIO_DIR = path.join(DEMO_DIR, 'audio');
const CLIPS_DIR = path.join(DEMO_DIR, 'clips');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG =
  'C:\\Users\\USER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';
const FFPROBE =
  'C:\\Users\\USER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffprobe.exe';

for (const d of [SCENES_DIR, FRAMES_DIR, AUDIO_DIR, CLIPS_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden;
    background: #F8F7F4; color: #14191F;
    font-family: 'Segoe UI', Inter, -apple-system, sans-serif;
  }
  .serif { font-family: Georgia, 'Times New Roman', serif; }
  .mono { font-family: Consolas, 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  .frame {
    width: 1920px; height: 1080px; padding: 64px 88px 136px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative;
  }
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #E4E1DA; padding-bottom: 20px;
  }
  .brand { display: flex; align-items: center; gap: 16px; }
  .kicker {
    font-family: Consolas, monospace; font-size: 16px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #1B3B6F;
  }
  h1 {
    font-family: Georgia, serif; font-size: 64px; line-height: 1.1; font-weight: 700;
    margin: 14px 0 18px; letter-spacing: -0.02em; color: #14191F;
  }
  h2 {
    font-family: Georgia, serif; font-size: 50px; line-height: 1.14; font-weight: 700;
    margin: 10px 0 16px; letter-spacing: -0.015em; color: #14191F;
  }
  .lead { font-size: 24px; line-height: 1.5; color: #4E5863; margin: 0; max-width: 1320px; }
  .sheet {
    background: #FFFFFF; border: 1.5px solid #E4E1DA; border-radius: 8px; padding: 28px 32px;
  }
  .sheet-navy { border-left: 5px solid #1B3B6F; }
  .sheet-crimson { background: #FEF2F2; border-color: #FECACA; border-left: 5px solid #991B1B; }
  .sheet-green { background: #ECFDF5; border-color: #BBF7D0; border-left: 5px solid #166534; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .split { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 36px; align-items: center; }
  .tag {
    display: inline-block; padding: 6px 14px; border-radius: 4px;
    font-family: Consolas, monospace; font-size: 15px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .tag-navy { background: #EEF3FA; color: #1B3B6F; border: 1px solid #C7D7EF; }
  .tag-green { background: #ECFDF5; color: #166534; border: 1px solid #BBF7D0; }
  .tag-crimson { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
  .metric { font-family: Consolas, monospace; font-size: 52px; font-weight: 700; color: #1B3B6F; }
  .shot {
    border: 2px solid #CFC9BE; border-radius: 8px; overflow: hidden;
    background: #FFFFFF; box-shadow: 0 12px 32px rgba(20,25,31,0.08);
  }
  .shot img { display: block; width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 19px; }
  th {
    text-align: left; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em;
    color: #4E5863; background: #F1EFE9; padding: 14px 18px; border-bottom: 1.5px solid #E4E1DA;
  }
  td { padding: 15px 18px; border-bottom: 1px solid #E4E1DA; }
  .caption-bar {
    position: absolute; left: 0; right: 0; bottom: 0; height: 104px;
    background: #14191F; color: #F8F7F4; padding: 20px 88px;
    display: flex; align-items: center; justify-content: space-between; gap: 32px;
    border-top: 3px solid #1B3B6F;
  }
  .caption-text { font-size: 22px; line-height: 1.38; color: #F8F7F4; max-width: 1540px; }
  .scene-badge {
    font-family: Consolas, monospace; font-size: 15px; color: #93C5FD; white-space: nowrap;
  }
`;

const LOGO_SVG = `
  <svg width="42" height="42" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="2" width="11" height="24" rx="2" fill="#1B3B6F" />
    <rect x="15" y="2" width="11" height="24" rx="2" fill="#F1EFE9" stroke="#1B3B6F" stroke-width="1.5" />
    <path d="M18.2 14.2L20.1 16.1L23.5 12" stroke="#166534" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="14" y1="2" x2="14" y2="26" stroke="#F8F7F4" stroke-width="1.5" />
  </svg>
`;

const SCENES = [
  {
    id: 's01',
    badge: '01 / 07 · THE PROBLEM',
    narration:
      'Public procurement accounts for twelve to thirteen percent of global G D P, and O E C D studies show bid rigging inflates contract prices by twenty percent or more. Governments face a painful paradox: publish every losing bid and cartels police their members; keep bids secret and corrupt officials steer contracts to preferred incumbents.',
    caption:
      'Public procurement is 12–13% of global GDP (OECD), with 20%+ bid-rigging inflation — trapped between cartel-enabling transparency and opaque favoritism.',
    body: `
      <div>
        <div class="kicker">01 · The $13 Trillion Transparency Paradox</div>
        <h1>Open bids fuel cartels.<br/>Closed bids hide favoritism.</h1>
        <p class="lead">Public agencies are forced to choose between exposing losing contractors' cost structures or asking taxpayers to trust unverified closed-door awards.</p>
      </div>
      <div class="grid-3">
        <div class="sheet sheet-navy">
          <div class="metric">12–13%</div>
          <div style="font-size:20px;color:#4E5863;margin-top:10px"><strong>Share of global GDP</strong> awarded through public procurement (OECD)</div>
        </div>
        <div class="sheet sheet-crimson">
          <div class="metric" style="color:#991B1B">20%+</div>
          <div style="font-size:20px;color:#4E5863;margin-top:10px"><strong>Price inflation</strong> caused by collusive bid-rigging cartels (OECD)</div>
        </div>
        <div class="sheet sheet-navy">
          <div class="metric">CA PCC</div>
          <div style="font-size:20px;color:#4E5863;margin-top:10px"><strong>§§ 10180, 20128, 20162 &amp; 4101</strong> mandate objective lowest-bidder awards &amp; anti-bid-shopping</div>
        </div>
      </div>
    `,
  },
  {
    id: 's02',
    badge: '02 / 07 · HONEST PRIVACY BOUNDARY',
    narration:
      'Assize resolves this paradox natively on Midnight. Losing contractor prices remain confidential against competing bidders, the public, and blockchain observers forever. Only the authorized procurement adjudicator decrypts openings after the bidding deadline, while Midnight zero-knowledge circuits mathematically enforce fair complete-set adjudication.',
    caption:
      'Assize keeps losing bids confidential against rivals, the public, and blockchain observers — while binding the adjudicator to verifiable ZK rules.',
    body: `
      <div>
        <div class="kicker">02 · Verifiable Sealed-Bid Procurement on Midnight</div>
        <h2>Confidential against rivals &amp; chain. Accountable in zero knowledge.</h2>
      </div>
      <div class="sheet" style="padding:0;overflow:hidden">
        <table>
          <thead>
            <tr><th>Actor</th><th>OPEN (Pre-Deadline)</th><th>REVEAL (Post-Deadline)</th><th>AWARDED / CONTESTED</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Competing Bidders</strong></td><td>Opaque commitments &amp; nullifier count</td><td>SHA-256 opening receipts only</td><td>Winner price &amp; reason codes; <strong>zero losing prices</strong></td></tr>
            <tr><td><strong>Public &amp; Chain</strong></td><td>Frozen parameters &amp; prequal Merkle root</td><td>Frozen commitment root &amp; receipt flags</td><td>Complete-set ZK proof; <strong>zero losing prices</strong></td></tr>
            <tr><td><strong>Authorized Adjudicator</strong></td><td><strong>Sees ZERO plaintext bids</strong></td><td>Decrypts off-chain WebCrypto envelopes</td><td>Must prove exhaustive <span class="mono">proveAward</span> over all slots</td></tr>
            <tr><td><strong>Excluded Low Bidder</strong></td><td>Holds private witness &amp; Merkle path</td><td>Anchors <span class="mono">deliverOpening</span> receipt</td><td>Proves <span class="mono">myPrice &lt; awardedPrice</span> without leaking price</td></tr>
          </tbody>
        </table>
      </div>
    `,
  },
  {
    id: 's03',
    badge: '03 / 07 · LIVE TENDER WORKFLOW',
    narration:
      'Here is Assize running live on our compiled Compact zero point three six point one contract for a real four-contractor public works tender: Civic Bridge Deck Rehabilitation. Four prequalified contractors prove Merkle roster membership and ten percent statutory surety bonds in zero knowledge. Bidding freezes permissionlessly, locking the complete commitment root, and bidders deliver WebCrypto encrypted openings off-chain with SHA-256 receipts anchored on-chain.',
    caption:
      'Real compiled Compact 0.36.1 execution: 4 prequalified bids sealed -> frozenCommitRoot locked -> WebCrypto RSA-OAEP/AES-GCM openings + SHA-256 receipts.',
    body: `
      <div class="split">
        <div>
          <div class="kicker">03 · Real User Action (OPEN -> REVEAL -> EVALUATION)</div>
          <h2>Four sealed bids. Frozen commitment root. Zero plaintext on-chain.</h2>
          <div class="sheet sheet-navy" style="margin-top:24px;font-size:20px;line-height:1.6">
            <div><strong>1. submitSealedBid:</strong> Depth-5 <span class="mono">prequalRoot</span> Merkle proof + 10% surety bond proven in ZK.</div>
            <div style="margin-top:10px"><strong>2. closeBidding:</strong> Permissionless freeze locks <span class="mono">frozenBidCount = 4</span> and <span class="mono">frozenCommitRoot</span>.</div>
            <div style="margin-top:10px"><strong>3. deliverOpening:</strong> Ephemeral WebCrypto <span class="mono">RSA-OAEP + AES-GCM</span> off-chain; <span class="mono">sha256</span> receipt on-chain.</div>
          </div>
        </div>
        <div class="shot">
          <img src="../assets/overview.png" alt="Assize Overview" />
        </div>
      </div>
    `,
  },
  {
    id: 's04',
    badge: '04 / 07 · ADVERSARIAL RIGGING BLOCKED',
    narration:
      'Watch what happens when a corrupt adjudicator attempts to rig the tender. Attack one: silently omitting the eight hundred eighty-five thousand dollar low bidder to award a nine hundred forty thousand dollar incumbent. Rejected by the compiled Compact circuit. Attack two: including all bids but awarding the higher price anyway. Rejected. Attack three: faking a non-reveal on a receipted bidder. Rejected.',
    caption:
      '3/3 rigging attacks rejected mathematically by compiled Compact 0.36.1 proveAward assertions — zero silent omissions, zero wrong winners, zero fake non-reveals.',
    body: `
      <div>
        <div class="kicker">04 · Exhaustive Complete-Set Enforcement (proveAward)</div>
        <h2>Three classic procurement rigging attacks — blocked at the circuit boundary.</h2>
      </div>
      <div class="grid-3">
        <div class="sheet sheet-crimson">
          <div class="tag tag-crimson" style="margin-bottom:14px">Attack 1 · Rejected</div>
          <div style="font-size:26px;font-weight:700;margin-bottom:12px">Silent Omission</div>
          <p style="font-size:20px;color:#4E5863;margin:0 0 18px">Corrupt adjudicator marks Slot #1 ($885,000) as <span class="mono">NO_BID</span> to steer award to $940,000.</p>
          <div class="mono" style="font-size:17px;color:#991B1B;font-weight:700">failed assert: Submitted slot cannot be NO_BID</div>
        </div>
        <div class="sheet sheet-crimson">
          <div class="tag tag-crimson" style="margin-bottom:14px">Attack 2 · Rejected</div>
          <div style="font-size:26px;font-weight:700;margin-bottom:12px">Wrong Winner</div>
          <p style="font-size:20px;color:#4E5863;margin:0 0 18px">Adjudicator includes all 4 bids but selects Slot #0 ($940,000) over Slot #1 ($885,000).</p>
          <div class="mono" style="font-size:17px;color:#991B1B;font-weight:700">failed assert: Awarded price is not deterministic lowest</div>
        </div>
        <div class="sheet sheet-crimson">
          <div class="tag tag-crimson" style="margin-bottom:14px">Attack 3 · Rejected</div>
          <div style="font-size:26px;font-weight:700;margin-bottom:12px">Fake NON_REVEAL</div>
          <p style="font-size:20px;color:#4E5863;margin:0 0 18px">Adjudicator claims receipted Slot #1 failed to deliver its post-deadline opening.</p>
          <div class="mono" style="font-size:17px;color:#991B1B;font-weight:700">failed assert: Cannot mark receipted opening as NON_REVEAL</div>
        </div>
      </div>
    `,
  },
  {
    id: 's05',
    badge: '05 / 07 · MAGIC MOMENT: ZK PROTEST',
    narration:
      'So the corrupt official tries the last remaining loophole: pretextually disqualifying the low bidder as not responsible with a public evidence hash, and awarding nine hundred forty thousand dollars to the incumbent. Now watch the payoff. The excluded low bidder clicks File Zero-Knowledge Protest. In a single challengeAward circuit call, they prove their pre-deadline commitment, on-chain receipt, and that their price strictly beat nine hundred forty thousand dollars—without disclosing their eight hundred eighty-five thousand dollar bid. The tender flips permanently to CONTESTED.',
    caption:
      'PAYOFF: Excluded Slot #1 executes challengeAward -> proves myPrice < $940,000 in ZK WITHOUT disclosing $885,000 -> Tender flips CONTESTED.',
    body: `
      <div class="split">
        <div>
          <div class="kicker">05 · Visible Product Payoff (challengeAward)</div>
          <h2>Pretextual exclusion caught — with the losing bid still sealed.</h2>
          <div class="sheet sheet-crimson" style="margin-top:20px;font-size:20px;line-height:1.55">
            <div class="tag tag-crimson" style="margin-bottom:10px">CONTESTED · CHALLENGER SLOT #1</div>
            <div><strong>Awarded Price (Public):</strong> <span class="mono">$940,000 (Slot #0)</span></div>
            <div style="margin-top:8px"><strong>Slot #1 Public Price:</strong> <span class="mono">[SEALED — NOT ON CHAIN]</span></div>
            <div style="margin-top:8px"><strong>ZK Proof Verified:</strong> <span class="mono">commitmentValid &amp;&amp; receiptDelivered &amp;&amp; myPrice &lt; $940,000</span></div>
          </div>
        </div>
        <div class="shot">
          <img src="../assets/cert-contested.png" alt="Assize Official Sealed-Bid Adjudication Certificate CONTESTED" />
        </div>
      </div>
    `,
  },
  {
    id: 's06',
    badge: '06 / 07 · ENGINEERING PROOF & PREPROD VERIFIER',
    narration:
      'Every claim is backed by real compiled cryptographic artifacts and automated verification. Assize compiles cleanly on Compact zero point three six point one into eight Z K I R circuits and sixteen prover and verifier keys. One hundred four automated Vitest tests pass, covering full lifecycles, WebCrypto tamper checks, forty guard boundaries, and fifty randomized fuzz trials—plus a twenty-six mutant source guard-mutation suite and an independent Blockfrost Midnight Preprod GraphQL verifier.',
    caption:
      'Verified engineering: Compact 0.36.1 (8 ZKIR circuits, 16 keys), 104/104 Vitest tests, 26-mutant guard harness, and walletless Blockfrost Preprod /verify.',
    body: `
      <div class="split">
        <div>
          <div class="kicker">06 · Cryptographic &amp; Security Proof</div>
          <h2>Zero mock shortcuts. Verified end to end.</h2>
          <div class="grid-2" style="margin-top:20px">
            <div class="sheet sheet-green">
              <div class="metric" style="color:#166534">104 / 104</div>
              <div style="font-size:18px;color:#4E5863;margin-top:6px">Vitest lifecycle, WebCrypto, guard &amp; fuzz tests PASS</div>
            </div>
            <div class="sheet sheet-navy">
              <div class="metric">8 / 16</div>
              <div style="font-size:18px;color:#4E5863;margin-top:6px">Compiled Compact 0.36.1 ZKIR circuits &amp; ZK keys</div>
            </div>
          </div>
          <div class="sheet" style="margin-top:20px;font-size:19px;color:#4E5863">
            <strong>Independent Preprod Verifier:</strong> <span class="mono">/verify</span> &amp; <span class="mono">npm run verify:onchain</span> query Blockfrost's live Midnight Preprod GraphQL indexer directly—never fabricating tx hashes.
          </div>
        </div>
        <div class="shot">
          <img src="../assets/verify-page.png" alt="Assize Preprod Verifier" />
        </div>
      </div>
    `,
  },
  {
    id: 's07',
    badge: '07 / 07 · COMMERCIAL VIABILITY & ROADMAP',
    narration:
      'Assize deploys as a cryptographic integrity overlay alongside existing municipal procurement portals—aligned with California Public Contract Code, City of Inglewood due process, and E U Directive Article twenty-one confidentiality rules. On our Phase two roadmap: timelock encryption to eliminate bidder non-reveal risk entirely, and scaling beyond four slots after Preprod proving benchmarks. Assize: verifiable sealed-bid public procurement, built natively for Midnight.',
    caption:
      'Assize — Municipal procurement overlay grounded in CA PCC & EU Art. 21, with Phase 2 Timelock Encryption roadmap. Apache-2.0 · Midnight Wave 3.',
    body: `
      <div>
        <div class="kicker">07 · Commercial Viability &amp; Phase 2 Roadmap</div>
        <h1>Assize: Verifiable sealed-bid public procurement on Midnight.</h1>
      </div>
      <div class="grid-3">
        <div class="sheet sheet-navy">
          <div class="tag tag-navy" style="margin-bottom:10px">Municipal Overlay GTM</div>
          <div style="font-size:20px;color:#4E5863;line-height:1.5">Plugs alongside PlanetBids, Bonfire &amp; OpenGov without rip-and-replace. SaaS or per-tender certified archival records.</div>
        </div>
        <div class="sheet sheet-green">
          <div class="tag tag-green" style="margin-bottom:10px">Statutory Grounding</div>
          <div style="font-size:20px;color:#4E5863;line-height:1.5">CA PCC §§ 10180, 20128, 20162 &amp; § 4101 · <em>City of Inglewood</em> (7 Cal.3d 861) · EU Dir. 2014/24/EU Art. 21.</div>
        </div>
        <div class="sheet">
          <div class="tag tag-navy" style="margin-bottom:10px">Phase 2 Roadmap</div>
          <div style="font-size:20px;color:#4E5863;line-height:1.5"><strong>Timelock encryption</strong> to eliminate bidder non-reveal dependency + <span class="mono">N=4 -&gt; N=6+</span> circuit scaling post-Preprod benchmarks.</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #E4E1DA;padding-top:18px;font-size:20px">
        <span class="mono" style="color:#1B3B6F;font-weight:700">Apache-2.0 · Topic: midnightntwrk · Compact 0.36.1</span>
        <span class="mono" style="color:#4E5863">Build Privacy-First Apps on Midnight — Wave 3</span>
      </div>
    `,
  },
];

function renderSceneHtml(scene) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><style>${BASE_CSS}</style></head>
<body>
  <div class="frame">
    <div class="topbar">
      <div class="brand">
        ${LOGO_SVG}
        <span class="serif" style="font-size:32px;font-weight:700">Assize</span>
        <span class="tag tag-navy" style="margin-left:8px">Midnight Compact 0.36.1</span>
      </div>
      <span class="mono" style="font-size:17px;color:#4E5863;font-weight:600">${scene.badge}</span>
    </div>
    ${scene.body}
  </div>
  <div class="caption-bar">
    <div class="caption-text">${scene.caption}</div>
    <div class="scene-badge">ASSIZE · WAVE 3</div>
  </div>
</body>
</html>`;
}

function getDurationSeconds(filePath) {
  const out = execFileSync(FFPROBE, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ])
    .toString()
    .trim();
  return parseFloat(out);
}

console.log('1. Writing 7 1920x1080 HTML scene plates & rendering PNG frames via headless Edge...');
const tmpProfile = path.join(process.env.TEMP || 'C:\\Temp', 'assize-film-profile');

for (const scene of SCENES) {
  const htmlPath = path.join(SCENES_DIR, `${scene.id}.html`);
  const pngPath = path.join(FRAMES_DIR, `${scene.id}.png`);
  fs.writeFileSync(htmlPath, renderSceneHtml(scene), 'utf8');
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  execFileSync(EDGE, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${tmpProfile}`,
    '--window-size=1920,1080',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`,
    fileUrl,
  ]);
  console.log(`  [PNG] ${scene.id}.png`);
}

console.log('2. Synthesizing clean Windows SAPI voiceover WAV tracks (Microsoft Mark)...');
const psLines = [
  'Add-Type -AssemblyName System.Speech',
  '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  '$synth.SelectVoice("Microsoft Mark")',
  '$synth.Rate = 0',
];
for (const scene of SCENES) {
  const wavPath = path.join(AUDIO_DIR, `${scene.id}.wav`).replace(/'/g, "''");
  const text = scene.narration.replace(/'/g, "''");
  psLines.push(`$synth.SetOutputToWaveFile('${wavPath}')`);
  psLines.push(`$synth.Speak('${text}')`);
}
psLines.push('$synth.Dispose()');
const psPath = path.join(DEMO_DIR, 'synthesize-vo.ps1');
fs.writeFileSync(psPath, psLines.join('\r\n'), 'utf8');
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath]);
console.log('  [WAV] All 7 narration tracks synthesized.');

console.log('3. Rendering 7 H.264/BT.709 scene clips & muxing demo/assize-demo.mp4...');
const concatLines = [];
let totalDur = 0;

for (const scene of SCENES) {
  const pngPath = path.join(FRAMES_DIR, `${scene.id}.png`);
  const wavPath = path.join(AUDIO_DIR, `${scene.id}.wav`);
  const clipPath = path.join(CLIPS_DIR, `${scene.id}.mp4`);
  const audioDur = getDurationSeconds(wavPath);
  const clipDur = Math.max(12, Math.ceil((audioDur + 1.4) * 10) / 10);
  totalDur += clipDur;

  execFileSync(FFMPEG, [
    '-y',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-i',
    pngPath,
    '-i',
    wavPath,
    '-t',
    clipDur.toFixed(2),
    '-vf',
    'scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=' +
      Math.max(0, clipDur - 0.35).toFixed(2) +
      ':d=0.35',
    '-af',
    'adelay=400|400,apad,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-shortest',
    clipPath,
  ]);
  concatLines.push(`file '${clipPath.replace(/\\/g, '/')}'`);
  console.log(`  [MP4] ${scene.id}.mp4 (${clipDur.toFixed(1)}s)`);
}

const concatListPath = path.join(DEMO_DIR, 'concat.txt');
fs.writeFileSync(concatListPath, concatLines.join('\n'), 'utf8');
const finalMp4 = path.join(DEMO_DIR, 'assize-demo.mp4');

execFileSync(FFMPEG, [
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatListPath,
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  finalMp4,
]);

const finalDur = getDurationSeconds(finalMp4);
const bytes = fs.readFileSync(finalMp4);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

console.log('4. Extracting 4x2 DEMO_QA contact sheet from rendered assize-demo.mp4...');
const contactSheet = path.join(DEMO_DIR, 'contact-sheet.png');
const interval = Math.max(1, finalDur / 8);
execFileSync(FFMPEG, [
  '-y',
  '-i',
  finalMp4,
  '-vf',
  `fps=1/${interval.toFixed(2)},scale=640:360,tile=4x2`,
  '-frames:v',
  '1',
  contactSheet,
]);

console.log('\n=== Assize Product Film Complete ===');
console.log(`File:     ${finalMp4}`);
console.log(`Duration: ${finalDur.toFixed(2)}s (~${(finalDur / 60).toFixed(2)} min)`);
console.log(`Size:     ${(bytes.length / (1024 * 1024)).toFixed(2)} MB`);
console.log(`SHA-256:  ${sha256}`);
console.log(`Contact:  ${contactSheet}`);
