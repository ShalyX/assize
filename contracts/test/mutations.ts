// SPDX-License-Identifier: Apache-2.0
// Assize — Automated 26-Mutant Source Guard-Mutation Verification Harness
// Mutates 26 single security guards in contracts/src/assize.compact one by one,
// verifies each mutant compiles with compact 0.36.1 (--skip-zk), and asserts
// our Vitest adversarial test suite KILLS the mutant (fails >= 1 test)!

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src', 'assize.compact');
const OUT = path.join(ROOT, 'managed', 'assize');

interface MutantSpec {
  id: string;
  desc: string;
  target: string;
  replacement: string;
  testFile: string;
}

const MUTANTS: MutantSpec[] = [
  {
    id: 'M01',
    desc: 'Drop minBondBps <= 10000 constructor bound',
    target: 'assert(initMinBondBps <= 10000, "minBondBps cannot exceed 10000");',
    replacement: 'assert(true, "MUTANT_M01");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M02',
    desc: 'Drop phase == OPEN guard in submitSealedBid',
    target: 'assert(phase == Phase.OPEN, "Bidding is not open");',
    replacement: 'assert(true, "MUTANT_M02");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M03',
    desc: 'Drop prequalRoot Merkle verification in submitSealedBid',
    target: 'merkleTreePathRoot<5, Bytes<32>>(path) == prequalRoot,',
    replacement: 'true,',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M04',
    desc: 'Drop nullifier uniqueness check in submitSealedBid',
    target: 'assert(!usedNullifiers.member(disclose(nul)), "Bidder already submitted a sealed bid");',
    replacement: 'assert(true, "MUTANT_M04");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M05',
    desc: 'Drop price > 0 guard in submitSealedBid',
    target: 'assert(op.price > 0, "Bid price must be positive");',
    replacement: 'assert(true, "MUTANT_M05");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M06',
    desc: 'Drop statutory 10% surety-bond ratio check in submitSealedBid',
    target: 'op.bondAmount * 10000 >= op.price * (minBondBps as Uint<64>),',
    replacement: 'true,',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M07',
    desc: 'Drop opening nullifier ownership check in submitSealedBid',
    target: 'assert(op.nullifier == nul, "Opening nullifier mismatch");',
    replacement: 'assert(true, "MUTANT_M07");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M08',
    desc: 'Drop phase == REVEAL guard in deliverOpening',
    target: 'assert(phase == Phase.REVEAL, "Reveal window is not active");',
    replacement: 'assert(true, "MUTANT_M08");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M09',
    desc: 'Drop duplicate opening receipt guard in deliverOpening',
    target: 'assert(!deliveredFlags.lookup(slot), "Opening receipt already recorded");',
    replacement: 'assert(true, "MUTANT_M09");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M10',
    desc: 'Drop owner nullifier check in deliverOpening',
    target: 'assert(op.nullifier == nul, "Not the owner of this bid");',
    replacement: 'assert(true, "MUTANT_M10");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M11',
    desc: 'Drop sealed commitment preimage check in deliverOpening',
    target: 'assert(recomputed == bidCommitments.lookup(slot), "Opening does not match sealed commitment");',
    replacement: 'assert(true, "MUTANT_M11");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M12',
    desc: 'Drop phase == EVALUATION barrier in proveAward',
    target: 'assert(phase == Phase.EVALUATION, "Tender is not in evaluation phase");',
    replacement: 'assert(true, "MUTANT_M12");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M13',
    desc: 'Drop adjudicator authorization in proveAward',
    target: 'hashAdjPubKey(adjudicatorSecret()) == adjudicatorPubKey,',
    replacement: 'true,',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M14',
    desc: 'Drop submitted-slot != NO_BID check in evalAwardSlot (silent omission)',
    target: 'assert(code != ExclusionCode.NO_BID, "Submitted slot cannot be NO_BID");',
    replacement: 'assert(true, "MUTANT_M14");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M15',
    desc: 'Drop deterministic argmin / tie-break check in evalAwardSlot',
    target: '(op.price > awardedPricePub) || ((op.price == awardedPricePub) && (idx >= winningSlotPub)),',
    replacement: 'true,',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M16',
    desc: 'Weaken tie-break from idx >= winningSlotPub to always true on equal price',
    target: '((op.price == awardedPricePub) && (idx >= winningSlotPub))',
    replacement: '(op.price == awardedPricePub)',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M17',
    desc: 'Drop !wasDelivered check on NON_REVEAL (allows fake NON_REVEAL)',
    target: 'assert(!wasDelivered, "Cannot mark receipted opening as NON_REVEAL");',
    replacement: 'assert(true, "MUTANT_M17");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M18',
    desc: 'Drop op.price > maxAwardBudget proof on OVER_BUDGET',
    target: 'assert(op.price > pubMaxBudget, "Bid price does not actually exceed maxAwardBudget");',
    replacement: 'assert(true, "MUTANT_M18");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M19',
    desc: 'Drop compliant op.price <= pubMaxBudget check',
    target: 'assert(op.price <= pubMaxBudget, "Compliant bid cannot exceed maxAwardBudget");',
    replacement: 'assert(true, "MUTANT_M19");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M20',
    desc: 'Drop winnerFirmIdHash check in verifyWinnerOpening',
    target: 'assert(op.firmIdHash == winnerFirmPub, "Winner firm ID hash mismatch");',
    replacement: 'assert(true, "MUTANT_M20");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M21',
    desc: 'Drop winnerSubListHash (CA PCC §4101) check in verifyWinnerOpening',
    target: 'assert(op.subListHash == winnerSubListPub, "Winner subListHash mismatch");',
    replacement: 'assert(true, "MUTANT_M21");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M22',
    desc: 'Drop discretionary-only exclusion check in challengeAward',
    target: 'isDiscretionaryExclusion(code),',
    replacement: 'true,',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M23',
    desc: 'Drop deliveredFlags check in challengeAward (allows non-revealer protest)',
    target: 'assert(deliveredFlags.lookup(slot), "Non-revealing bidder cannot challenge");',
    replacement: 'assert(true, "MUTANT_M23");',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M24',
    desc: 'Drop myPrice < awardedPrice standing check in challengeAward',
    target: '(op.price < pubAwardedPrice) || ((op.price == pubAwardedPrice) && (slot < pubWinningSlot)),',
    replacement: 'true,',
    testFile: 'test/assize.test.ts',
  },
  {
    id: 'M25',
    desc: 'Drop owner nullifier check in challengeAward',
    target: 'assert(op.nullifier == nul, "Not the owner of this bid slot");',
    replacement: 'assert(true, "MUTANT_M25");',
    testFile: 'test/assize.guards.test.ts',
  },
  {
    id: 'M26',
    desc: 'Drop phase == AWARDED guard in finalizeAward',
    target: 'assert(phase == Phase.AWARDED, "Only uncontested AWARDED tenders can be finalized");',
    replacement: 'assert(true, "MUTANT_M26");',
    testFile: 'test/assize.guards.test.ts',
  },
];

