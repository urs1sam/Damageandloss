import {
  DocumentData,
  DocumentReference,
  Unsubscribe,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AdminMemberRecord,
  DamageEntry,
  DamageStandard,
  PriorityLevel,
  ReliefItemRequest,
  RestorationStage,
  RestorationState,
  RoleAssignmentRecord,
  SectorAssessmentItem,
  SectorQuestion,
  SeverityLevel,
  UserProfileRecord,
  VerificationStatus,
} from '../types/mis';
import { DEFAULT_SECTORS, DEFAULT_SECTOR_QUESTIONS, DEFAULT_STANDARDS } from '../data/defaults';
import { OperationType, auth, db, handleFirestoreError } from './config';

export interface StoredLocalBody {
  id: string;
  province: string;
  district: string;
  name: string;
  wards: number;
  scope?: 'system' | 'user';
  ownerId?: string;
}

export interface StoredSectorConfig {
  id: string;
  name: string;
  questions: SectorQuestion[];
  scope?: 'system' | 'user';
  ownerId?: string;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNum(val: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function toSafeDocId(raw: string, prefix = 'ID'): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = cleaned || prefix;
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(base)) {
    return base;
  }
  return `${prefix}-${shortHash(raw)}`.slice(0, 128);
}

export function sectorDocId(sectorName: string): string {
  const slug = sectorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `SEC-${slug || 'custom'}-${shortHash(sectorName.toLowerCase())}`.slice(0, 128);
}

