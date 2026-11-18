import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Coins,
  Crosshair,
  HeartPulse,
  MapPin,
  Package,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  DamageEntry,
  DamageStandard,
  NepalAdminMap,
  PriorityLevel,
  ReliefItemRequest,
  RestorationState,
  SectorAssessmentItem,
  SectorQuestion,
  SeverityLevel,
  VerificationStatus,
} from '../types/mis';
import { DEFAULT_RELIEF_ITEMS, HAZARD_TYPES, RELIEF_UNITS } from '../data/defaults';
import { formatNPR, getEntrySectorItems, summarizeEntryRestoration } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

const REMEMBER_TITLE_FLAG_KEY = 'nepal_mis_remember_title_flag';
const LAST_REMEMBERED_TITLE_KEY = 'nepal_mis_last_title';
const LAST_REMEMBERED_DATE_KEY = 'nepal_mis_last_date';
const LAST_REMEMBERED_HAZARD_KEY = 'nepal_mis_last_hazard';
const REMEMBERED_TITLES_KEY = 'nepal_mis_remembered_titles';
const REMEMBERED_DISASTERS_KEY = 'nepal_mis_remembered_disasters';

export interface RememberedDisaster {
  title: string;
  date: string;
  hazard: string;
}

function loadRememberFlag(): boolean {
  try {
    const val = localStorage.getItem(REMEMBER_TITLE_FLAG_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

function loadLastTitle(): string {
  try {
    return localStorage.getItem(LAST_REMEMBERED_TITLE_KEY) || '';
  } catch {
    return '';
  }
}

function loadLastDate(): string {
  try {
    return localStorage.getItem(LAST_REMEMBERED_DATE_KEY) || '';
  } catch {
    return '';
  }
}

function loadLastHazard(): string {
  try {
    return localStorage.getItem(LAST_REMEMBERED_HAZARD_KEY) || '';
  } catch {
    return '';
  }
}

function loadRememberedDisasters(): RememberedDisaster[] {
  try {
    const rawDisasters = localStorage.getItem(REMEMBERED_DISASTERS_KEY);
    if (rawDisasters) {
      const parsed = JSON.parse(rawDisasters);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (d) => d && typeof d.title === 'string' && d.title.trim().length > 0
          )
          .map((d) => ({
            title: String(d.title).trim(),
            date: typeof d.date === 'string' ? d.date : '',
            hazard: typeof d.hazard === 'string' ? d.hazard : '',
          }));
      }
    }
    const raw = localStorage.getItem(REMEMBERED_TITLES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => ({ title: t.trim(), date: '', hazard: '' }));
    }
    return [];
  } catch {
    return [];
  }
}

interface DraftItemRow {
  id: string;
  standardId: string; // 'CUSTOM_OTHER' for ad-hoc Other item
  customName: string;
  customUnit: string;
  isEditingName?: boolean;
  qty: string;
  lossNPR: string;
  manualLossOverride: boolean;
  restoration?: RestorationState;
}

interface DraftSectorSection {
  id: string;
  sector: string;
  items: DraftItemRow[];
  answers: Record<string, string>;
}

function createEmptyItemRow(standard?: DamageStandard): DraftItemRow {
  return {
    id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    standardId: standard ? standard.id : '',
    customName: '',
    customUnit: standard?.unit || 'Units',
    isEditingName: false,
    qty: '',
    lossNPR: '',
    manualLossOverride: false,
  };
}

function createEmptySectorSection(sector = '', firstStandard?: DamageStandard): DraftSectorSection {
  return {
    id: `SEC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    sector,
    items: [createEmptyItemRow(firstStandard)],
    answers: {},
  };
}

interface DraftReliefRow {
  id: string;
  name: string;
  qty: string;
  unit: string;
  notes: string;
}

function createReliefRow(
  name = '',
  unit = 'Pcs',
  notes = '',
  qty = ''
): DraftReliefRow {
  return {
    id: `REL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name,
    qty,
    unit,
    notes,
  };
}

interface EntryFormViewProps {
  admin: NepalAdminMap;
  sectors: string[];
  sectorQuestions: Record<string, SectorQuestion[]>;
  standards: DamageStandard[];
  existingTitles: string[];
  existingIncidents?: RememberedDisaster[];
  existingReliefNames?: string[];
  editingEntry: DamageEntry | null;
  lastCreatedStandard?: { rowId: string; sector: string; standardId: string } | null;
  onClearLastCreatedStandard: () => void;
  onCancelEdit: () => void;
  onSaveEntry: (entry: DamageEntry, isEdit: boolean) => Promise<boolean> | boolean | void;
  onOpenAddLocalLevel: (province?: string, district?: string) => void;
  onOpenQuickAddSectorStandard: (sectionId: string, currentSector?: string) => void;
  onOpenManageStandards: () => void;
  onNotify: (msg: string) => void;
  isAdmin?: boolean;
}

