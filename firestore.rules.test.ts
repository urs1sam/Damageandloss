/**
 * Phase 0 TDD Specification for Firestore Security Rules ("Dirty Dozen" Payloads).
 * Intended to be executed against the Firebase Emulator Suite (`@firebase/rules-unit-testing`).
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  docId?: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

const VALID_RESTORATION = {
  stage: 'Not Started',
  progress: 0,
  budget: 0,
  spent: 0,
  agency: '',
  targetDate: '',
  logs: [],
};

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create on damageEntries',
    collectionPath: 'damageEntries',
    docId: 'LD-2026-9001',
    operation: 'create',
    auth: null,
    payload: { id: 'LD-2026-9001', ownerId: 'anon' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified admin email spoof on damageEntries list',
    collectionPath: 'damageEntries',
    operation: 'list',
    auth: { uid: 'spoof-uid', email: 'shrestha.nibas@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'OwnerId spoofing on create',
    collectionPath: 'damageEntries',
    docId: 'LD-2026-9002',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'LD-2026-9002', ownerId: 'user-b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-user PII read (get)',
    collectionPath: 'damageEntries',
    docId: 'LD-USER-A-1',
    operation: 'get',
    auth: { uid: 'user-b', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unfiltered list query across other users PII',
    collectionPath: 'damageEntries',
    operation: 'list',
    auth: { uid: 'user-b', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow / ghost field injection on create',
    collectionPath: 'damageStandards',
    docId: 'STD-9001',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'STD-9001',
      ownerId: 'user-a',
      scope: 'user',
      sector: 'Education',
      name: 'Desk Loss',
      severity: 'Minor',
      unit: 'Units',
      unitCost: 5000,
      ghostField: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Self-approval verification bypass on create',
    collectionPath: 'damageEntries',
    docId: 'LD-2026-9007',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'LD-2026-9007',
      ownerId: 'user-a',
      verification: 'Approved by Palika',
      restoration: VALID_RESTORATION,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal state mutation after Palika approval',
    collectionPath: 'damageEntries',
    docId: 'LD-APPROVED-1',
    operation: 'update',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { remarks: 'Tampered after approval' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Invalid document ID poisoning',
    collectionPath: 'damageStandards',
    docId: 'STD bad$id',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'STD bad$id', ownerId: 'user-a', scope: 'user' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized payload exhaustion (> 150KB photoDataUrl / > 2000 remarks)',
    collectionPath: 'damageEntries',
    docId: 'LD-2026-9010',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'LD-2026-9010',
      ownerId: 'user-a',
      remarks: 'x'.repeat(2500),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-admin creating system-scoped DamageStandard',
    collectionPath: 'damageStandards',
    docId: 'STD-9011',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'STD-9011',
      ownerId: 'user-a',
      scope: 'system',
      sector: 'Education',
      name: 'School',
      severity: 'Severe',
      unit: 'Schools',
      unitCost: 1000000,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Backdated client-provided timestamp',
    collectionPath: 'localBodies',
    docId: 'LB-9012',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'LB-9012',
      ownerId: 'user-a',
      scope: 'user',
      province: 'Koshi Province',
      district: 'Morang',
      name: 'Test Gaupalika',
      wards: 7,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
];