export function localBodyDocId(province: string, district: string, name: string): string {
  const rawKey = `${province}|${district}|${name}`.toLowerCase();
  const slug = `${district}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `LB-${slug || 'palika'}-${shortHash(rawKey)}`.slice(0, 128);
}

const VALID_SEVERITIES: SeverityLevel[] = ['Minor', 'Moderate', 'Severe', 'Catastrophic'];
const VALID_VERIFICATIONS: VerificationStatus[] = [
  'Pending Review',
  'Field Verified',
  'Approved by Palika',
];
const VALID_PRIORITIES: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
const VALID_STAGES: RestorationStage[] = [
  'Not Started',
  'Technical Assessment',
  'Procurement / Tender',
  'In Progress',
  'Restored',
];

function sanitizeSeverity(v: unknown): SeverityLevel {
  return VALID_SEVERITIES.includes(v as SeverityLevel) ? (v as SeverityLevel) : 'Moderate';
}

function sanitizePriority(v: unknown): PriorityLevel {
  return VALID_PRIORITIES.includes(v as PriorityLevel) ? (v as PriorityLevel) : 'Medium';
}

function sanitizeVerification(v: unknown, allowNonPending: boolean): VerificationStatus {
  if (!allowNonPending) return 'Pending Review';
  return VALID_VERIFICATIONS.includes(v as VerificationStatus)
    ? (v as VerificationStatus)
    : 'Pending Review';
}

function sanitizeRestoration(r?: Partial<RestorationState>): RestorationState {
  const stage = VALID_STAGES.includes(r?.stage as RestorationStage)
    ? (r?.stage as RestorationStage)
    : 'Not Started';
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const rawLogs = Array.isArray(r?.logs) ? r.logs.slice(0, 100) : [];
  const logs = rawLogs.map((l) => ({
    date: clampStr(l?.date, 30, fallbackDate) || fallbackDate,
    note: clampStr(l?.note, 1000, ''),
  }));
  return {
    stage,
    progress: clampNum(r?.progress, 0, 100),
    budget: clampNum(r?.budget, 0),
    spent: clampNum(r?.spent, 0),
    agency: clampStr(r?.agency, 200),
    targetDate: clampStr(r?.targetDate, 30),
    logs,
  };
}

function sanitizeSectorItems(items?: SectorAssessmentItem[]): SectorAssessmentItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 50).map((item, idx) => {
    const cleanAnswers: Record<string, string> = {};
    if (item.answers && typeof item.answers === 'object') {
      Object.entries(item.answers)
        .slice(0, 40)
        .forEach(([k, v], aIdx) => {
          const cleanKey = clampStr(k, 80, `q-${idx}-${aIdx}`) || `q-${idx}-${aIdx}`;
          cleanAnswers[cleanKey] = clampStr(v, 500);
        });
    }
    return {
      id: toSafeDocId(item.id || `ITEM-${idx + 1}`, `ITEM-${idx + 1}`),
      sector: clampStr(item.sector, 120, 'Other') || 'Other',
      standardId: toSafeDocId(item.standardId || 'STD-CUSTOM', 'STD-CUSTOM'),
      standardName: clampStr(item.standardName, 200, 'Custom Damage') || 'Custom Damage',
      severity: sanitizeSeverity(item.severity),
      unit: clampStr(item.unit, 60, 'Units') || 'Units',
      qty: clampNum(item.qty, 0),
      lossNPR: clampNum(item.lossNPR, 0),
      answers: cleanAnswers,
      ...(item.restoration ? { restoration: sanitizeRestoration(item.restoration) } : {}),
    };
  });
}

function sanitizeReliefItems(items?: ReliefItemRequest[]): ReliefItemRequest[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 60)
    .map((item, idx) => {
      const name = clampStr(item?.name, 200);
      if (!name) return null;
      const notes = clampStr(item?.notes, 250);
      return {
        id: toSafeDocId(item?.id || `REL-${idx + 1}`, `REL-${idx + 1}`),
        name,
        qty: clampNum(item?.qty, 0),
        unit: clampStr(item?.unit, 60, 'Units') || 'Units',
        ...(notes ? { notes } : {}),
      } as ReliefItemRequest;
    })
    .filter((item): item is ReliefItemRequest => item !== null);
}

function sanitizeQuestions(questions?: SectorQuestion[]): SectorQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions.slice(0, 40).map((q, idx) => ({
    id: toSafeDocId(q.id || `Q-${idx + 1}`, `Q-${idx + 1}`),
    label: clampStr(q.label, 200, `Question ${idx + 1}`) || `Question ${idx + 1}`,
    type: q.type === 'yesno' || q.type === 'number' || q.type === 'select' ? q.type : 'text',
    ...(Array.isArray(q.options) && q.options.length > 0
      ? { options: q.options.slice(0, 20).map((o) => clampStr(o, 100)).filter(Boolean) }
      : {}),
    required: Boolean(q.required),
  }));
}

function sanitizeAssignedIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  ids.forEach((raw) => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(trimmed)) return;
    if (!seen.has(trimmed) && out.length < 20) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  });
  return out;
}

const ALLOWED_DAMAGE_ENTRY_KEYS = new Set([
  'id',
  'ownerId',
  'assignedIds',
  'date',
  'province',
  'district',
  'municipality',
  'ward',
  'tole',
  'lat',
  'lng',
  'hazard',
  'title',
  'sector',
  'standardId',
  'standardName',
  'severity',
  'unit',
  'qty',
  'lossNPR',
  'sectorItems',
  'deaths',
  'missing',
  'injured',
  'affectedHH',
  'fullyDisplaced',
  'tempDisplaced',
  'affectedPop',
  'casualties',
  'officer',
  'contact',
  'verification',
  'priority',
  'remarks',
  'photoName',
  'photoDataUrl',
  'reliefDurationDays',
  'reliefItems',
  'trackRestoration',
  'restoration',
  'createdAt',
  'updatedAt',
]);

function isFirestoreTimestamp(val: unknown): boolean {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof (val as { toMillis?: unknown }).toMillis === 'function'
  );
}

async function readExistingDoc(docRef: DocumentReference<DocumentData>) {
  try {
    return await getDocFromServer(docRef);
  } catch (error) {
    // Do not hide a real Rules denial behind a cached document. A cache fallback
    // is useful only when Firestore is temporarily unreachable/offline.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return getDoc(docRef);
    }
    throw error;
  }
}

async function refreshVerifiedSession(uid: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (currentUser.uid !== uid) {
    throw new Error('The signed-in account changed. Please reload the app and try again.');
  }
  await currentUser.reload();
  await currentUser.getIdToken(true);
  if (!currentUser.emailVerified) {
    throw new Error('Please verify your Google account email, then sign in again.');
  }
}

function buildDamageEntryFields(
  entry: DamageEntry,
  safeId: string,
  ownerId: string,
  allowVerificationChoice: boolean
) {
  const nDeaths = clampNum(entry.deaths, 0);
  const nMissing = clampNum(entry.missing, 0);
  const nInjured = clampNum(entry.injured, 0);
  const nAffectedHH = clampNum(entry.affectedHH, 0);
  const nFullyDisplaced = clampNum(entry.fullyDisplaced, 0);
  const nTempDisplaced =
    typeof entry.tempDisplaced === 'number'
      ? clampNum(entry.tempDisplaced, 0)
      : Math.max(0, nAffectedHH - nFullyDisplaced);
  const todayIso = new Date().toISOString().slice(0, 10);
  const rawDate = clampStr(entry.date, 24, todayIso);
  const validDate = rawDate.length >= 4 ? rawDate : todayIso;
  const safeOwnerId = /^[a-zA-Z0-9_-]{1,128}$/.test(ownerId)
    ? ownerId
    : toSafeDocId(ownerId || 'USR', 'USR');

  const fields: Record<string, unknown> = {
    id: safeId,
    ownerId: safeOwnerId,
    assignedIds: sanitizeAssignedIds(entry.assignedIds),
    date: validDate,
    province: clampStr(entry.province, 100, 'Unspecified') || 'Unspecified',
    district: clampStr(entry.district, 100, 'Unspecified') || 'Unspecified',
    municipality: clampStr(entry.municipality, 150, 'Unspecified') || 'Unspecified',
    ward: clampStr(entry.ward, 30, '1') || '1',
    tole: clampStr(entry.tole, 200),
    lat: clampStr(entry.lat, 32),
    lng: clampStr(entry.lng, 32),
    hazard: clampStr(entry.hazard, 80, 'Other') || 'Other',
    title: clampStr(entry.title, 250, 'Field Loss & Damage Report') || 'Field Loss & Damage Report',
    sector: clampStr(entry.sector, 120, 'Other') || 'Other',
    standardId: toSafeDocId(entry.standardId || 'STD-CUSTOM', 'STD-CUSTOM'),
    standardName: clampStr(entry.standardName, 220, 'Custom Damage') || 'Custom Damage',
    severity: sanitizeSeverity(entry.severity),
    unit: clampStr(entry.unit, 60, 'Units') || 'Units',
    qty: clampNum(entry.qty, 0),
    lossNPR: clampNum(entry.lossNPR, 0),
    sectorItems: sanitizeSectorItems(entry.sectorItems),
    deaths: nDeaths,
    missing: nMissing,
    injured: nInjured,
    affectedHH: nAffectedHH,
    fullyDisplaced: nFullyDisplaced,
    tempDisplaced: nTempDisplaced,
    affectedPop: clampNum(entry.affectedPop, 0),
    casualties: nDeaths + nMissing + nInjured,
    officer: clampStr(entry.officer, 150),
    contact: clampStr(entry.contact, 100),
    verification: sanitizeVerification(entry.verification, allowVerificationChoice),
    priority: sanitizePriority(entry.priority),
    remarks: clampStr(entry.remarks, 2000),
    reliefDurationDays: clampNum(entry.reliefDurationDays ?? 21, 0, 3650),
    reliefItems: sanitizeReliefItems(entry.reliefItems),
    trackRestoration: Boolean(entry.trackRestoration),
    restoration: sanitizeRestoration(entry.restoration),
  };

  const photoName = clampStr(entry.photoName, 200);
  if (photoName) fields.photoName = photoName;

  if (
    typeof entry.photoDataUrl === 'string' &&
    entry.photoDataUrl.length > 0 &&
    entry.photoDataUrl.length <= 150000
  ) {
    fields.photoDataUrl = entry.photoDataUrl;
  }

  return fields;
}

function auditRestorationAgainstRules(
  r: unknown,
  prefix: string,
  failures: string[]
): void {
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    failures.push(`${prefix}MissingOrNotMap`);
    return;
  }
  const obj = r as Record<string, unknown>;
  const reqKeys = ['stage', 'progress', 'budget', 'spent', 'agency', 'targetDate', 'logs'];
  const allowedKeys = new Set(reqKeys);
  reqKeys.forEach((k) => {
    if (!(k in obj)) failures.push(`${prefix}Missing:${k}`);
  });
  Object.keys(obj).forEach((k) => {
    if (!allowedKeys.has(k)) failures.push(`${prefix}Extra:${k}`);
  });
  if (!VALID_STAGES.includes(obj.stage as RestorationStage)) {
    failures.push(`${prefix}Stage:${String(obj.stage)}`);
  }
  if (typeof obj.progress !== 'number' || !Number.isFinite(obj.progress) || obj.progress < 0 || obj.progress > 100) {
    failures.push(`${prefix}Progress:${String(obj.progress)}`);
  }
  if (typeof obj.budget !== 'number' || !Number.isFinite(obj.budget) || obj.budget < 0) {
    failures.push(`${prefix}Budget:${String(obj.budget)}`);
  }
  if (typeof obj.spent !== 'number' || !Number.isFinite(obj.spent) || obj.spent < 0) {
    failures.push(`${prefix}Spent:${String(obj.spent)}`);
  }
  if (typeof obj.agency !== 'string' || obj.agency.length > 200) {
    failures.push(`${prefix}Agency`);
  }
  if (typeof obj.targetDate !== 'string' || obj.targetDate.length > 30) {
    failures.push(`${prefix}TargetDate`);
  }
  if (!Array.isArray(obj.logs) || obj.logs.length > 100) {
    failures.push(`${prefix}Logs`);
  } else if (obj.logs.length > 0) {
    const l0 = obj.logs[0];
    if (!l0 || typeof l0 !== 'object' || Array.isArray(l0)) {
      failures.push(`${prefix}Log0NotMap`);
    } else {
      const logObj = l0 as Record<string, unknown>;
      if (!('date' in logObj)) failures.push(`${prefix}Log0Missing:date`);
      if (!('note' in logObj)) failures.push(`${prefix}Log0Missing:note`);
      Object.keys(logObj).forEach((k) => {
        if (k !== 'date' && k !== 'note') failures.push(`${prefix}Log0Extra:${k}`);
      });
      if (typeof logObj.date !== 'string' || logObj.date.length > 30) {
        failures.push(`${prefix}Log0Date:${String(logObj.date)}`);
      }
      if (typeof logObj.note !== 'string' || logObj.note.length > 1000) {
        failures.push(`${prefix}Log0NoteLen`);
      }
    }
  }
}

function auditDamageEntryAgainstRules(
  data: Record<string, unknown>,
  entryId: string,
  checkCreatedAt = false
): string[] {
  const failures: string[] = [];
  const isValidId = (v: unknown) =>
    typeof v === 'string' && v.length >= 1 && v.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(v);
  const checkStr = (key: string, min: number, max: number, required = true) => {
    if (!(key in data)) {
      if (required) failures.push(`missing:${key}`);
      return;
    }
    const v = data[key];
    if (typeof v !== 'string') failures.push(`type:${key}:${typeof v}`);
    else if (v.length < min || v.length > max) failures.push(`len:${key}:${v.length}`);
  };
  const checkNum = (key: string, min = 0, max?: number) => {
    const v = data[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) failures.push(`num:${key}:${String(v)}`);
    else if (v < min || (max !== undefined && v > max)) failures.push(`range:${key}:${v}`);
  };

  const keys = Object.keys(data);
  REQUIRED_DAMAGE_ENTRY_KEYS.forEach((k) => {
    if (k !== 'createdAt' && k !== 'updatedAt' && !(k in data)) {
      failures.push(`reqMissing:${k}`);
    }
  });
  keys.forEach((k) => {
    if (!ALLOWED_DAMAGE_ENTRY_KEYS.has(k)) failures.push(`extraKey:${k}`);
  });
  if (data.id !== entryId) failures.push(`idMismatch:${String(data.id)}!=${entryId}`);
  if (!isValidId(data.ownerId)) failures.push(`invalidOwnerId:${String(data.ownerId)}`);
  if ('assignedIds' in data) {
    if (!Array.isArray(data.assignedIds) || data.assignedIds.length > 20) {
      failures.push(`assignedIdsInvalid`);
    } else if (data.assignedIds.length > 0 && !isValidId(data.assignedIds[0])) {
      failures.push(`assignedIds0Invalid:${String(data.assignedIds[0])}`);
    }
  }
  checkStr('date', 4, 24);
  checkStr('province', 1, 100);
  checkStr('district', 1, 100);
  checkStr('municipality', 1, 150);
  checkStr('ward', 1, 30);
  checkStr('tole', 0, 200, false);
  checkStr('lat', 0, 32, false);
  checkStr('lng', 0, 32, false);
  checkStr('hazard', 1, 80);
  checkStr('title', 1, 250);
  checkStr('sector', 1, 120);
  if (!isValidId(data.standardId)) failures.push(`invalidStandardId:${String(data.standardId)}`);
  checkStr('standardName', 1, 220);
  if (!VALID_SEVERITIES.includes(data.severity as SeverityLevel)) failures.push(`severity:${String(data.severity)}`);
  checkStr('unit', 1, 60);
  checkNum('qty', 0);
  checkNum('lossNPR', 0);
  if (!Array.isArray(data.sectorItems) || data.sectorItems.length > 50) {
    failures.push('sectorItemsInvalid');
  } else if (data.sectorItems.length > 0) {
    const raw0 = data.sectorItems[0];
    if (!raw0 || typeof raw0 !== 'object' || Array.isArray(raw0)) {
      failures.push('s0NotMap');
    } else {
      const s0 = raw0 as Record<string, unknown>;
      const req0 = ['id', 'sector', 'standardId', 'standardName', 'severity', 'unit', 'qty', 'lossNPR', 'answers'];
      const allowed0 = new Set([...req0, 'restoration']);
      req0.forEach((k) => {
        if (!(k in s0)) failures.push(`s0Missing:${k}`);
      });
      Object.keys(s0).forEach((k) => {
        if (!allowed0.has(k)) failures.push(`s0Extra:${k}`);
      });
      if ('restoration' in s0) {
        auditRestorationAgainstRules(s0.restoration, 's0Rest', failures);
      }
    }
  }
  ['deaths', 'missing', 'injured', 'affectedHH', 'fullyDisplaced', 'tempDisplaced', 'affectedPop', 'casualties'].forEach((k) => checkNum(k, 0));
  checkStr('officer', 0, 150);
  checkStr('contact', 0, 100);
  if (!VALID_VERIFICATIONS.includes(data.verification as VerificationStatus)) failures.push(`verification:${String(data.verification)}`);
  if (!VALID_PRIORITIES.includes(data.priority as PriorityLevel)) failures.push(`priority:${String(data.priority)}`);
  checkStr('remarks', 0, 2000);
  checkStr('photoName', 0, 200, false);
  checkStr('photoDataUrl', 0, 150000, false);
  if ('reliefDurationDays' in data) checkNum('reliefDurationDays', 0, 3650);
  if ('reliefItems' in data) {
    if (!Array.isArray(data.reliefItems) || data.reliefItems.length > 60) {
      failures.push('reliefItemsInvalid');
    } else if (data.reliefItems.length > 0) {
      const rawR0 = data.reliefItems[0];
      if (!rawR0 || typeof rawR0 !== 'object' || Array.isArray(rawR0)) {
        failures.push('relief0NotMap');
      } else {
        const r0 = rawR0 as Record<string, unknown>;
        const reqR0 = ['id', 'name', 'qty', 'unit'];
        const allowedR0 = new Set([...reqR0, 'notes']);
        reqR0.forEach((k) => {
          if (!(k in r0)) failures.push(`relief0Missing:${k}`);
        });
        Object.keys(r0).forEach((k) => {
          if (!allowedR0.has(k)) failures.push(`relief0Extra:${k}`);
        });
        if (!isValidId(r0.id)) failures.push(`relief0InvalidId:${String(r0.id)}`);
        if (typeof r0.name !== 'string' || r0.name.length < 1 || r0.name.length > 200) {
          failures.push(`relief0Name:${String(r0.name)}`);
        }
        if (typeof r0.qty !== 'number' || !Number.isFinite(r0.qty) || r0.qty < 0) {
          failures.push(`relief0Qty:${String(r0.qty)}`);
        }
        if (typeof r0.unit !== 'string' || r0.unit.length < 1 || r0.unit.length > 60) {
          failures.push(`relief0Unit:${String(r0.unit)}`);
        }
        if ('notes' in r0 && (typeof r0.notes !== 'string' || r0.notes.length > 250)) {
          failures.push(`relief0NotesLen`);
        }
      }
    }
  }
  if (typeof data.trackRestoration !== 'boolean') failures.push('trackRestorationNotBool');
  auditRestorationAgainstRules(data.restoration, 'rest', failures);
  if (checkCreatedAt && !isFirestoreTimestamp(data.createdAt)) {
    failures.push(`createdAtNotTimestamp:${typeof data.createdAt}`);
  }
  if ('updatedAt' in data && !isFirestoreTimestamp(data.updatedAt)) {
    failures.push(`updatedAtNotTimestamp:${typeof data.updatedAt}`);
  }
  return failures;
}

export async function saveDamageEntryToCloud(
  entry: DamageEntry,
  uid: string,
  isAdmin: boolean,
  isEdit?: boolean
): Promise<void> {
  const safeId = toSafeDocId(entry.id || `LD-${Date.now()}`, 'LD');
  const path = `damageEntries/${safeId}`;
  const docRef = doc(db, 'damageEntries', safeId);
  let activeOp: OperationType = OperationType.WRITE;
  let diagnosticContext: Record<string, unknown> = { safeId, isEdit: Boolean(isEdit), isAdmin };

  try {
    // Refresh the Firebase ID token so email_verified and the admin email claim
    // used by Firestore Rules are current before the read/write sequence.
    await refreshVerifiedSession(uid);

    if (isEdit === false) {
      const fields = buildDamageEntryFields(entry, safeId, uid, isAdmin);
      activeOp = OperationType.CREATE;
      diagnosticContext = {
        ...diagnosticContext,
        branch: 'create',
        ruleMirrorFailures: auditDamageEntryAgainstRules(fields, safeId),
        payloadKeys: Object.keys(fields),
      };
      await setDoc(docRef, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    activeOp = OperationType.GET;
    const existingSnap = await readExistingDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const existingIdValid = existingData.id === safeId;
      const existingOwnerIdValid =
        typeof existingData.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existingData.ownerId);
      const existingCreatedAtValid = isFirestoreTimestamp(existingData.createdAt);
      const requestedOwnerValid =
        isAdmin &&
        typeof entry.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(entry.ownerId);
      const ownerId = requestedOwnerValid
        ? (entry.ownerId as string)
        : existingOwnerIdValid
        ? (existingData.ownerId as string)
        : uid;

      const resolvedAssignedIds =
        entry.assignedIds !== undefined
          ? entry.assignedIds
          : Array.isArray(existingData.assignedIds)
          ? (existingData.assignedIds as string[])
          : [];

      const fields = buildDamageEntryFields(
        { ...entry, assignedIds: resolvedAssignedIds },
        safeId,
        ownerId,
        isAdmin
      );
      if (!isAdmin) {
        fields.verification = VALID_VERIFICATIONS.includes(
          existingData.verification as VerificationStatus
        )
          ? existingData.verification
          : 'Pending Review';
      }

      if (isAdmin) {
        const fullPreview: Record<string, unknown> = {
          ...fields,
          ...(existingCreatedAtValid ? { createdAt: existingData.createdAt } : {}),
        };
        activeOp = OperationType.UPDATE;
        diagnosticContext = {
          ...diagnosticContext,
          branch: 'admin-set-update',
          existingIdValid,
          existingOwnerIdValid,
          existingCreatedAtValid,
          existingOwnerId: existingData.ownerId,
          existingVerification: existingData.verification,
          ruleMirrorFailures: auditDamageEntryAgainstRules(
            fullPreview,
            safeId,
            existingCreatedAtValid
          ),
          sectorItemsCount: Array.isArray(fields.sectorItems) ? fields.sectorItems.length : -1,
          reliefItemsCount: Array.isArray(fields.reliefItems) ? fields.reliefItems.length : -1,
          existingKeys: Object.keys(existingData),
          payloadKeys: Object.keys(fields),
        };

        await setDoc(docRef, {
          ...fields,
          createdAt: existingCreatedAtValid ? existingData.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const { id: _id, ownerId: _ownerId, assignedIds: _assignedIds, ...mutable } = fields;
      if (!existingIdValid) {
        mutable.id = safeId;
      }
      if (!existingOwnerIdValid) {
        mutable.ownerId = ownerId;
      }
      if (!existingCreatedAtValid) {
        mutable.createdAt = serverTimestamp();
      }
      if (!fields.photoName && 'photoName' in existingData) {
        mutable.photoName = deleteField();
      }
      if (!fields.photoDataUrl && 'photoDataUrl' in existingData) {
        mutable.photoDataUrl = deleteField();
      }

      const removedLegacyKeys: string[] = [];
      Object.keys(existingData).forEach((key) => {
        if (!ALLOWED_DAMAGE_ENTRY_KEYS.has(key)) {
          mutable[key] = deleteField();
          removedLegacyKeys.push(key);
        }
      });

      const mergedPreview: Record<string, unknown> = {
        ...existingData,
        ...mutable,
      };
      if (!fields.photoName) delete mergedPreview.photoName;
      if (!fields.photoDataUrl) delete mergedPreview.photoDataUrl;
      removedLegacyKeys.forEach((k) => delete mergedPreview[k]);

      activeOp = OperationType.UPDATE;
      diagnosticContext = {
        ...diagnosticContext,
        branch: 'update',
        existingIdValid,
        existingOwnerIdValid,
        existingCreatedAtValid,
        existingOwnerId: existingData.ownerId,
        existingVerification: existingData.verification,
        ruleMirrorFailures: auditDamageEntryAgainstRules(
          mergedPreview,
          safeId,
          existingCreatedAtValid
        ),
        sectorItemsCount: Array.isArray(fields.sectorItems) ? fields.sectorItems.length : -1,
        reliefItemsCount: Array.isArray(fields.reliefItems) ? fields.reliefItems.length : -1,
        removedLegacyKeys,
        existingKeys: Object.keys(existingData),
        payloadKeys: Object.keys(mutable),
      };

      await updateDoc(docRef, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    } else {
      const fields = buildDamageEntryFields(entry, safeId, uid, isAdmin);
      activeOp = OperationType.CREATE;
      diagnosticContext = {
        ...diagnosticContext,
        branch: 'create-fallback',
        ruleMirrorFailures: auditDamageEntryAgainstRules(fields, safeId),
        payloadKeys: Object.keys(fields),
      };
      await setDoc(docRef, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('DamageEntry write diagnostic:', JSON.stringify(diagnosticContext));
    handleFirestoreError(err, activeOp, path);
  }
}

const ALLOWED_DAMAGE_STANDARD_KEYS = new Set([
  'id',
  'ownerId',
  'scope',
  'code',
  'sector',
  'name',
  'severity',
  'unit',
  'unitCost',
  'criteria',
  'customQuestions',
  'createdAt',
  'updatedAt',
]);

const ALLOWED_SECTOR_KEYS = new Set([
  'id',
  'ownerId',
  'scope',
  'name',
  'questions',
  'createdAt',
  'updatedAt',
]);

const ALLOWED_LOCAL_BODY_KEYS = new Set([
  'id',
  'ownerId',
  'scope',
  'province',
  'district',
  'name',
  'wards',
  'createdAt',
  'updatedAt',
]);

const REQUIRED_DAMAGE_ENTRY_KEYS = [
  'id',
  'ownerId',
  'date',
  'province',
  'district',
  'municipality',
  'ward',
  'hazard',
  'title',
  'sector',
  'standardId',
  'standardName',
  'severity',
  'unit',
  'qty',
  'lossNPR',
  'sectorItems',
  'deaths',
  'missing',
  'injured',
  'affectedHH',
  'fullyDisplaced',
  'tempDisplaced',
  'affectedPop',
  'casualties',
  'officer',
  'contact',
  'verification',
  'priority',
  'remarks',
  'trackRestoration',
  'restoration',
  'createdAt',
  'updatedAt',
];

export async function updateEntryRestorationInCloud(
  entryId: string,
  restoration: RestorationState,
  sectorItems?: SectorAssessmentItem[],
  uid?: string,
  isAdmin = false
): Promise<void> {
  const safeId = toSafeDocId(entryId, 'LD');
  const path = `damageEntries/${safeId}`;
  const docRef = doc(db, 'damageEntries', safeId);
  const safeUid = uid && /^[a-zA-Z0-9_-]{1,128}$/.test(uid) ? uid : toSafeDocId(uid || 'USR', 'USR');

  try {
    const payload: Record<string, unknown> = {
      trackRestoration: true,
      restoration: sanitizeRestoration(restoration),
      updatedAt: serverTimestamp(),
    };
    if (Array.isArray(sectorItems)) {
      payload.sectorItems = sanitizeSectorItems(sectorItems);
    }

    const existingSnap = await readExistingDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const missingRequired = REQUIRED_DAMAGE_ENTRY_KEYS.some((k) => !(k in existingData));
      const existingIdValid = existingData.id === safeId;
      const existingOwnerIdValid =
        typeof existingData.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existingData.ownerId);
      const existingCreatedAtValid = isFirestoreTimestamp(existingData.createdAt);

      if (missingRequired || !existingIdValid || !existingOwnerIdValid || !existingCreatedAtValid) {
        const ownerId = existingOwnerIdValid ? (existingData.ownerId as string) : safeUid;
        const reconstructed = buildDamageEntryFields(
          {
            ...(existingData as Partial<DamageEntry>),
            id: safeId,
            trackRestoration: true,
            restoration,
            sectorItems: Array.isArray(sectorItems)
              ? sectorItems
              : (existingData.sectorItems as SectorAssessmentItem[] | undefined) || [],
          } as DamageEntry,
          safeId,
          ownerId,
          isAdmin
        );
        if (!isAdmin) {
          reconstructed.verification = VALID_VERIFICATIONS.includes(
            existingData.verification as VerificationStatus
          )
            ? existingData.verification
            : 'Pending Review';
        }
        const { id: _id, ownerId: _ownerId, assignedIds: _assignedIds, ...mutable } = reconstructed;
        if (!existingIdValid && isAdmin) mutable.id = safeId;
        if (!existingOwnerIdValid && isAdmin) mutable.ownerId = ownerId;
        if (isAdmin) mutable.assignedIds = reconstructed.assignedIds;
        if (!existingCreatedAtValid) mutable.createdAt = serverTimestamp();

        Object.keys(existingData).forEach((key) => {
          if (!ALLOWED_DAMAGE_ENTRY_KEYS.has(key)) {
            mutable[key] = deleteField();
          }
        });

        await updateDoc(docRef, {
          ...mutable,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      Object.keys(existingData).forEach((key) => {
        if (!ALLOWED_DAMAGE_ENTRY_KEYS.has(key)) {
          payload[key] = deleteField();
        }
      });
    }

    await updateDoc(docRef, payload);
  } catch (err) {
    console.error('Restoration update diagnostic:', { safeId, isAdmin });
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteDamageEntryFromCloud(entryId: string): Promise<void> {
  const safeId = toSafeDocId(entryId, 'LD');
  const path = `damageEntries/${safeId}`;
  try {
    await deleteDoc(doc(db, 'damageEntries', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function clearEntriesFromCloud(entryIds: string[]): Promise<void> {
  if (entryIds.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < entryIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      entryIds.slice(i, i + chunkSize).forEach((id) => {
        const safeId = toSafeDocId(id, 'LD');
        batch.delete(doc(db, 'damageEntries', safeId));
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'damageEntries');
  }
}

export async function saveDamageStandardToCloud(
  standard: DamageStandard,
  uid: string,
  isAdmin: boolean
): Promise<void> {
  const safeId = toSafeDocId(standard.id || `STD-${Date.now()}`, 'STD');
  const safeUid = /^[a-zA-Z0-9_-]{1,128}$/.test(uid) ? uid : toSafeDocId(uid || 'USR', 'USR');
  const path = `damageStandards/${safeId}`;
  const docRef = doc(db, 'damageStandards', safeId);

  const baseFields: Record<string, unknown> = {
    sector: clampStr(standard.sector, 120, 'Other') || 'Other',
    name: clampStr(standard.name, 200, 'Damage Standard') || 'Damage Standard',
    severity: sanitizeSeverity(standard.severity),
    unit: clampStr(standard.unit, 60, 'Units') || 'Units',
    unitCost: clampNum(standard.unitCost, 0),
  };
  const code = clampStr(standard.code, 60);
  if (code) baseFields.code = code;
  const criteria = clampStr(standard.criteria, 1000);
  if (criteria) baseFields.criteria = criteria;
  if (Array.isArray(standard.customQuestions) && standard.customQuestions.length > 0) {
    baseFields.customQuestions = sanitizeQuestions(standard.customQuestions).slice(0, 30);
  }

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const existingIdValid = existingData.id === safeId;
      const existingOwnerIdValid =
        typeof existingData.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existingData.ownerId);
      const existingCreatedAtValid = isFirestoreTimestamp(existingData.createdAt);
      const targetScope = isAdmin
        ? existingData.scope === 'user' || existingData.scope === 'system'
          ? existingData.scope
          : 'system'
        : 'user';

      const payload: Record<string, unknown> = {
        ...baseFields,
        code: code ? code : deleteField(),
        criteria: criteria ? criteria : deleteField(),
        customQuestions:
          Array.isArray(standard.customQuestions) && standard.customQuestions.length > 0
            ? sanitizeQuestions(standard.customQuestions).slice(0, 30)
            : deleteField(),
        scope: targetScope,
        updatedAt: serverTimestamp(),
      };
      if (!existingIdValid && isAdmin) {
        payload.id = safeId;
      }
      if (!existingOwnerIdValid && isAdmin) {
        payload.ownerId = safeUid;
      }
      if (!existingCreatedAtValid) {
        payload.createdAt = serverTimestamp();
      }
      Object.keys(existingData).forEach((key) => {
        if (!ALLOWED_DAMAGE_STANDARD_KEYS.has(key)) {
          payload[key] = deleteField();
        }
      });

      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        id: safeId,
        ownerId: safeUid,
        scope: isAdmin ? 'system' : 'user',
        ...baseFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('DamageStandard write diagnostic:', { safeId, isAdmin });
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteDamageStandardFromCloud(standardId: string): Promise<void> {
  const safeId = toSafeDocId(standardId, 'STD');
  const path = `damageStandards/${safeId}`;
  try {
    await deleteDoc(doc(db, 'damageStandards', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSectorConfigToCloud(
  sectorName: string,
  questions: SectorQuestion[],
  uid: string,
  isAdmin: boolean
): Promise<void> {
  const cleanName = clampStr(sectorName, 120, 'Other') || 'Other';
  const safeId = sectorDocId(cleanName);
  const safeUid = /^[a-zA-Z0-9_-]{1,128}$/.test(uid) ? uid : toSafeDocId(uid || 'USR', 'USR');
  const path = `sectors/${safeId}`;
  const docRef = doc(db, 'sectors', safeId);
  const cleanQuestions = sanitizeQuestions(questions);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const canUpdateExisting =
        isAdmin || (existingData.scope === 'user' && existingData.ownerId === uid);
      if (!canUpdateExisting) {
        return;
      }
      const existingIdValid = existingData.id === safeId;
      const existingOwnerIdValid =
        typeof existingData.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existingData.ownerId);
      const existingCreatedAtValid = isFirestoreTimestamp(existingData.createdAt);
      const targetScope = isAdmin
        ? existingData.scope === 'user' || existingData.scope === 'system'
          ? existingData.scope
          : 'system'
        : 'user';

      const payload: Record<string, unknown> = {
        name: cleanName,
        questions: cleanQuestions,
        scope: targetScope,
        updatedAt: serverTimestamp(),
      };
      if (!existingIdValid && isAdmin) {
        payload.id = safeId;
      }
      if (!existingOwnerIdValid && isAdmin) {
        payload.ownerId = safeUid;
      }
      if (!existingCreatedAtValid) {
        payload.createdAt = serverTimestamp();
      }
      Object.keys(existingData).forEach((key) => {
        if (!ALLOWED_SECTOR_KEYS.has(key)) {
          payload[key] = deleteField();
        }
      });

      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        id: safeId,
        ownerId: safeUid,
        scope: isAdmin ? 'system' : 'user',
        name: cleanName,
        questions: cleanQuestions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('SectorConfig write diagnostic:', { safeId, isAdmin });
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSectorConfigFromCloud(sectorName: string): Promise<void> {
  const safeId = sectorDocId(sectorName);
  const path = `sectors/${safeId}`;
  try {
    await deleteDoc(doc(db, 'sectors', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveLocalBodyToCloud(
  province: string,
  district: string,
  name: string,
  wards: number,
  uid: string,
  isAdmin: boolean
): Promise<void> {
  const cleanProvince = clampStr(province, 100);
  const cleanDistrict = clampStr(district, 100);
  const cleanName = clampStr(name, 150);
  const safeId = localBodyDocId(cleanProvince, cleanDistrict, cleanName);
  const safeUid = /^[a-zA-Z0-9_-]{1,128}$/.test(uid) ? uid : toSafeDocId(uid || 'USR', 'USR');
  const path = `localBodies/${safeId}`;
  const docRef = doc(db, 'localBodies', safeId);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const canUpdateExisting =
        isAdmin || (existingData.scope === 'user' && existingData.ownerId === uid);
      if (!canUpdateExisting) {
        const userScopedId = `${safeId}-${shortHash(safeUid)}`.slice(0, 128);
        const userScopedRef = doc(db, 'localBodies', userScopedId);
        const userScopedSnap = await readExistingDoc(userScopedRef);
        if (userScopedSnap.exists()) {
          const existingScoped = userScopedSnap.data();
          const scopedCreatedAtValid = isFirestoreTimestamp(existingScoped.createdAt);
          await updateDoc(userScopedRef, {
            province: cleanProvince,
            district: cleanDistrict,
            name: cleanName,
            wards: clampNum(wards, 1, 40),
            scope: 'user',
            ...(!scopedCreatedAtValid ? { createdAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userScopedRef, {
            id: userScopedId,
            ownerId: safeUid,
            scope: 'user',
            province: cleanProvince,
            district: cleanDistrict,
            name: cleanName,
            wards: clampNum(wards, 1, 40),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return;
      }
      const existingIdValid = existingData.id === safeId;
      const existingOwnerIdValid =
        typeof existingData.ownerId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existingData.ownerId);
      const existingCreatedAtValid = isFirestoreTimestamp(existingData.createdAt);
      const targetScope = isAdmin
        ? existingData.scope === 'user' || existingData.scope === 'system'
          ? existingData.scope
          : 'system'
        : 'user';

      const payload: Record<string, unknown> = {
        province: cleanProvince,
        district: cleanDistrict,
        name: cleanName,
        wards: clampNum(wards, 1, 40),
        scope: targetScope,
        updatedAt: serverTimestamp(),
      };
      if (!existingIdValid && isAdmin) {
        payload.id = safeId;
      }
      if (!existingOwnerIdValid && isAdmin) {
        payload.ownerId = safeUid;
      }
      if (!existingCreatedAtValid) {
        payload.createdAt = serverTimestamp();
      }
      Object.keys(existingData).forEach((key) => {
        if (!ALLOWED_LOCAL_BODY_KEYS.has(key)) {
          payload[key] = deleteField();
        }
      });

      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        id: safeId,
        ownerId: safeUid,
        scope: isAdmin ? 'system' : 'user',
        province: cleanProvince,
        district: cleanDistrict,
        name: cleanName,
        wards: clampNum(wards, 1, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('LocalBody write diagnostic:', { safeId, isAdmin });
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function seedSystemCatalogToCloud(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    DEFAULT_SECTORS.forEach((secName) => {
      const id = sectorDocId(secName);
      batch.set(
        doc(db, 'sectors', id),
        {
          id,
          ownerId: uid,
          scope: 'system',
          name: clampStr(secName, 120),
          questions: sanitizeQuestions(DEFAULT_SECTOR_QUESTIONS[secName] || []),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    });

    DEFAULT_STANDARDS.forEach((std) => {
      const safeId = toSafeDocId(std.id, 'STD');
      batch.set(
        doc(db, 'damageStandards', safeId),
        {
          id: safeId,
          ownerId: uid,
          scope: 'system',
          ...(std.code ? { code: clampStr(std.code, 60) } : {}),
          sector: clampStr(std.sector, 120),
          name: clampStr(std.name, 200),
          severity: sanitizeSeverity(std.severity),
          unit: clampStr(std.unit, 60),
          unitCost: clampNum(std.unitCost, 0),
          ...(std.criteria ? { criteria: clampStr(std.criteria, 1000) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'systemCatalogSeed');
  }
}

export function subscribeToEntries(
  uid: string,
  isBootstrappedSuperAdmin: boolean,
  onData: (entries: DamageEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'damageEntries';
  if (isBootstrappedSuperAdmin) {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as DamageEntry);
        list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
        onData(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
  }

  let ownedEntries: DamageEntry[] = [];
  let assignedEntries: DamageEntry[] = [];

  const emitMerged = () => {
    const map = new Map<string, DamageEntry>();
    ownedEntries.forEach((e) => map.set(e.id, e));
    assignedEntries.forEach((e) => map.set(e.id, e));
    const list = Array.from(map.values());
    list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
    onData(list);
  };

  const unsubOwned = onSnapshot(
    query(collection(db, path), where('ownerId', '==', uid)),
    (snapshot) => {
      ownedEntries = snapshot.docs.map((d) => d.data() as DamageEntry);
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `${path}[owner]`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubAssigned = onSnapshot(
    query(collection(db, path), where('assignedIds', 'array-contains', uid)),
    (snapshot) => {
      assignedEntries = snapshot.docs.map((d) => d.data() as DamageEntry);
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `${path}[assigned]`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubOwned();
    unsubAssigned();
  };
}

function subscribeCatalog<T extends { id: string }>(
  collectionName: string,
  uid: string,
  isBootstrappedAdmin: boolean,
  onData: (items: T[], hasLoaded: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (isBootstrappedAdmin) {
    return onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        onData(
          snapshot.docs.map((d) => d.data() as T),
          true
        );
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, collectionName);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
  }

  let systemItems: T[] = [];
  let userItems: T[] = [];
  let systemReady = false;
  let userReady = false;

  const emitMerged = () => {
    const map = new Map<string, T>();
    systemItems.forEach((item) => map.set(item.id, item));
    userItems.forEach((item) => map.set(item.id, item));
    onData(Array.from(map.values()), systemReady && userReady);
  };

  const unsubSystem = onSnapshot(
    query(collection(db, collectionName), where('scope', '==', 'system')),
    (snapshot) => {
      systemItems = snapshot.docs.map((d) => d.data() as T);
      systemReady = true;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `${collectionName}[system]`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubUser = onSnapshot(
    query(collection(db, collectionName), where('ownerId', '==', uid)),
    (snapshot) => {
      userItems = snapshot.docs.map((d) => d.data() as T);
      userReady = true;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `${collectionName}[user]`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubSystem();
    unsubUser();
  };
}

export function subscribeToStandards(
  uid: string,
  isBootstrappedAdmin: boolean,
  onData: (items: DamageStandard[], hasLoaded: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return subscribeCatalog<DamageStandard>(
    'damageStandards',
    uid,
    isBootstrappedAdmin,
    onData,
    onError
  );
}

export function subscribeToSectors(
  uid: string,
  isBootstrappedAdmin: boolean,
  onData: (items: StoredSectorConfig[], hasLoaded: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return subscribeCatalog<StoredSectorConfig>(
    'sectors',
    uid,
    isBootstrappedAdmin,
    onData,
    onError
  );
}

export function subscribeToLocalBodies(
  uid: string,
  isBootstrappedAdmin: boolean,
  onData: (items: StoredLocalBody[], hasLoaded: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return subscribeCatalog<StoredLocalBody>(
    'localBodies',
    uid,
    isBootstrappedAdmin,
    onData,
    onError
  );
}

// -----------------------------------------------------------------------------
// Super Admin & ID Assignment Services
// -----------------------------------------------------------------------------

export function roleAssignmentDocId(email: string): string {
  const clean = email.trim().toLowerCase();
  return `RA-${shortHash(clean)}`.slice(0, 128);
}

export async function upsertUserProfileInCloud(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<void> {
  const safeUid = toSafeDocId(uid, 'USR');
  const cleanEmail = clampStr(email.toLowerCase(), 200);
  if (!cleanEmail) return;
  const cleanDisplayName = clampStr(displayName || '', 150);
  const docRef = doc(db, 'users', safeUid);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const hasValidCreatedAt = isFirestoreTimestamp(existingData.createdAt);
      const payload: Record<string, unknown> = {
        uid: safeUid,
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      };
      if (cleanDisplayName) {
        payload.displayName = cleanDisplayName;
      } else if ('displayName' in existingData) {
        payload.displayName = deleteField();
      }
      if (!hasValidCreatedAt) {
        payload.createdAt = serverTimestamp();
      }
      const allowedUserKeys = new Set(['uid', 'email', 'displayName', 'createdAt', 'updatedAt']);
      Object.keys(existingData).forEach((key) => {
        if (!allowedUserKeys.has(key)) {
          payload[key] = deleteField();
        }
      });
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        uid: safeUid,
        email: cleanEmail,
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('User profile sync skipped:', err);
  }
}

export async function ensureSuperAdminRecordInCloud(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<void> {
  const safeUid = toSafeDocId(uid, 'USR');
  const docRef = doc(db, 'admins', safeUid);
  const cleanEmail = clampStr(email.toLowerCase(), 200);
  const cleanDisplayName = clampStr(displayName || '', 150);
  const allowedAdminKeys = new Set([
    'uid',
    'role',
    'email',
    'displayName',
    'assignedBy',
    'inviteId',
    'createdAt',
    'updatedAt',
  ]);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const hasValidCreatedAt = isFirestoreTimestamp(existingData.createdAt);
      const hasLegacyKeys = Object.keys(existingData).some((k) => !allowedAdminKeys.has(k));
      if (
        existingData.role === 'superadmin' &&
        hasValidCreatedAt &&
        existingData.updatedAt &&
        existingData.email === cleanEmail &&
        !hasLegacyKeys
      ) {
        return;
      }
      const payload: Record<string, unknown> = {
        uid: safeUid,
        role: 'superadmin',
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        ...(!hasValidCreatedAt ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      };
      Object.keys(existingData).forEach((key) => {
        if (!allowedAdminKeys.has(key)) {
          payload[key] = deleteField();
        }
      });
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        uid: safeUid,
        role: 'superadmin',
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Superadmin record sync skipped:', err);
  }
}

export async function claimPendingRoleInviteInCloud(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<'superadmin' | 'admin' | null> {
  const cleanEmail = clampStr(email.toLowerCase(), 200);
  if (!cleanEmail) return null;
  const safeUid = toSafeDocId(uid, 'USR');

  try {
    const inviteSnap = await getDocs(
      query(collection(db, 'roleAssignments'), where('email', '==', cleanEmail))
    );
    if (inviteSnap.empty) return null;

    const inviteDoc = inviteSnap.docs[0];
    const inviteData = inviteDoc.data() as RoleAssignmentRecord;
    const role: 'superadmin' | 'admin' =
      inviteData.role === 'superadmin' ? 'superadmin' : 'admin';
    const cleanDisplayName = clampStr(displayName || '', 150);

    await setDoc(doc(db, 'admins', safeUid), {
      uid: safeUid,
      role,
      email: cleanEmail,
      ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
      ...(inviteData.assignedBy ? { assignedBy: inviteData.assignedBy } : {}),
      inviteId: inviteDoc.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return role;
  } catch (err) {
    console.warn('Role invite claim check skipped:', err);
    return null;
  }
}

export async function assignRoleByUidInCloud(
  targetUid: string,
  role: 'superadmin' | 'admin',
  assignedByUid: string,
  email?: string,
  displayName?: string
): Promise<void> {
  const safeTargetUid = toSafeDocId(targetUid, 'USR');
  const safeAssignedBy = toSafeDocId(assignedByUid, 'USR');
  const path = `admins/${safeTargetUid}`;
  const docRef = doc(db, 'admins', safeTargetUid);
  const cleanEmail = clampStr(email?.toLowerCase() || '', 200);
  const cleanDisplayName = clampStr(displayName || '', 150);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const hasValidCreatedAt = isFirestoreTimestamp(existingData.createdAt);
      const payload: Record<string, unknown> = {
        uid: safeTargetUid,
        role,
        assignedBy: safeAssignedBy,
        updatedAt: serverTimestamp(),
      };
      if (cleanEmail) payload.email = cleanEmail;
      if (cleanDisplayName) payload.displayName = cleanDisplayName;
      if (!hasValidCreatedAt) payload.createdAt = serverTimestamp();
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        uid: safeTargetUid,
        role,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        assignedBy: safeAssignedBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revokeAdminUidInCloud(targetUid: string): Promise<void> {
  const safeTargetUid = toSafeDocId(targetUid, 'USR');
  const path = `admins/${safeTargetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', safeTargetUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function assignRoleByEmailInCloud(
  email: string,
  role: 'superadmin' | 'admin',
  assignedByUid: string,
  note?: string,
  knownUsers: UserProfileRecord[] = []
): Promise<{ matchedUid?: string }> {
  const cleanEmail = clampStr(email.trim().toLowerCase(), 200);
  const safeId = roleAssignmentDocId(cleanEmail);
  const safeAssignedBy = toSafeDocId(assignedByUid, 'USR');
  const path = `roleAssignments/${safeId}`;
  const docRef = doc(db, 'roleAssignments', safeId);
  const cleanNote = clampStr(note || '', 200);

  try {
    const snap = await readExistingDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const hasValidCreatedAt = isFirestoreTimestamp(existingData.createdAt);
      const payload: Record<string, unknown> = {
        id: safeId,
        email: cleanEmail,
        role,
        assignedBy: safeAssignedBy,
        updatedAt: serverTimestamp(),
      };
      if (cleanNote) {
        payload.note = cleanNote;
      } else if ('note' in existingData) {
        payload.note = deleteField();
      }
      if (!hasValidCreatedAt) payload.createdAt = serverTimestamp();
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        id: safeId,
        email: cleanEmail,
        role,
        ...(cleanNote ? { note: cleanNote } : {}),
        assignedBy: safeAssignedBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const matchedUser = knownUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (matchedUser) {
      await assignRoleByUidInCloud(
        matchedUser.uid,
        role,
        safeAssignedBy,
        matchedUser.email,
        matchedUser.displayName
      );
      return { matchedUid: matchedUser.uid };
    }
    return {};
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revokeRoleAssignmentInCloud(assignmentId: string): Promise<void> {
  const safeId = toSafeDocId(assignmentId, 'RA');
  const path = `roleAssignments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'roleAssignments', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function assignEntryIdsInCloud(
  entry: DamageEntry,
  nextOwnerId: string,
  nextAssignedIds: string[],
  actingUid: string,
  isAdmin: boolean
): Promise<void> {
  const safeOwner = /^[a-zA-Z0-9_-]{1,128}$/.test(nextOwnerId.trim())
    ? nextOwnerId.trim()
    : toSafeDocId(nextOwnerId, 'USR');
  const cleanAssigned = sanitizeAssignedIds(nextAssignedIds);
  await saveDamageEntryToCloud(
    {
      ...entry,
      ownerId: safeOwner,
      assignedIds: cleanAssigned,
    },
    actingUid,
    isAdmin,
    true
  );
}

export async function grantUidAccessToAllEntriesInCloud(
  targetUid: string,
  entries: DamageEntry[],
  actingUid: string,
  isAdmin: boolean
): Promise<number> {
  const safeTarget = targetUid.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(safeTarget)) return 0;

  const toUpdate = entries.filter(
    (entry) =>
      entry.ownerId !== safeTarget &&
      !(entry.assignedIds || []).includes(safeTarget) &&
      (entry.assignedIds || []).length < 20
  );

  for (const entry of toUpdate) {
    const nextAssigned = sanitizeAssignedIds([...(entry.assignedIds || []), safeTarget]);
    await saveDamageEntryToCloud(
      {
        ...entry,
        assignedIds: nextAssigned,
      },
      actingUid,
      isAdmin,
      true
    );
  }

  return toUpdate.length;
}

export function subscribeToUsersDirectory(
  onData: (users: UserProfileRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as UserProfileRecord);
      list.sort((a, b) => a.email.localeCompare(b.email));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToAdminMembers(
  onData: (admins: AdminMemberRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'admins';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as AdminMemberRecord);
      list.sort((a, b) => (a.role === b.role ? a.uid.localeCompare(b.uid) : a.role === 'superadmin' ? -1 : 1));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToRoleAssignments(
  onData: (assignments: RoleAssignmentRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'roleAssignments';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as RoleAssignmentRecord);
      list.sort((a, b) => a.email.localeCompare(b.email));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