export const EntryFormView: React.FC<EntryFormViewProps> = ({
  admin,
  sectors,
  sectorQuestions,
  standards,
  existingTitles,
  existingIncidents = [],
  existingReliefNames = [],
  editingEntry,
  lastCreatedStandard,
  onClearLastCreatedStandard,
  onCancelEdit,
  onSaveEntry,
  onOpenAddLocalLevel,
  onOpenQuickAddSectorStandard,
  onOpenManageStandards,
  onNotify,
  isAdmin = false,
}) => {
  const {
    lang,
    t,
    trProvince,
    trDistrict,
    trMunicipality,
    trHazard,
    trSector,
    trPriority,
    trVerification,
    trUnit,
    trStandardName,
    trQuestionLabel,
    trQuestionOption,
    trReliefItem,
  } = useLanguage();

  const today = new Date().toISOString().slice(0, 10);

  // Remembered Disaster context (Incident Title, Date, Disaster Type)
  const [rememberTitle, setRememberTitle] = useState<boolean>(loadRememberFlag);
  const [savedDisasters, setSavedDisasters] = useState<RememberedDisaster[]>(
    loadRememberedDisasters
  );

  // 1. Geography
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [ward, setWard] = useState('');
  const [tole, setTole] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  // 2. Incident & Human/Displacement Impact
  const [date, setDate] = useState(() => (loadRememberFlag() ? loadLastDate() || today : today));
  const [hazard, setHazard] = useState(() => (loadRememberFlag() ? loadLastHazard() : ''));
  const [title, setTitle] = useState(() => (loadRememberFlag() ? loadLastTitle() : ''));

  const [deaths, setDeaths] = useState('0');
  const [missing, setMissing] = useState('0');
  const [injured, setInjured] = useState('0');
  const [affectedHH, setAffectedHH] = useState('0');
  const [fullyDisplaced, setFullyDisplaced] = useState('0');
  const [tempDisplaced, setTempDisplaced] = useState('0');
  const [manualTempOverride, setManualTempOverride] = useState(false);
  const [affectedPop, setAffectedPop] = useState('0');

  // 3. Sector-Wise Sections
  const [sectorSections, setSectorSections] = useState<DraftSectorSection[]>([
    createEmptySectorSection(),
  ]);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // 4. Required Relief Materials
  const [reliefDurationDays, setReliefDurationDays] = useState('21');
  const [reliefItems, setReliefItems] = useState<DraftReliefRow[]>([]);

  // 5. Verification & Restoration
  const [officer, setOfficer] = useState('');
  const [contact, setContact] = useState('');
  const [verification, setVerification] = useState<VerificationStatus>('Pending Review');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [remarks, setRemarks] = useState('');
  const [trackRestoration, setTrackRestoration] = useState(true);
  const [photoName, setPhotoName] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rememberedDisasterChoices = useMemo(() => {
    const byTitle = new Map<string, RememberedDisaster>();
    savedDisasters.forEach((d) => {
      const key = d.title.trim().toLowerCase();
      if (key && !byTitle.has(key)) {
        byTitle.set(key, d);
      }
    });
    existingIncidents.forEach((inc) => {
      const key = inc.title.trim().toLowerCase();
      if (!key) return;
      const existing = byTitle.get(key);
      if (!existing) {
        byTitle.set(key, inc);
      } else if (!existing.date || !existing.hazard) {
        byTitle.set(key, {
          title: existing.title,
          date: existing.date || inc.date,
          hazard: existing.hazard || inc.hazard,
        });
      }
    });
    existingTitles.forEach((tStr) => {
      const clean = tStr.trim();
      const key = clean.toLowerCase();
      if (clean && !byTitle.has(key)) {
        byTitle.set(key, { title: clean, date: '', hazard: '' });
      }
    });
    return Array.from(byTitle.values()).slice(0, 10);
  }, [savedDisasters, existingIncidents, existingTitles]);

  const persistRememberedFields = (nextTitle: string, nextDate: string, nextHazard: string) => {
    if (!rememberTitle || editingEntry) return;
    try {
      localStorage.setItem(LAST_REMEMBERED_TITLE_KEY, nextTitle);
      localStorage.setItem(LAST_REMEMBERED_DATE_KEY, nextDate);
      localStorage.setItem(LAST_REMEMBERED_HAZARD_KEY, nextHazard);
    } catch {
      // ignore storage errors
    }
  };

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    persistRememberedFields(title, nextDate, hazard);
  };

  const handleHazardChange = (nextHazard: string) => {
    setHazard(nextHazard);
    persistRememberedFields(title, date, nextHazard);
  };

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const matched = rememberedDisasterChoices.find(
      (d) => d.title.toLowerCase() === nextTitle.trim().toLowerCase()
    );
    const resolvedDate = matched && matched.date && !editingEntry ? matched.date : date;
    const resolvedHazard = matched && matched.hazard && !editingEntry ? matched.hazard : hazard;
    if (matched && !editingEntry) {
      if (matched.date) setDate(matched.date);
      if (matched.hazard) setHazard(matched.hazard);
    }
    persistRememberedFields(nextTitle, resolvedDate, resolvedHazard);
  };

  const handleSelectRememberedDisaster = (preset: RememberedDisaster) => {
    const nextTitle = preset.title;
    const nextDate = preset.date || date;
    const nextHazard = preset.hazard || hazard;
    setTitle(nextTitle);
    if (preset.date) setDate(preset.date);
    if (preset.hazard) setHazard(preset.hazard);
    persistRememberedFields(nextTitle, nextDate, nextHazard);
  };

  const handleToggleRememberTitle = (checked: boolean) => {
    setRememberTitle(checked);
    try {
      localStorage.setItem(REMEMBER_TITLE_FLAG_KEY, String(checked));
      if (checked) {
        localStorage.setItem(LAST_REMEMBERED_TITLE_KEY, title);
        localStorage.setItem(LAST_REMEMBERED_DATE_KEY, date);
        localStorage.setItem(LAST_REMEMBERED_HAZARD_KEY, hazard);
      } else {
        localStorage.removeItem(LAST_REMEMBERED_TITLE_KEY);
        localStorage.removeItem(LAST_REMEMBERED_DATE_KEY);
        localStorage.removeItem(LAST_REMEMBERED_HAZARD_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  const resetFormFields = (preserveRemembered = true) => {
    setProvince('');
    setDistrict('');
    setMunicipality('');
    setWard('');
    setTole('');
    setLat('');
    setLng('');
    if (preserveRemembered && rememberTitle) {
      setDate(loadLastDate() || new Date().toISOString().slice(0, 10));
      setHazard(loadLastHazard());
      setTitle(loadLastTitle());
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setHazard('');
      setTitle('');
    }
    setDeaths('0');
    setMissing('0');
    setInjured('0');
    setAffectedHH('0');
    setFullyDisplaced('0');
    setTempDisplaced('0');
    setManualTempOverride(false);
    setAffectedPop('0');
    setSectorSections([createEmptySectorSection()]);
    setExpandedQuestions({});
    setReliefDurationDays('21');
    setReliefItems([]);
    setOfficer('');
    setContact('');
    setVerification('Pending Review');
    setPriority('High');
    setRemarks('');
    setTrackRestoration(true);
    setPhotoName('');
    setPhotoDataUrl('');
  };

  // Auto-calculate Temporary Displaced = max(0, Affected Families - Fully Displaced)
  useEffect(() => {
    if (manualTempOverride) return;
    const aff = parseInt(affectedHH, 10) || 0;
    const full = parseInt(fullyDisplaced, 10) || 0;
    setTempDisplaced(String(Math.max(0, aff - full)));
  }, [affectedHH, fullyDisplaced, manualTempOverride]);

  // Load editing entry
  useEffect(() => {
    if (editingEntry) {
      setProvince(editingEntry.province || '');
      setDistrict(editingEntry.district || '');
      setMunicipality(editingEntry.municipality || '');
      setWard(editingEntry.ward || '');
      setTole(editingEntry.tole || '');
      setLat(editingEntry.lat || '');
      setLng(editingEntry.lng || '');
      setDate(editingEntry.date || new Date().toISOString().slice(0, 10));
      setHazard(editingEntry.hazard || '');
      setTitle(editingEntry.title || '');

      setDeaths(String(editingEntry.deaths ?? 0));
      setMissing(String(editingEntry.missing ?? 0));
      setInjured(String(editingEntry.injured ?? 0));
      setAffectedHH(String(editingEntry.affectedHH ?? 0));
      setFullyDisplaced(String(editingEntry.fullyDisplaced ?? 0));
      const derivedTemp =
        typeof editingEntry.tempDisplaced === 'number'
          ? editingEntry.tempDisplaced
          : Math.max(0, (editingEntry.affectedHH || 0) - (editingEntry.fullyDisplaced || 0));
      setTempDisplaced(String(derivedTemp));
      setManualTempOverride(true);
      setAffectedPop(String(editingEntry.affectedPop ?? 0));

      // Group flat sectorItems back into Sector Sections
      const items = getEntrySectorItems(editingEntry);
      const grouped = new Map<string, DraftSectorSection>();
      items.forEach((item) => {
        const key = item.sector || 'Other';
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: `SEC-${key}-${item.id}`,
            sector: key,
            items: [],
            answers: { ...(item.answers || {}) },
          });
        }
        const sec = grouped.get(key)!;
        const matchedStd =
          item.standardId && item.standardId !== 'CUSTOM_OTHER'
            ? standards.find((s) => s.id === item.standardId) ||
              standards.find(
                (s) =>
                  s.sector.toLowerCase() === key.toLowerCase() &&
                  s.name.toLowerCase() === (item.standardName || '').trim().toLowerCase()
              )
            : undefined;
        const resolvedStandardId = matchedStd ? matchedStd.id : 'CUSTOM_OTHER';
        const nameDiffers = Boolean(
          matchedStd &&
            item.standardName &&
            item.standardName.trim().toLowerCase() !== matchedStd.name.trim().toLowerCase()
        );
        sec.items.push({
          id: item.id,
          standardId: resolvedStandardId,
          customName:
            resolvedStandardId === 'CUSTOM_OTHER' || nameDiffers ? item.standardName || '' : '',
          customUnit: item.unit || matchedStd?.unit || 'Units',
          isEditingName: nameDiffers,
          qty: String(item.qty),
          lossNPR: String(item.lossNPR),
          manualLossOverride: true,
          restoration: item.restoration,
        });
        sec.answers = { ...sec.answers, ...(item.answers || {}) };
      });
      const builtSections = Array.from(grouped.values());
      setSectorSections(
        builtSections.length > 0 ? builtSections : [createEmptySectorSection()]
      );
      const nextExpanded: Record<string, boolean> = {};
      builtSections.forEach((sec) => {
        if (Object.values(sec.answers).some((v) => Boolean(v && String(v).trim()))) {
          nextExpanded[sec.id] = true;
        }
      });
      setExpandedQuestions(nextExpanded);

      setOfficer(editingEntry.officer || '');
      setContact(editingEntry.contact || '');
      setVerification(editingEntry.verification || 'Pending Review');
      setPriority(editingEntry.priority || 'High');
      setRemarks(editingEntry.remarks || '');
      setReliefDurationDays(String(editingEntry.reliefDurationDays ?? 21));
      setReliefItems(
        Array.isArray(editingEntry.reliefItems)
          ? editingEntry.reliefItems.map((ri) => ({
              id: ri.id,
              name: ri.name,
              qty: String(ri.qty ?? ''),
              unit: ri.unit || 'Pcs',
              notes: ri.notes || '',
            }))
          : []
      );
      setTrackRestoration(Boolean(editingEntry.trackRestoration));
      setPhotoName(editingEntry.photoName || '');
      setPhotoDataUrl(editingEntry.photoDataUrl || '');
    } else {
      resetFormFields(true);
    }
  }, [editingEntry]);

  // Apply newly created sector/standard from QuickSectorStandardModal
  useEffect(() => {
    if (!lastCreatedStandard) return;
    const { rowId: sectionId, sector, standardId } = lastCreatedStandard;
    const std = standards.find((s) => s.id === standardId);

    setSectorSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const firstEmpty = sec.items.find((i) => !i.standardId);
        const nextItems = firstEmpty
          ? sec.items.map((item) =>
              item.id === firstEmpty.id
                ? {
                    ...item,
                    standardId,
                    lossNPR:
                      !item.manualLossOverride && std && std.unitCost > 0 && item.qty
                        ? String(Math.round((parseFloat(item.qty) || 0) * std.unitCost))
                        : item.lossNPR,
                  }
                : item
            )
          : [...sec.items, createEmptyItemRow(std)];
        return {
          ...sec,
          sector,
          items: nextItems,
        };
      })
    );
    onClearLastCreatedStandard();
  }, [lastCreatedStandard, standards, onClearLastCreatedStandard]);

  const provinces = useMemo(() => Object.keys(admin), [admin]);
  const districts = useMemo(
    () => (province && admin[province] ? Object.keys(admin[province]).sort() : []),
    [admin, province]
  );
  const municipalities = useMemo(
    () => (province && district && admin[province]?.[district] ? admin[province][district] : []),
    [admin, province, district]
  );
  const wardOptions = useMemo(() => {
    const munObj = municipalities.find((m) => m.name === municipality);
    const total = munObj ? munObj.wards : 0;
    return Array.from({ length: total }, (_, idx) => String(idx + 1));
  }, [municipalities, municipality]);

  const allSectorOptions = useMemo(() => {
    const fromStandards = standards.map((s) => s.sector);
    return Array.from(new Set([...sectors, ...fromStandards])).sort();
  }, [sectors, standards]);

  const totals = useMemo(() => {
    let totalLoss = 0;
    let totalItems = 0;
    sectorSections.forEach((sec) => {
      sec.items.forEach((item) => {
        totalItems += 1;
        totalLoss += parseFloat(item.lossNPR) || 0;
      });
    });
    return { totalLoss, totalItems };
  }, [sectorSections]);

  const updateSection = (
    sectionId: string,
    updater: (sec: DraftSectorSection) => DraftSectorSection
  ) => {
    setSectorSections((prev) => prev.map((s) => (s.id === sectionId ? updater(s) : s)));
  };

  const handleSectionSectorChange = (sectionId: string, nextSector: string) => {
    const firstStd = standards.find((st) => st.sector === nextSector);
    updateSection(sectionId, (sec) => ({
      ...sec,
      sector: nextSector,
      items: [createEmptyItemRow(firstStd)],
      answers: {},
    }));
  };

  const handleAddItemInSection = (sectionId: string, std?: DamageStandard, isOther = false) => {
    updateSection(sectionId, (sec) => ({
      ...sec,
      items: [
        ...sec.items,
        isOther
          ? {
              id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              standardId: 'CUSTOM_OTHER',
              customName: '',
              customUnit: 'Units',
              isEditingName: false,
              qty: '',
              lossNPR: '',
              manualLossOverride: true,
            }
          : createEmptyItemRow(std),
      ],
    }));
  };

  const handleItemChange = (
    sectionId: string,
    itemId: string,
    patch: Partial<DraftItemRow>
  ) => {
    updateSection(sectionId, (sec) => ({
      ...sec,
      items: sec.items.map((item) => {
        if (item.id !== itemId) return item;
        const merged = { ...item, ...patch };
        if (patch.standardId !== undefined && patch.standardId !== 'CUSTOM_OTHER') {
          const std = standards.find((s) => s.id === patch.standardId);
          if (std && (std.severity === 'Catastrophic' || std.severity === 'Severe')) {
            setTrackRestoration(true);
          }
          if (patch.isEditingName === undefined) {
            merged.isEditingName = false;
          }
          if (patch.customName === undefined) {
            merged.customName = '';
          }
          if (std && patch.customUnit === undefined) {
            merged.customUnit = std.unit || 'Units';
          }
          const nQty = parseFloat(merged.qty);
          if (std && std.unitCost > 0 && !merged.manualLossOverride && !isNaN(nQty) && nQty >= 0) {
            merged.lossNPR = String(Math.round(nQty * std.unitCost));
          }
        }
        if (patch.qty !== undefined && merged.standardId !== 'CUSTOM_OTHER') {
          const std = standards.find((s) => s.id === merged.standardId);
          const nQty = parseFloat(patch.qty);
          if (std && std.unitCost > 0 && !isNaN(nQty) && nQty >= 0) {
            merged.manualLossOverride = false;
            merged.lossNPR = String(Math.round(nQty * std.unitCost));
          }
        }
        return merged;
      }),
    }));
  };

  const handleAnswerChange = (sectionId: string, questionLabel: string, value: string) => {
    updateSection(sectionId, (sec) => ({
      ...sec,
      answers: {
        ...sec.answers,
        [questionLabel]: value,
      },
    }));
  };

  const getQuestionsForSection = (sec: DraftSectorSection): SectorQuestion[] => {
    const baseQuestions = sec.sector ? sectorQuestions[sec.sector] || [] : [];
    const selectedStdIds = new Set(sec.items.map((i) => i.standardId));
    const stdQuestions = standards
      .filter((s) => selectedStdIds.has(s.id))
      .flatMap((s) => s.customQuestions || []);

    const seen = new Set<string>();
    const combined: SectorQuestion[] = [];
    [...baseQuestions, ...stdQuestions].forEach((q) => {
      const key = q.label.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(q);
      }
    });
    return combined;
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      onNotify(
        lang === 'ne'
          ? 'यो ब्राउजरमा GPS स्थान समर्थन गर्दैन।'
          : 'GPS geolocation is not supported on this browser.'
      );
      return;
    }
    onNotify(lang === 'ne' ? 'GPS निर्देशाङ्क लिइँदैछ...' : 'Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        onNotify(lang === 'ne' ? 'GPS निर्देशाङ्क प्राप्त भयो।' : 'GPS coordinates captured.');
      },
      () => {
        onNotify(
          lang === 'ne'
            ? 'GPS प्राप्त गर्न सकिएन। अक्षांश र देशान्तर म्यानुअल रूपमा लेख्नुहोस्।'
            : 'Unable to access GPS. Enter latitude and longitude manually.'
        );
      }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.65);
          setPhotoDataUrl(compressed.length <= 145000 ? compressed : '');
        } else {
          setPhotoDataUrl(rawUrl.length <= 145000 ? rawUrl : '');
        }
      };
      img.onerror = () => {
        setPhotoDataUrl(rawUrl.length <= 145000 ? rawUrl : '');
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanTitle = title.trim();
    if (cleanTitle) {
      const nextSaved: RememberedDisaster[] = [
        { title: cleanTitle, date, hazard },
        ...savedDisasters.filter(
          (item) => item.title.toLowerCase() !== cleanTitle.toLowerCase()
        ),
      ].slice(0, 12);
      setSavedDisasters(nextSaved);
      try {
        localStorage.setItem(REMEMBERED_DISASTERS_KEY, JSON.stringify(nextSaved));
        localStorage.setItem(
          REMEMBERED_TITLES_KEY,
          JSON.stringify(nextSaved.map((item) => item.title))
        );
        if (rememberTitle) {
          localStorage.setItem(LAST_REMEMBERED_TITLE_KEY, cleanTitle);
          localStorage.setItem(LAST_REMEMBERED_DATE_KEY, date);
          localStorage.setItem(LAST_REMEMBERED_HAZARD_KEY, hazard);
        }
      } catch {
        // ignore storage errors
      }
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const builtItems: SectorAssessmentItem[] = [];
    sectorSections.forEach((sec) => {
      sec.items.forEach((item) => {
        const isCustom = item.standardId === 'CUSTOM_OTHER';
        const std = !isCustom ? standards.find((s) => s.id === item.standardId) : undefined;
        const isManualName = isCustom || Boolean(item.isEditingName);
        const resolvedName = isManualName
          ? item.customName.trim() || std?.name || 'Other Damage Item'
          : std?.name || 'Custom Standard';
        const nameEdited = Boolean(std && resolvedName.toLowerCase() !== std.name.toLowerCase());
        const itemLoss = parseFloat(item.lossNPR) || 0;

        builtItems.push({
          id: item.id,
          sector: sec.sector || 'Other',
          standardId:
            isCustom || nameEdited || !item.standardId ? 'CUSTOM_OTHER' : item.standardId,
          standardName: resolvedName,
          severity: std ? std.severity : 'Moderate',
          unit: isManualName ? item.customUnit.trim() || std?.unit || 'Units' : std?.unit || 'Units',
          qty: parseFloat(item.qty) || 0,
          lossNPR: itemLoss,
          answers: { ...sec.answers },
          restoration: item.restoration || {
            stage: 'Not Started',
            progress: 0,
            budget: itemLoss,
            spent: 0,
            agency: municipality,
            targetDate: '',
            logs: [
              {
                date: todayIso,
                note: `Field assessment recorded (${sec.sector || 'Other'} · ${resolvedName}).`,
              },
            ],
          },
        });
      });
    });

    const primary = builtItems[0];
    const severityOrder: Record<SeverityLevel, number> = {
      Minor: 1,
      Moderate: 2,
      Severe: 3,
      Catastrophic: 4,
    };
    const highestSeverity = builtItems.reduce<SeverityLevel>(
      (max, item) =>
        severityOrder[item.severity] > severityOrder[max] ? item.severity : max,
      primary?.severity || 'Moderate'
    );

    const aggregatedLoss = builtItems.reduce((sum, item) => sum + item.lossNPR, 0);
    const nDeaths = parseInt(deaths, 10) || 0;
    const nMissing = parseInt(missing, 10) || 0;
    const nInjured = parseInt(injured, 10) || 0;
    const nAffectedHH = parseInt(affectedHH, 10) || 0;
    const nFullyDisplaced = parseInt(fullyDisplaced, 10) || 0;
    const nTempDisplaced = parseInt(tempDisplaced, 10) || 0;

    const builtReliefItems: ReliefItemRequest[] = reliefItems
      .filter((row) => row.name.trim().length > 0)
      .map((row) => {
        const cleanNotes = row.notes.trim();
        return {
          id: row.id,
          name: row.name.trim(),
          qty: parseFloat(row.qty) || 0,
          unit: row.unit.trim() || 'Pcs',
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        };
      });

    const record: DamageEntry = {
      id:
        editingEntry?.id ||
        `LD-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(
          10 + Math.random() * 90
        )}`,
      date,
      province,
      district,
      municipality,
      ward,
      tole: tole.trim(),
      lat: lat.trim(),
      lng: lng.trim(),
      hazard,
      title: cleanTitle,
      sector: primary?.sector || 'Other',
      standardId: primary?.standardId || 'CUSTOM_OTHER',
      standardName:
        builtItems.length > 1
          ? `${primary.standardName} (+${builtItems.length - 1} more)`
          : primary?.standardName || 'Custom Standard',
      severity: highestSeverity,
      unit: primary?.unit || 'Units',
      qty: primary?.qty || 0,
      lossNPR: aggregatedLoss,
      sectorItems: builtItems,
      deaths: nDeaths,
      missing: nMissing,
      injured: nInjured,
      affectedHH: nAffectedHH,
      fullyDisplaced: nFullyDisplaced,
      tempDisplaced: nTempDisplaced,
      affectedPop: parseInt(affectedPop, 10) || 0,
      casualties: nDeaths + nMissing + nInjured,
      officer: officer.trim(),
      contact: contact.trim(),
      verification,
      priority,
      remarks: remarks.trim(),
      photoName: photoName || undefined,
      photoDataUrl: photoDataUrl || undefined,
      reliefDurationDays: Math.max(0, parseInt(reliefDurationDays, 10) || 0),
      reliefItems: builtReliefItems,
      trackRestoration,
      restoration: summarizeEntryRestoration(
        {
          ...(editingEntry || ({ municipality } as DamageEntry)),
          restoration: editingEntry?.restoration || {
            stage: 'Not Started',
            progress: 0,
            budget: aggregatedLoss,
            spent: 0,
            agency: municipality,
            targetDate: '',
            logs: [
              {
                date: todayIso,
                note: `Field assessment recorded (${sectorSections.length} sectors, ${builtItems.length} items).`,
              },
            ],
          },
        } as DamageEntry,
        builtItems
      ),
    };

    setIsSubmitting(true);
    try {
      const saved = await onSaveEntry(record, Boolean(editingEntry));
      if (saved !== false) {
        resetFormFields(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {editingEntry
              ? `${t.editFieldEntryTitle} · ${editingEntry.id}`
              : t.newFieldEntryTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.entryFormSubtitle}</p>
        </div>
        {editingEntry && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {t.cancelEdit}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Geographic Location */}
        <section className="bg-blue-50/25 border border-blue-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-blue-200/70">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-700" />
              <h3 className="font-display text-sm font-semibold text-slate-900">{t.sec01Title}</h3>
            </div>
            <button
              type="button"
              onClick={handleCaptureGPS}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-700" />
              <span>{t.captureGps}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.province} <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict('');
                  setMunicipality('');
                  setWard('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">{t.selectProvince}</option>
                {province && !provinces.includes(province) && (
                  <option value={province}>{trProvince(province)}</option>
                )}
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {trProvince(p)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.district} <span className="text-red-600">*</span>
              </label>
              <select
                required
                disabled={!province}
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setMunicipality('');
                  setWard('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{t.selectDistrict}</option>
                {district && !districts.includes(district) && (
                  <option value={district}>{trDistrict(district)}</option>
                )}
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {trDistrict(d)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.municipality} <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-1.5">
                <select
                  required
                  disabled={!district}
                  value={municipality}
                  onChange={(e) => {
                    setMunicipality(e.target.value);
                    setWard('');
                  }}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">{t.selectLocalLevel}</option>
                  {municipality &&
                    !municipalities.some((m) => m.name === municipality) && (
                      <option value={municipality}>{trMunicipality(municipality)}</option>
                    )}
                  {municipalities.map((m) => (
                    <option key={m.name} value={m.name}>
                      {trMunicipality(m.name)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onOpenAddLocalLevel(province, district)}
                  title={t.addLocalLevelWard}
                  className="px-2.5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.wardNo} <span className="text-red-600">*</span>
              </label>
              <select
                required
                disabled={!municipality}
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{t.selectWard}</option>
                {ward && !wardOptions.includes(ward) && (
                  <option value={ward}>
                    {t.wardNoPrefix} {ward}
                  </option>
                )}
                {wardOptions.map((w) => (
                  <option key={w} value={w}>
                    {t.wardNoPrefix} {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.toleLabel} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={tole}
                onChange={(e) => setTole(e.target.value)}
                placeholder={t.tolePlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.gpsLat}
              </label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g., 26.4525"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.gpsLng}
              </label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g., 87.2718"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Incident, Human Casualties & Displacement */}
        <section className="bg-amber-50/25 border border-amber-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-amber-200/70">
            <Users className="w-4 h-4 text-amber-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">{t.sec02Title}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.incidentDate} <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.hazardType} <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={hazard}
                onChange={(e) => handleHazardChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">{t.selectHazard}</option>
                {hazard && !HAZARD_TYPES.includes(hazard) && (
                  <option value={hazard}>{trHazard(hazard)}</option>
                )}
                {HAZARD_TYPES.map((h) => (
                  <option key={h} value={h}>
                    {trHazard(h)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {t.incidentTitleLabel} <span className="text-red-600">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberTitle}
                    onChange={(e) => handleToggleRememberTitle(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>{t.rememberTitleToggle}</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  list="remembered-incident-titles"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={t.incidentTitlePlaceholder}
                  className="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-lg"
                />
                {title && (
                  <button
                    type="button"
                    onClick={() => handleTitleChange('')}
                    title={t.clearTitleTooltip}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <datalist id="remembered-incident-titles">
                {rememberedDisasterChoices.map((preset) => (
                  <option key={preset.title} value={preset.title} />
                ))}
              </datalist>
              {rememberedDisasterChoices.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500">{t.rememberedTitlesLabel}</span>
                  {rememberedDisasterChoices.slice(0, 4).map((preset) => {
                    const meta = [
                      preset.date,
                      preset.hazard ? trHazard(preset.hazard) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => handleSelectRememberedDisaster(preset)}
                        className={`px-2 py-0.5 text-[11px] rounded border transition-colors truncate max-w-[260px] ${
                          title.trim().toLowerCase() === preset.title.toLowerCase()
                            ? 'bg-blue-50 text-blue-800 border-blue-300 font-medium'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={meta ? `${preset.title} (${meta})` : preset.title}
                      >
                        {preset.title}
                        {meta ? ` (${meta})` : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3.5 mt-4 p-4 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t.death}</label>
              <input
                type="number"
                min="0"
                value={deaths}
                onChange={(e) => setDeaths(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.missing}
              </label>
              <input
                type="number"
                min="0"
                value={missing}
                onChange={(e) => setMissing(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.injured}
              </label>
              <input
                type="number"
                min="0"
                value={injured}
                onChange={(e) => setInjured(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.affectedFamilies}
              </label>
              <input
                type="number"
                min="0"
                value={affectedHH}
                onChange={(e) => {
                  setAffectedHH(e.target.value);
                  setManualTempOverride(false);
                }}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.fullyDisplaced}
              </label>
              <input
                type="number"
                min="0"
                value={fullyDisplaced}
                onChange={(e) => {
                  setFullyDisplaced(e.target.value);
                  setManualTempOverride(false);
                }}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.tempDisplaced}
              </label>
              <input
                type="number"
                min="0"
                value={tempDisplaced}
                onChange={(e) => {
                  setTempDisplaced(e.target.value);
                  setManualTempOverride(true);
                }}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
              <span className="block text-[11px] text-slate-500 mt-1 font-mono-tabular">
                {!manualTempOverride
                  ? `${affectedHH || 0} - ${fullyDisplaced || 0} ${t.autoCalcLabel}`
                  : t.manualValueLabel}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.affectedPeople}
              </label>
              <input
                type="number"
                min="0"
                value={affectedPop}
                onChange={(e) => setAffectedPop(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Simplified Damaged Sectors & Items */}
        <section className="bg-emerald-50/25 border border-emerald-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-emerald-200/70">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {t.sec03Title}{' '}
                  <span className="font-normal text-xs text-slate-500 font-mono-tabular">
                    ({sectorSections.length}{' '}
                    {sectorSections.length === 1 ? t.sectorSingular : t.sectorPlural} ·{' '}
                    {totals.totalItems} {totals.totalItems === 1 ? t.itemSingular : t.itemPlural})
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.sec03Subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenManageStandards}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 whitespace-nowrap shrink-0 shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t.standardsLibrary}</span>
            </button>
          </div>

          <div className="space-y-4">
            {sectorSections.map((sec, sIdx) => {
              const sectorStandards = standards.filter((s) => s.sector === sec.sector);
              const relatedQuestions = getQuestionsForSection(sec);
              const hasRequiredQuestion = relatedQuestions.some((q) => q.required);
              const isQuestionsOpen = hasRequiredQuestion || Boolean(expandedQuestions[sec.id]);
              const answeredCount = relatedQuestions.filter((q) =>
                Boolean(sec.answers[q.label] && String(sec.answers[q.label]).trim())
              ).length;
              const sectionLoss = sec.items.reduce(
                (acc, item) => acc + (parseFloat(item.lossNPR) || 0),
                0
              );

              return (
                <div
                  key={sec.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  {/* Sector Header Bar */}
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[220px]">
                      <span className="text-xs font-semibold text-slate-500 font-mono-tabular whitespace-nowrap">
                        {sIdx + 1}.
                      </span>
                      <select
                        required
                        value={sec.sector}
                        onChange={(e) => handleSectionSectorChange(sec.id, e.target.value)}
                        className="px-3 py-1.5 text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg bg-white min-w-[210px]"
                      >
                        <option value="">{t.selectAffectedSector}</option>
                        {sec.sector && !allSectorOptions.includes(sec.sector) && (
                          <option value={sec.sector}>{trSector(sec.sector)}</option>
                        )}
                        {allSectorOptions.map((s) => (
                          <option key={s} value={s}>
                            {trSector(s)}
                          </option>
                        ))}
                      </select>
                      {sec.sector && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickAddSectorStandard(sec.id, sec.sector)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.newSectorStandard}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono-tabular text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {t.subtotal}: {formatNPR(sectionLoss, false, lang)}
                      </span>
                      {sectorSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSectorSections((prev) => prev.filter((s) => s.id !== sec.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                          title={t.removeSector}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clean Column Headers (Desktop) */}
                  <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2 bg-slate-50/40 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                    <div className="col-span-6">{t.damageStandardCriteria}</div>
                    <div className="col-span-2">{t.qtyLabel}</div>
                    <div className="col-span-3">{t.financialLossNPR}</div>
                    <div className="col-span-1" />
                  </div>

                  {/* Flat Damage Item Rows */}
                  <div className="divide-y divide-slate-100">
                    {sec.items.map((item) => {
                      const isCustomOther = item.standardId === 'CUSTOM_OTHER';
                      const selectedStd = !isCustomOther
                        ? standards.find((s) => s.id === item.standardId)
                        : undefined;
                      const showCustomName = isCustomOther || Boolean(item.isEditingName);
                      const displayUnit = showCustomName
                        ? trUnit(item.customUnit)
                        : trUnit(selectedStd?.unit || 'Units');

                      return (
                        <div key={item.id} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                            {/* Damage Item Selector + Optional Inline Custom Name */}
                            <div className="md:col-span-6 space-y-2">
                              <label className="block md:hidden text-xs font-semibold text-slate-700">
                                {t.damageStandardCriteria} <span className="text-red-600">*</span>
                              </label>
                              <div className="flex items-center gap-1.5">
                                <select
                                  required
                                  disabled={!sec.sector}
                                  value={item.standardId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const picked = standards.find((s) => s.id === val);
                                    handleItemChange(sec.id, item.id, {
                                      standardId: val,
                                      isEditingName: false,
                                      customName: '',
                                      customUnit: picked?.unit || 'Units',
                                      manualLossOverride:
                                        val === 'CUSTOM_OTHER' ||
                                        (picked ? picked.unitCost <= 0 : false),
                                    });
                                  }}
                                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                                >
                                  <option value="">
                                    {sec.sector ? t.selectDamageCriteria : t.selectSectorAboveFirst}
                                  </option>
                                  {sectorStandards.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {trStandardName(s.name)}
                                    </option>
                                  ))}
                                  <option value="CUSTOM_OTHER">{t.otherOption}</option>
                                </select>
                                {selectedStd && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleItemChange(sec.id, item.id, {
                                        isEditingName: !item.isEditingName,
                                        customName: !item.isEditingName
                                          ? item.customName || selectedStd.name
                                          : '',
                                        customUnit: selectedStd.unit || 'Units',
                                      })
                                    }
                                    title={item.isEditingName ? t.useSavedName : t.editName}
                                    className={`p-2 border rounded-lg shrink-0 transition-colors ${
                                      item.isEditingName
                                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                                        : 'border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                    }`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {showCustomName && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    required
                                    value={item.customName}
                                    onChange={(e) =>
                                      handleItemChange(sec.id, item.id, {
                                        customName: e.target.value,
                                      })
                                    }
                                    placeholder={t.customItemPlaceholder}
                                    className="sm:col-span-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                                  />
                                  <input
                                    type="text"
                                    value={item.customUnit}
                                    onChange={(e) =>
                                      handleItemChange(sec.id, item.id, {
                                        customUnit: e.target.value,
                                      })
                                    }
                                    placeholder={t.unitColumnLabel}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Qty */}
                            <div className="md:col-span-2">
                              <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                                {t.qtyLabel} ({displayUnit}) <span className="text-red-600">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  required
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleItemChange(sec.id, item.id, { qty: e.target.value })
                                  }
                                  placeholder="0"
                                  className="w-full px-3 py-2 pr-14 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none truncate max-w-[48px]">
                                  {displayUnit}
                                </span>
                              </div>
                            </div>

                            {/* Financial Loss */}
                            <div className="md:col-span-3">
                              <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                                {t.financialLossNPR} <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={item.lossNPR}
                                onChange={(e) =>
                                  handleItemChange(sec.id, item.id, {
                                    lossNPR: e.target.value,
                                    manualLossOverride: true,
                                  })
                                }
                                placeholder={t.enterLossPlaceholder}
                                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                              />
                              {selectedStd && selectedStd.unitCost > 0 && !item.isEditingName && (
                                <div className="mt-1 text-[11px] font-mono-tabular text-slate-500">
                                  {t.rateLabel}: {formatNPR(selectedStd.unitCost, false, lang)} /{' '}
                                  {trUnit(selectedStd.unit)}
                                </div>
                              )}
                            </div>

                            {/* Remove Row */}
                            <div className="md:col-span-1 flex justify-end pt-1">
                              {sec.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSection(sec.id, (s) => ({
                                      ...s,
                                      items: s.items.filter((x) => x.id !== item.id),
                                    }))
                                  }
                                  className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                                  title={t.removeItem}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sector Footer: Single Add Item + Collapsible Optional Questions */}
                  <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={!sec.sector}
                      onClick={() => handleAddItemInSection(sec.id, undefined, false)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addItemBtn}</span>
                    </button>

                    {sec.sector && relatedQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQuestions((prev) => ({
                            ...prev,
                            [sec.id]: !isQuestionsOpen,
                          }))
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        {isQuestionsOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>
                          {t.optionalQuestionsToggle} · {answeredCount}/{relatedQuestions.length}{' '}
                          {t.answeredLabel}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Collapsible Sector Field Questions */}
                  {sec.sector && relatedQuestions.length > 0 && isQuestionsOpen && (
                    <div className="px-4 py-3.5 bg-slate-50/70 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {relatedQuestions.map((q) => {
                        const val = sec.answers[q.label] || '';
                        return (
                          <div key={q.id}>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              {trQuestionLabel(q.label)}{' '}
                              {q.required && <span className="text-red-600">*</span>}
                            </label>

                            {q.type === 'select' && (
                              <select
                                required={q.required}
                                value={val}
                                onChange={(e) =>
                                  handleAnswerChange(sec.id, q.label, e.target.value)
                                }
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="">{t.selectOption}</option>
                                {(q.options || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {trQuestionOption(opt)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {q.type === 'yesno' && (
                              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-lg">
                                {['Yes', 'No'].map((choice) => (
                                  <button
                                    key={choice}
                                    type="button"
                                    onClick={() => handleAnswerChange(sec.id, q.label, choice)}
                                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                                      val === choice
                                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    {trQuestionOption(choice)}
                                  </button>
                                ))}
                              </div>
                            )}

                            {q.type === 'number' && (
                              <input
                                type="number"
                                required={q.required}
                                value={val}
                                onChange={(e) =>
                                  handleAnswerChange(sec.id, q.label, e.target.value)
                                }
                                placeholder={t.enterCountValue}
                                className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg bg-white"
                              />
                            )}

                            {q.type === 'text' && (
                              <input
                                type="text"
                                required={q.required}
                                value={val}
                                onChange={(e) =>
                                  handleAnswerChange(sec.id, q.label, e.target.value)
                                }
                                placeholder={t.enterFieldResponse}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Another Sector + Combined Total Summary */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-3">
            <button
              type="button"
              onClick={() => setSectorSections((prev) => [...prev, createEmptySectorSection()])}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 border border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/40 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addSectorSection}</span>
            </button>

            <div className="flex items-baseline gap-3 ml-auto">
              <span className="text-xs font-medium text-slate-500">
                {t.totalLossSummaryPrefix} ({sectorSections.length}{' '}
                {sectorSections.length === 1 ? t.sectorSingular : t.sectorPlural} ·{' '}
                {totals.totalItems}{' '}
                {totals.totalItems === 1 ? t.damagedItemSingular : t.damagedItemPlural}):
              </span>
              <span className="text-lg font-bold font-mono-tabular text-red-700">
                {formatNPR(totals.totalLoss, false, lang)}
              </span>
            </div>
          </div>
        </section>

        {/* Section 4: Required Relief Materials (Estimated Need) */}
        <section className="bg-purple-50/25 border border-purple-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-purple-200/70">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-700" />
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {t.secReliefTitle}{' '}
                  {reliefItems.length > 0 && (
                    <span className="font-normal text-xs text-slate-500 font-mono-tabular">
                      ({reliefItems.length}{' '}
                      {reliefItems.length === 1 ? t.reliefItemWord : t.reliefItemsWord})
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.reliefSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  {t.reliefDurationLabel}:
                </label>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={reliefDurationDays}
                  onChange={(e) => setReliefDurationDays(e.target.value)}
                  className="w-16 px-2 py-1 text-xs font-mono-tabular border border-slate-300 rounded bg-white text-center"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setReliefItems((prev) => {
                    const existingNames = new Set(prev.map((r) => r.name.trim().toLowerCase()));
                    const additions = DEFAULT_RELIEF_ITEMS.filter(
                      (preset) => !existingNames.has(preset.name.toLowerCase())
                    ).map((preset, idx) => ({
                      id: `REL-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
                      name: preset.name,
                      qty: '',
                      unit: preset.unit,
                      notes: preset.defaultNote || '',
                    }));
                    return [...prev, ...additions];
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-blue-700" />
                <span>{t.addAllStandardReliefBtn}</span>
              </button>
            </div>
          </div>

          {/* Quick-Add Relief Item Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <span className="text-[11px] font-medium text-slate-500 mr-1">
              {t.reliefPresetStripLabel}
            </span>
            {DEFAULT_RELIEF_ITEMS.map((preset) => {
              const alreadyAdded = reliefItems.some(
                (r) => r.name.trim().toLowerCase() === preset.name.toLowerCase()
              );
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    if (alreadyAdded) return;
                    setReliefItems((prev) => [
                      ...prev,
                      createReliefRow(preset.name, preset.unit, preset.defaultNote || ''),
                    ]);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                    alreadyAdded
                      ? 'bg-blue-50 text-blue-800 border-blue-300 font-medium'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  + {trReliefItem(preset.name)} ({trUnit(preset.unit)})
                </button>
              );
            })}
          </div>

          <datalist id="relief-item-presets">
            {Array.from(
              new Set([...DEFAULT_RELIEF_ITEMS.map((p) => p.name), ...existingReliefNames])
            ).map((itemName) => (
              <option key={itemName} value={itemName} />
            ))}
          </datalist>
          <datalist id="relief-unit-presets">
            {RELIEF_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            {reliefItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                {t.noReliefItemsHint}
              </div>
            ) : (
              <>
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <div className="col-span-5">{t.reliefItemCol}</div>
                  <div className="col-span-2">{t.reliefQtyCol}</div>
                  <div className="col-span-2">{t.reliefUnitCol}</div>
                  <div className="col-span-2">{t.reliefNoteCol}</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-slate-100">
                  {reliefItems.map((row) => (
                    <div key={row.id} className="px-4 py-2.5">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                        <div className="md:col-span-5">
                          <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                            {t.reliefItemCol}
                          </label>
                          <input
                            type="text"
                            required
                            list="relief-item-presets"
                            value={row.name}
                            onChange={(e) => {
                              const nextName = e.target.value;
                              const preset = DEFAULT_RELIEF_ITEMS.find(
                                (p) => p.name.toLowerCase() === nextName.trim().toLowerCase()
                              );
                              setReliefItems((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        name: nextName,
                                        unit: preset ? preset.unit : r.unit,
                                        notes:
                                          preset?.defaultNote && !r.notes
                                            ? preset.defaultNote
                                            : r.notes,
                                      }
                                    : r
                                )
                              );
                            }}
                            placeholder={t.reliefItemPlaceholder}
                            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                            {t.reliefQtyCol}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={row.qty}
                            onChange={(e) =>
                              setReliefItems((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, qty: e.target.value } : r
                                )
                              )
                            }
                            placeholder="0"
                            className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                            {t.reliefUnitCol}
                          </label>
                          <input
                            type="text"
                            required
                            list="relief-unit-presets"
                            value={row.unit}
                            onChange={(e) =>
                              setReliefItems((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, unit: e.target.value } : r
                                )
                              )
                            }
                            placeholder={t.unitColumnLabel}
                            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block md:hidden text-xs font-semibold text-slate-700 mb-1">
                            {t.reliefNoteCol}
                          </label>
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) =>
                              setReliefItems((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, notes: e.target.value } : r
                                )
                              )
                            }
                            placeholder={t.reliefNotePlaceholder}
                            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div className="md:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setReliefItems((prev) => prev.filter((r) => r.id !== row.id))
                            }
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                            title={t.removeItem}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setReliefItems((prev) => [...prev, createReliefRow('', 'Pcs', '', '')])
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addReliefItemBtn}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 5: Field Verification & Restoration */}
        <section className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200">
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">{t.sec04Title}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.fieldOfficer} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
                placeholder={t.fullNamePlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.officePhone}
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t.phonePlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.verificationStatus}
              </label>
              <select
                value={verification}
                disabled={!isAdmin}
                onChange={(e) => setVerification(e.target.value as VerificationStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-600"
              >
                {(['Pending Review', 'Field Verified', 'Approved by Palika'] as VerificationStatus[]).map(
                  (v) => (
                    <option key={v} value={v}>
                      {trVerification(v)}
                    </option>
                  )
                )}
              </select>
              {!isAdmin && (
                <p className="mt-1 text-[11px] text-slate-500">{t.adminOnlyVerificationHint}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.restorationPriority}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {(['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).map((prio) => (
                  <option key={prio} value={prio}>
                    {trPriority(prio)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.observationsRemarks}
              </label>
              <textarea
                rows={4}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={t.remarksPlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackRestoration}
                  onChange={(e) => setTrackRestoration(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {t.includeRestoration}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {t.includeRestorationDesc}
                  </span>
                </span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.attachPhoto}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
                  />
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoName('');
                        setPhotoDataUrl('');
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-700"
                      title={t.removeItem}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {photoDataUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={photoDataUrl}
                      alt={photoName || 'Field evidence preview'}
                      className="w-12 h-12 object-cover rounded border border-slate-200"
                    />
                    <span className="text-xs text-slate-600 truncate">{photoName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={editingEntry ? onCancelEdit : () => resetFormFields(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            {editingEntry ? t.cancel : t.clearForm}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{editingEntry ? t.updateFieldEntry : t.saveFieldEntry}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