const originalSrc = fs.readFileSync(SRC, 'utf8');
const wslSrc = '/mnt/c/Users/USER/.gemini/antigravity/scratch/midnight-wave3/contracts/src/assize.compact';
const wslOut = '/mnt/c/Users/USER/.gemini/antigravity/scratch/midnight-wave3/contracts/managed/assize';
const keysDir = path.join(OUT, 'keys');
const keysBackupDir = path.join(ROOT, 'managed', '.assize-keys-backup');

let killed = 0;
const survived: string[] = [];

if (fs.existsSync(keysDir) && !fs.existsSync(keysBackupDir)) {
  fs.renameSync(keysDir, keysBackupDir);
}

try {
  for (const m of MUTANTS) {
    if (!originalSrc.includes(m.target)) {
      throw new Error(`Mutant ${m.id} target not found in assize.compact`);
    }
    const mutated = originalSrc.replace(m.target, m.replacement);
    fs.writeFileSync(SRC, mutated, 'utf8');
    execSync(`wsl -d Ubuntu-24.04-Clean -- /root/.local/bin/compact compile --skip-zk ${wslSrc} ${wslOut}`, {
      stdio: 'pipe',
    });
    let testFailed = false;
    try {
      execSync(`npx vitest run ${m.testFile}`, { cwd: ROOT, stdio: 'pipe' });
    } catch {
      testFailed = true;
    }
    if (testFailed) {
      killed++;
      console.log(`[KILLED]   ${m.id}: ${m.desc}`);
    } else {
      survived.push(`${m.id}: ${m.desc}`);
      console.log(`[SURVIVED] ${m.id}: ${m.desc}`);
    }
  }
} finally {
  // Always restore original contract, recompile clean bindings, and restore ZK prover/verifier keys!
  fs.writeFileSync(SRC, originalSrc, 'utf8');
  execSync(`wsl -d Ubuntu-24.04-Clean -- /root/.local/bin/compact compile --skip-zk ${wslSrc} ${wslOut}`, {
    stdio: 'pipe',
  });
  if (fs.existsSync(keysBackupDir)) {
    if (fs.existsSync(keysDir)) fs.rmSync(keysDir, { recursive: true, force: true });
    fs.renameSync(keysBackupDir, keysDir);
  }
}

console.log(`\nGuard-Mutation Summary: ${killed} / ${MUTANTS.length} mutants KILLED.`);
if (survived.length > 0) {
  console.error('SURVIVED MUTANTS:', survived);
  process.exit(1);
}
