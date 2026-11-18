export type SeverityLevel = 'Minor' | 'Moderate' | 'Severe' | 'Catastrophic';

export type RestorationStage =
  | 'Not Started'
  | 'Technical Assessment'
  | 'Procurement / Tender'
  | 'In Progress'
  | 'Restored';

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type VerificationStatus =
  | 'Pending Review'
  | 'Field Verified'
  | 'Approved by Palika';

export type UserRole = 'superadmin' | 'admin' | 'officer';

export type ViewId = 'dashboard' | 'entry' | 'restoration' | 'standards' | 'access';

export type QuestionFieldType = 'text' | 'yesno' | 'number' | 'select';

export interface SectorQuestion {
  id: string;
  label: string;
  type: QuestionFieldType;
  options?: string[];
  required?: boolean;
}

export interface LocalLevel {
  name: string;
  wards: number;
}

export type NepalAdminMap = Record<string, Record<string, LocalLevel[]>>;

export interface DamageStandard {
  id: string;
  scope?: 'system' | 'user';
  ownerId?: string;
  code?: string;
  sector: string;
  name: string;
  severity: SeverityLevel;
  unit: string;
  unitCost: number;
  criteria?: string;
  customQuestions?: SectorQuestion[];
}

export interface SectorAssessmentItem {
  id: string;
  sector: string;
  standardId: string;
  standardName: string;
  severity: SeverityLevel;
  unit: string;
  qty: number;
  lossNPR: number;
  answers: Record<string, string>;
  restoration?: RestorationState;
}

export interface RestorationLog {
  date: string;
  note: string;
}

export interface RestorationState {
  stage: RestorationStage;
  progress: number;
  budget: number;
  spent: number;
  agency: string;
  targetDate: string;
  logs: RestorationLog[];
}

export interface ReliefItemRequest {
  id: string;
  name: string;
  qty: number;
  unit: string;
  notes?: string;
}

export interface DamageEntry {
  id: string;
  ownerId?: string;
  assignedIds?: string[];
  date: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  tole: string;
  lat: string;
  lng: string;
  hazard: string;
  title: string;
  sector: string;
  standardId: string;
  standardName: string;
  severity: SeverityLevel;
  unit: string;
  qty: number;
  lossNPR: number;
  sectorItems?: SectorAssessmentItem[];
  deaths?: number;
  missing?: number;
  injured?: number;
  affectedHH: number;
  fullyDisplaced?: number;
  tempDisplaced?: number;
  affectedPop: number;
  casualties: number;
  officer: string;
  contact: string;
  verification: VerificationStatus;
  priority: PriorityLevel;
  remarks: string;
  photoName?: string;
  photoDataUrl?: string;
  reliefDurationDays?: number;
  reliefItems?: ReliefItemRequest[];
  trackRestoration: boolean;
  restoration: RestorationState;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName?: string;
}

export interface AdminMemberRecord {
  uid: string;
  role: 'superadmin' | 'admin';
  email?: string;
  displayName?: string;
  assignedBy?: string;
  inviteId?: string;
}

export interface RoleAssignmentRecord {
  id: string;
  email: string;
  role: 'superadmin' | 'admin';
  note?: string;
  assignedBy: string;
}

export interface MisState {
  admin: NepalAdminMap;
  sectors: string[];
  sectorQuestions: Record<string, SectorQuestion[]>;
  standards: DamageStandard[];
  entries: DamageEntry[];
}
