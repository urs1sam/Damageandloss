import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Languages, Menu, Plus, X } from 'lucide-react';
import { useLanguage } from './i18n/LanguageContext';
import { useFirebase } from './firebase/FirebaseContext';
import {
  AdminMemberRecord,
  DamageEntry,
  DamageStandard,
  MisState,
  NepalAdminMap,
  RestorationState,
  RoleAssignmentRecord,
  SectorAssessmentItem,
  SectorQuestion,
  UserProfileRecord,
  ViewId,
} from './types/mis';
import { BASE_NEPAL_ADMIN } from './data/nepalAdmin';
import {
  DEFAULT_SECTORS,
  DEFAULT_SECTOR_QUESTIONS,
  DEFAULT_STANDARDS,
} from './data/defaults';
import {
  exportEntriesCSV,
  getEntrySectorItems,
  getItemRestoration,
  summarizeEntryRestoration,
} from './utils/format';
import {
  StoredLocalBody,
  StoredSectorConfig,
  assignEntryIdsInCloud,
  assignRoleByEmailInCloud,
  assignRoleByUidInCloud,
  clearEntriesFromCloud,
  deleteDamageEntryFromCloud,
  deleteDamageStandardFromCloud,
  deleteSectorConfigFromCloud,
  grantUidAccessToAllEntriesInCloud,
  revokeAdminUidInCloud,
  revokeRoleAssignmentInCloud,
  saveDamageEntryToCloud,
  saveDamageStandardToCloud,
  saveLocalBodyToCloud,
  saveSectorConfigToCloud,
  seedSystemCatalogToCloud,
  subscribeToAdminMembers,
  subscribeToEntries,
  subscribeToLocalBodies,
  subscribeToRoleAssignments,
  subscribeToSectors,
  subscribeToStandards,
  subscribeToUsersDirectory,
  toSafeDocId,
  updateEntryRestorationInCloud,
} from './firebase/misService';
import { AuthGate } from './components/AuthGate';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { EntryFormView, RememberedDisaster } from './components/EntryFormView';
import { RestorationView } from './components/RestorationView';
import { StandardsView } from './components/StandardsView';
import { AccessManagementView } from './components/AccessManagementView';
import { NepalGovLogo } from './components/NepalGovLogo';
import {
  AssignEntryModal,
  LocalBodyModal,
  QuickSectorStandardModal,
  ReportModal,
  RestorationModal,
} from './components/Modals';

const STORAGE_KEY = 'nepal_loss_damage_mis_v2';
const LEGACY_DEMO_IDS = new Set(['LD-2026-001', 'LD-2026-002', 'LD-2026-003', 'LD-2026-004']);

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const {
    user,
    authReady,
    isAdmin,
    isSuperAdmin,
    isBootstrappedAdmin,
    isBootstrappedSuperAdmin,
    signOutUser,
  } = useFirebase();

  const [cloudEntries, setCloudEntries] = useState<DamageEntry[]>([]);
  const [cloudStandards, setCloudStandards] = useState<DamageStandard[]>([]);
  const [cloudSectors, setCloudSectors] = useState<StoredSectorConfig[]>([]);
  const [cloudLocalBodies, setCloudLocalBodies] = useState<StoredLocalBody[]>([]);
  const [usersDirectory, setUsersDirectory] = useState<UserProfileRecord[]>([]);
  const [adminMembers, setAdminMembers] = useState<AdminMemberRecord[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentRecord[]>([]);
  const [standardsLoaded, setStandardsLoaded] = useState(false);
  const [sectorsLoaded, setSectorsLoaded] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const seededRef = useRef(false);
  const migratedRef = useRef<string | null>(null);

  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingEntry, setEditingEntry] = useState<DamageEntry | null>(null);
  const [restorationTarget, setRestorationTarget] = useState<{
    entry: DamageEntry;
    item: SectorAssessmentItem;
  } | null>(null);
  const [restorationSearch, setRestorationSearch] = useState('');
  const [reportTarget, setReportTarget] = useState<DamageEntry | null>(null);
  const [assignTargetEntry, setAssignTargetEntry] = useState<DamageEntry | null>(null);

  const [localBodyModalState, setLocalBodyModalState] = useState<{
    open: boolean;
    province?: string;
    district?: string;
  }>({ open: false });

  const [quickModalState, setQuickModalState] = useState<{
    open: boolean;
    rowId?: string;
    initialSector?: string;
  }>({ open: false });

  const [lastCreatedStandard, setLastCreatedStandard] = useState<{
    rowId: string;
    sector: string;
    standardId: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<{
    message: string;
    detail?: string;
    account?: string;
  } | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  const reportWriteError = (err: unknown) => {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let message = rawMsg;
    let detail: string | undefined;
    let account: string | undefined;
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        message = String(parsed.error);
        if (parsed.path) {
          detail = `${String(parsed.operationType || 'WRITE').toUpperCase()} · ${String(parsed.path)}`;
        }
        if (parsed.authInfo?.email) {
          account = String(parsed.authInfo.email);
        }
      }
    } catch {
      // use rawMsg
    }
    setWriteError({ message, detail, account });
  };

  const notify = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Attach real-time Firestore listeners only after auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudEntries([]);
      setCloudStandards([]);
      setCloudSectors([]);
      setCloudLocalBodies([]);
      setUsersDirectory([]);
      setAdminMembers([]);
      setRoleAssignments([]);
      setStandardsLoaded(false);
      setSectorsLoaded(false);
      setEntriesLoaded(false);
      seededRef.current = false;
      return;
    }

    const unsubEntries = subscribeToEntries(
      user.uid,
      isBootstrappedAdmin,
      (list) => {
        setCloudEntries(list);
        setEntriesLoaded(true);
      },
      setFatalError
    );

    const unsubStandards = subscribeToStandards(
      user.uid,
      isBootstrappedAdmin,
      (items, loaded) => {
        setCloudStandards(items);
        setStandardsLoaded(loaded);
      },
      setFatalError
    );

    const unsubSectors = subscribeToSectors(
      user.uid,
      isBootstrappedAdmin,
      (items, loaded) => {
        setCloudSectors(items);
        setSectorsLoaded(loaded);
      },
      setFatalError
    );

    const unsubLocalBodies = subscribeToLocalBodies(
      user.uid,
      isBootstrappedAdmin,
      (items) => {
        setCloudLocalBodies(items);
      },
      setFatalError
    );

    const unsubUsers = isBootstrappedSuperAdmin
      ? subscribeToUsersDirectory(setUsersDirectory, setFatalError)
      : () => {};
    const unsubAdmins = isBootstrappedSuperAdmin
      ? subscribeToAdminMembers(setAdminMembers, setFatalError)
      : () => {};
    const unsubRoleAssignments = isBootstrappedSuperAdmin
      ? subscribeToRoleAssignments(setRoleAssignments, setFatalError)
      : () => {};

    return () => {
      unsubEntries();
      unsubStandards();
      unsubSectors();
      unsubLocalBodies();
      unsubUsers();
      unsubAdmins();
      unsubRoleAssignments();
    };
  }, [authReady, user, isBootstrappedAdmin, isBootstrappedSuperAdmin]);

  // Seed system default standards & sectors into Firestore on first Admin login
  useEffect(() => {
    if (!authReady || !user || !standardsLoaded || !sectorsLoaded) return;
    if (cloudStandards.length > 0 || cloudSectors.length > 0) {
      try {
        localStorage.setItem('nepal_mis_catalog_seeded', 'true');
      } catch {
        // ignore storage errors
      }
      seededRef.current = true;
      return;
    }
    if (!isAdmin || seededRef.current) return;
    let alreadySeeded = false;
    try {
      alreadySeeded = localStorage.getItem('nepal_mis_catalog_seeded') === 'true';
    } catch {
      alreadySeeded = false;
    }
    seededRef.current = true;
    if (!alreadySeeded) {
      seedSystemCatalogToCloud(user.uid)
        .then(() => {
          try {
            localStorage.setItem('nepal_mis_catalog_seeded', 'true');
          } catch {
            // ignore storage errors
          }
        })
        .catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
    }
  }, [authReady, user, isAdmin, standardsLoaded, sectorsLoaded, cloudStandards.length, cloudSectors.length]);

  // Migrate any pre-existing local browser MIS records into live Firestore once per UID
  useEffect(() => {
    if (!authReady || !user || !entriesLoaded) return;
    if (migratedRef.current === user.uid) return;
    migratedRef.current = user.uid;

    const flagKey = `nepal_mis_cloud_migrated_${user.uid}`;
    try {
      if (localStorage.getItem(flagKey) === 'true') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(flagKey, 'true');
        return;
      }
      const parsed = JSON.parse(raw) as Partial<MisState>;
      const localEntries = (parsed.entries || []).filter((e) => !LEGACY_DEMO_IDS.has(e.id));
      const existingIds = new Set(cloudEntries.map((e) => e.id));
      const entriesToMigrate = localEntries.filter((e) => !existingIds.has(e.id));

      const defaultStdIds = new Set(DEFAULT_STANDARDS.map((s) => s.id));
      const customStandards = (parsed.standards || []).filter((s) => !defaultStdIds.has(s.id));

      const defaultSectorSet = new Set(DEFAULT_SECTORS);
      const customSectors = (parsed.sectors || []).filter((s) => !defaultSectorSet.has(s));

      const tasks: Promise<void>[] = [];
      entriesToMigrate.forEach((entry) => {
        tasks.push(saveDamageEntryToCloud(entry, user.uid, isAdmin));
      });
      customStandards.forEach((std) => {
        tasks.push(saveDamageStandardToCloud(std, user.uid, isAdmin));
      });
      customSectors.forEach((secName) => {
        const qs = parsed.sectorQuestions?.[secName] || [];
        tasks.push(saveSectorConfigToCloud(secName, qs, user.uid, isAdmin));
      });

      if (tasks.length > 0) {
        Promise.all(tasks)
          .then(() => {
            localStorage.setItem(flagKey, 'true');
          })
          .catch((err) => {
            console.warn('Local data migration encountered an error:', err);
          });
      } else {
        localStorage.setItem(flagKey, 'true');
      }
    } catch {
      // Ignore malformed localStorage cache
    }
  }, [authReady, user, entriesLoaded, cloudEntries, isAdmin]);

  const effectiveAdmin: NepalAdminMap = useMemo(() => {
    const map = structuredClone(BASE_NEPAL_ADMIN);
    cloudLocalBodies.forEach((lb) => {
      if (!map[lb.province]) map[lb.province] = {};
      const list = map[lb.province][lb.district] || [];
      const existing = list.find((m) => m.name.toLowerCase() === lb.name.toLowerCase());
      if (existing) {
        existing.wards = lb.wards;
      } else {
        list.push({ name: lb.name, wards: lb.wards });
      }
      map[lb.province][lb.district] = list;
    });
    return map;
  }, [cloudLocalBodies]);

  const effectiveStandards: DamageStandard[] = useMemo(() => {
    if (standardsLoaded) {
      if (cloudStandards.length > 0) return cloudStandards;
      try {
        if (localStorage.getItem('nepal_mis_catalog_seeded') === 'true') {
          return cloudStandards;
        }
      } catch {
        // ignore storage errors
      }
      return DEFAULT_STANDARDS;
    }
    return DEFAULT_STANDARDS;
  }, [cloudStandards, standardsLoaded]);

  const { effectiveSectors, effectiveSectorQuestions } = useMemo(() => {
    let catalogSeeded = false;
    try {
      catalogSeeded = localStorage.getItem('nepal_mis_catalog_seeded') === 'true';
    } catch {
      catalogSeeded = false;
    }
    if (cloudSectors.length === 0 && (!sectorsLoaded || !catalogSeeded)) {
      const fromStds = effectiveStandards.map((s) => s.sector);
      return {
        effectiveSectors: Array.from(new Set([...DEFAULT_SECTORS, ...fromStds])).sort(),
        effectiveSectorQuestions: structuredClone(DEFAULT_SECTOR_QUESTIONS),
      };
    }

    const qMap: Record<string, SectorQuestion[]> = {};
    const names: string[] = [];
    cloudSectors.forEach((sec) => {
      names.push(sec.name);
      qMap[sec.name] = sec.questions || [];
    });
    const fromStds = effectiveStandards.map((s) => s.sector);
    return {
      effectiveSectors: Array.from(new Set([...names, ...fromStds])).sort(),
      effectiveSectorQuestions: qMap,
    };
  }, [cloudSectors, sectorsLoaded, effectiveStandards]);

  const restorationCount = useMemo(
    () =>
      cloudEntries
        .filter((e) => e.trackRestoration)
        .reduce((acc, e) => acc + getEntrySectorItems(e).length, 0),
    [cloudEntries]
  );

  const existingTitles = useMemo(
    () => Array.from(new Set(cloudEntries.map((e) => e.title.trim()).filter(Boolean))),
    [cloudEntries]
  );

  const existingIncidents = useMemo<RememberedDisaster[]>(() => {
    const map = new Map<string, RememberedDisaster>();
    cloudEntries.forEach((e) => {
      const cleanTitle = (e.title || '').trim();
      const key = cleanTitle.toLowerCase();
      if (!cleanTitle || map.has(key)) return;
      map.set(key, {
        title: cleanTitle,
        date: e.date || '',
        hazard: e.hazard || '',
      });
    });
    return Array.from(map.values());
  }, [cloudEntries]);

  const existingReliefNames = useMemo(
    () =>
      Array.from(
        new Set(
          cloudEntries
            .flatMap((e) => (e.reliefItems || []).map((ri) => ri.name.trim()))
            .filter(Boolean)
        )
      ),
    [cloudEntries]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 flex items-center gap-3 text-sm font-medium text-slate-700">
          <div className="w-4 h-4 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
          <span>{t.loadingLiveSystem}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const viewLabels: Record<ViewId, string> = {
    dashboard: t.viewDashboard,
    entry: t.viewEntry,
    restoration: t.viewRestoration,
    standards: t.viewStandards,
    access: t.viewAccess,
  };

  const handleSaveEntry = async (entry: DamageEntry, isEdit: boolean): Promise<boolean> => {
    setWriteError(null);
    const newStandards: DamageStandard[] = [];
    const newSectorsToCreate: string[] = [];
    const existingSectorsLower = new Set(effectiveSectors.map((s) => s.toLowerCase()));

    const normalizedItems = (entry.sectorItems || []).map((item) => {
      const cleanSector = (item.sector || 'Other').trim();
      if (cleanSector && !existingSectorsLower.has(cleanSector.toLowerCase())) {
        existingSectorsLower.add(cleanSector.toLowerCase());
        newSectorsToCreate.push(cleanSector);
      }

      const cleanName = (item.standardName || '').trim();
      if (!cleanName) return item;

      const existingStd =
        effectiveStandards.find(
          (s) =>
            s.sector.toLowerCase() === cleanSector.toLowerCase() &&
            s.name.toLowerCase() === cleanName.toLowerCase()
        ) ||
        newStandards.find(
          (s) =>
            s.sector.toLowerCase() === cleanSector.toLowerCase() &&
            s.name.toLowerCase() === cleanName.toLowerCase()
        );

      if (existingStd) {
        return {
          ...item,
          sector: existingStd.sector,
          standardId: existingStd.id,
          standardName: existingStd.name,
        };
      }

      const newStdId = toSafeDocId(`STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 'STD');
      const newStd: DamageStandard = {
        id: newStdId,
        sector: cleanSector,
        name: cleanName,
        severity: item.severity || 'Moderate',
        unit: (item.unit || 'Units').trim(),
        unitCost: 0,
      };
      newStandards.push(newStd);

      return {
        ...item,
        sector: cleanSector,
        standardId: newStdId,
        standardName: cleanName,
      };
    });

    const primary = normalizedItems[0];
    const updatedEntry: DamageEntry = {
      ...entry,
      sector: primary?.sector || entry.sector,
      standardId: primary?.standardId || entry.standardId,
      standardName:
        normalizedItems.length > 1
          ? `${primary.standardName} (+${normalizedItems.length - 1} more)`
          : primary?.standardName || entry.standardName,
      sectorItems: normalizedItems.length > 0 ? normalizedItems : entry.sectorItems,
    };

    try {
      await Promise.all([
        saveDamageEntryToCloud(updatedEntry, user.uid, isAdmin, isEdit),
        ...newStandards.map((std) => saveDamageStandardToCloud(std, user.uid, isAdmin)),
        ...newSectorsToCreate.map((secName) =>
          saveSectorConfigToCloud(secName, [], user.uid, isAdmin)
        ),
      ]);
    } catch (err) {
      reportWriteError(err);
      return false;
    }

    setEditingEntry(null);
    setActiveView('dashboard');
    if (newStandards.length > 0) {
      notify(
        lang === 'ne'
          ? `${isEdit ? 'प्रविष्टि अद्यावधिक भयो' : 'प्रविष्टि सुरक्षित भयो'} र ${newStandards.length} नयाँ नाम क्षति मापदण्डमा थपियो।`
          : `${isEdit ? 'Entry updated' : 'Entry saved'} and added ${newStandards.length} new ${
              newStandards.length === 1 ? 'name' : 'names'
            } to Damage Standards.`
      );
    } else {
      notify(
        lang === 'ne'
          ? isEdit
            ? 'फिल्ड क्षति प्रविष्टि अद्यावधिक भयो।'
            : 'नयाँ फिल्ड क्षति प्रविष्टि सुरक्षित भयो।'
          : isEdit
          ? 'Field damage entry updated.'
          : 'New field damage entry saved.'
      );
    }
    return true;
  };

  const handleDeleteEntry = async (id: string) => {
    setWriteError(null);
    try {
      await deleteDamageEntryFromCloud(id);
      notify(lang === 'ne' ? 'क्षति प्रविष्टि हटाइयो।' : 'Damage entry removed.');
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleSaveRestoration = async (
    entryId: string,
    itemId: string,
    updatedItemRest: RestorationState
  ) => {
    const entry = cloudEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const currentItems = getEntrySectorItems(entry);
    const updatedItems = currentItems.map((item) =>
      item.id === itemId
        ? { ...item, restoration: updatedItemRest }
        : { ...item, restoration: getItemRestoration(entry, item) }
    );
    const targetItem = updatedItems.find((i) => i.id === itemId) || updatedItems[0];
    const latestNote =
      updatedItemRest.logs[updatedItemRest.logs.length - 1]?.note ||
      `Updated to ${updatedItemRest.stage} (${updatedItemRest.progress}%)`;
    const summarized = summarizeEntryRestoration(entry, updatedItems, {
      date: new Date().toISOString().slice(0, 10),
      note: `[${targetItem.sector} · ${targetItem.standardName}] ${latestNote}`,
    });

    setWriteError(null);
    try {
      await updateEntryRestorationInCloud(entryId, summarized, updatedItems, user.uid, isAdmin);
      setRestorationTarget(null);
      notify(lang === 'ne' ? 'पुनर्स्थापना प्रगति अद्यावधिक भयो।' : 'Restoration progress updated.');
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleSaveStandard = async (standard: DamageStandard, isEdit: boolean) => {
    setWriteError(null);
    try {
      const tasks: Promise<void>[] = [saveDamageStandardToCloud(standard, user.uid, isAdmin)];
      if (
        !effectiveSectors.some((s) => s.toLowerCase() === standard.sector.trim().toLowerCase())
      ) {
        tasks.push(saveSectorConfigToCloud(standard.sector, [], user.uid, isAdmin));
      }
      await Promise.all(tasks);
      notify(
        lang === 'ne'
          ? isEdit
            ? 'क्षति मापदण्ड अद्यावधिक भयो।'
            : 'नयाँ क्षति मापदण्ड थपियो।'
          : isEdit
          ? 'Damage standard updated.'
          : 'New damage standard added.'
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleDeleteStandard = async (id: string) => {
    setWriteError(null);
    try {
      await deleteDamageStandardFromCloud(id);
      notify(lang === 'ne' ? 'क्षति मापदण्ड हटाइयो।' : 'Damage standard deleted.');
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleSaveSector = async (sectorName: string, questions: SectorQuestion[]) => {
    setWriteError(null);
    try {
      await saveSectorConfigToCloud(sectorName, questions, user.uid, isAdmin);
      notify(
        lang === 'ne'
          ? `"${sectorName}" क्षेत्र ${questions.length} प्रश्नसहित सुरक्षित गरियो।`
          : `Saved sector "${sectorName}" with ${questions.length} related questions.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleDeleteSector = async (sectorName: string) => {
    setWriteError(null);
    try {
      await deleteSectorConfigFromCloud(sectorName);
      notify(lang === 'ne' ? `"${sectorName}" क्षेत्र हटाइयो।` : `Removed sector "${sectorName}".`);
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleQuickAddSectorStandard = async (payload: {
    sector: string;
    standard: DamageStandard;
    sectorQuestionsToAdd: SectorQuestion[];
  }) => {
    const { sector, standard, sectorQuestionsToAdd } = payload;
    const existingSecQuestions = effectiveSectorQuestions[sector] || [];
    const seenLabels = new Set(existingSecQuestions.map((q) => q.label.toLowerCase()));
    const mergedQuestions = [
      ...existingSecQuestions,
      ...sectorQuestionsToAdd.filter((q) => !seenLabels.has(q.label.toLowerCase())),
    ];

    setWriteError(null);
    try {
      await Promise.all([
        saveSectorConfigToCloud(sector, mergedQuestions, user.uid, isAdmin),
        saveDamageStandardToCloud(standard, user.uid, isAdmin),
      ]);
      if (quickModalState.rowId) {
        setLastCreatedStandard({
          rowId: quickModalState.rowId,
          sector,
          standardId: standard.id,
        });
      }
      setQuickModalState({ open: false });
      notify(
        lang === 'ne'
          ? `${sector} अन्तर्गत "${standard.name}" थपियो।`
          : `Added "${standard.name}" under ${sector}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleSaveLocalBody = async (
    province: string,
    district: string,
    name: string,
    wards: number
  ) => {
    setWriteError(null);
    try {
      await saveLocalBodyToCloud(province, district, name, wards, user.uid, isAdmin);
      setLocalBodyModalState({ open: false });
      notify(
        lang === 'ne'
          ? `${district} अन्तर्गत "${name}" (${wards} वडा) दर्ता गरियो।`
          : `Registered "${name}" (${wards} wards) under ${district}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleAssignByEmail = async (
    email: string,
    role: 'superadmin' | 'admin',
    note: string,
    grantAllEntries: boolean
  ) => {
    setWriteError(null);
    try {
      const { matchedUid } = await assignRoleByEmailInCloud(
        email,
        role,
        user.uid,
        note,
        usersDirectory
      );
      let sharedCount = 0;
      if (grantAllEntries && matchedUid) {
        sharedCount = await grantUidAccessToAllEntriesInCloud(
          matchedUid,
          cloudEntries,
          user.uid,
          isAdmin
        );
      }
      notify(
        lang === 'ne'
          ? matchedUid
            ? `${email} लाई ${role} भूमिका दिइयो${sharedCount > 0 ? ` (${sharedCount} प्रविष्टि साझा गरियो)` : ''}।`
            : `${email} को लागि ${role} भूमिका पूर्व-निर्धारण गरियो (साइन इन गर्दा स्वतः लागू हुनेछ)।`
          : matchedUid
          ? `Assigned ${role} role to ${email}${sharedCount > 0 ? ` and shared ${sharedCount} entries` : ''}.`
          : `Pre-assigned ${role} role to ${email} (will auto-activate on sign-in).`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleAssignByUid = async (
    targetUid: string,
    role: 'superadmin' | 'admin',
    grantAllEntries: boolean,
    email?: string,
    displayName?: string
  ) => {
    setWriteError(null);
    try {
      await assignRoleByUidInCloud(targetUid, role, user.uid, email, displayName);
      let sharedCount = 0;
      if (grantAllEntries) {
        sharedCount = await grantUidAccessToAllEntriesInCloud(
          targetUid,
          cloudEntries,
          user.uid,
          isAdmin
        );
      }
      notify(
        lang === 'ne'
          ? `ID ${targetUid} लाई ${role} भूमिका दिइयो${sharedCount > 0 ? ` (${sharedCount} प्रविष्टि साझा गरियो)` : ''}।`
          : `Assigned ${role} role to ID ${targetUid}${sharedCount > 0 ? ` and shared ${sharedCount} entries` : ''}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleRevokeAdminUid = async (targetUid: string) => {
    setWriteError(null);
    try {
      await revokeAdminUidInCloud(targetUid);
      notify(
        lang === 'ne'
          ? `ID ${targetUid} को एडमिन अधिकार हटाइयो।`
          : `Revoked admin privileges for ID ${targetUid}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleRevokeRoleAssignment = async (assignmentId: string) => {
    setWriteError(null);
    try {
      await revokeRoleAssignmentInCloud(assignmentId);
      notify(
        lang === 'ne' ? 'इमेल भूमिका निर्धारण हटाइयो।' : 'Email role pre-assignment removed.'
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleGrantAllEntriesToUid = async (targetUid: string) => {
    setWriteError(null);
    try {
      const updatedCount = await grantUidAccessToAllEntriesInCloud(
        targetUid,
        cloudEntries,
        user.uid,
        isAdmin
      );
      notify(
        lang === 'ne'
          ? `${updatedCount} प्रविष्टिहरू ID ${targetUid} मा साझा गरियो।`
          : `Shared ${updatedCount} entries with ID ${targetUid}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleSaveEntryAssignment = async (
    entry: DamageEntry,
    nextOwnerId: string,
    nextAssignedIds: string[]
  ) => {
    setWriteError(null);
    try {
      await assignEntryIdsInCloud(entry, nextOwnerId, nextAssignedIds, user.uid, isAdmin);
      setAssignTargetEntry(null);
      notify(
        lang === 'ne'
          ? `प्रविष्टि ${entry.id} को प्रयोगकर्ता ID पहुँच सुरक्षित गरियो।`
          : `Updated User ID assignments for ${entry.id}.`
      );
    } catch (err) {
      reportWriteError(err);
    }
  };

  const handleExportJSON = () => {
    const snapshot: MisState = {
      admin: effectiveAdmin,
      sectors: effectiveSectors,
      sectorQuestions: effectiveSectorQuestions,
      standards: effectiveStandards,
      entries: cloudEntries,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nepal-mis-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(lang === 'ne' ? 'JSON ब्याकअप डाउनलोड भयो।' : 'JSON backup downloaded.');
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<MisState>;
        if (!parsed.entries || !parsed.standards) {
          notify(lang === 'ne' ? 'अमान्य MIS ब्याकअप फाइल।' : 'Invalid MIS backup file.');
          return;
        }
        const tasks: Promise<void>[] = [];
        parsed.entries.forEach((entry) => {
          tasks.push(saveDamageEntryToCloud(entry, user.uid, isAdmin));
        });
        parsed.standards.forEach((std) => {
          tasks.push(saveDamageStandardToCloud(std, user.uid, isAdmin));
        });
        (parsed.sectors || []).forEach((secName) => {
          tasks.push(
            saveSectorConfigToCloud(
              secName,
              parsed.sectorQuestions?.[secName] || [],
              user.uid,
              isAdmin
            )
          );
        });
        await Promise.all(tasks);
        notify(lang === 'ne' ? 'ब्याकअपबाट डेटा पुनर्स्थापित भयो।' : 'MIS data restored from backup.');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
          setFatalError(err);
          return;
        }
        notify(
          lang === 'ne' ? 'JSON ब्याकअप फाइल पढ्न असफल भयो।' : 'Failed to parse JSON backup file.'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    try {
      await clearEntriesFromCloud(cloudEntries.map((e) => e.id));
      setEditingEntry(null);
      notify(lang === 'ne' ? 'सबै फिल्ड प्रविष्टिहरू हटाइयो।' : 'All field entries cleared.');
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900">
      <Sidebar
        activeView={activeView}
        onSelectView={(v) => {
          if (v !== 'entry') setEditingEntry(null);
          setActiveView(v);
        }}
        restorationCount={restorationCount}
        standardsCount={effectiveStandards.length}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onExportCSV={() => {
          exportEntriesCSV(cloudEntries);
          notify(lang === 'ne' ? 'CSV प्रतिवेदन निर्यात भयो।' : 'CSV report exported.');
        }}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenLocalBodyModal={() => setLocalBodyModalState({ open: true })}
        onResetDemoData={handleResetDemoData}
        userEmail={user.email}
        userName={user.displayName}
        userId={user.uid}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onSignOut={signOutUser}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <NepalGovLogo className="w-8 h-8 shadow-xs" />
              <div className="flex items-center gap-2 text-sm min-w-0 truncate">
                <span className="font-display font-semibold text-slate-500 whitespace-nowrap shrink-0">
                  {t.appBrand}
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  /
                </span>
                <h1 className="font-display font-semibold text-slate-900 truncate">
                  {viewLabels[activeView]}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg"
              role="group"
              aria-label="Language switch"
            >
              <Languages className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('ne')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'ne'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                नेपाली
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setActiveView('entry');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newFieldEntry}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1400px] w-full mx-auto">
          {writeError && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-3 no-print">
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-900">
                    {writeError.message.includes('Quota exceeded')
                      ? 'Database Quota Reached'
                      : 'Database Write Failed'}
                  </div>
                  <p className="text-xs sm:text-sm text-red-800 mt-0.5 break-words">
                    {writeError.message}
                  </p>
                  {(writeError.detail || writeError.account) && (
                    <p className="text-xs font-mono-tabular text-red-700/80 mt-1">
                      {[writeError.detail, writeError.account].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWriteError(null)}
                className="p-1 text-red-500 hover:text-red-800 rounded-md shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              entries={cloudEntries}
              admin={effectiveAdmin}
              sectors={effectiveSectors}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              onEditEntry={(entry) => {
                setEditingEntry(entry);
                setActiveView('entry');
              }}
              onAssignEntry={(entry) => setAssignTargetEntry(entry)}
              onTrackRestoration={(entry) => {
                const items = getEntrySectorItems(entry);
                if (items.length <= 1 && items[0]) {
                  setRestorationTarget({ entry, item: items[0] });
                } else {
                  setRestorationSearch(entry.id);
                  setActiveView('restoration');
                }
              }}
              onViewReport={(entry) => setReportTarget(entry)}
              onDeleteEntry={handleDeleteEntry}
              onOpenNewEntry={() => {
                setEditingEntry(null);
                setActiveView('entry');
              }}
              onOpenRestorationView={() => {
                setRestorationSearch('');
                setActiveView('restoration');
              }}
            />
          )}

          {activeView === 'entry' && (
            <EntryFormView
              admin={effectiveAdmin}
              sectors={effectiveSectors}
              sectorQuestions={effectiveSectorQuestions}
              standards={effectiveStandards}
              existingTitles={existingTitles}
              existingIncidents={existingIncidents}
              existingReliefNames={existingReliefNames}
              editingEntry={editingEntry}
              lastCreatedStandard={lastCreatedStandard}
              onClearLastCreatedStandard={() => setLastCreatedStandard(null)}
              onCancelEdit={() => {
                setEditingEntry(null);
                setActiveView('dashboard');
              }}
              onSaveEntry={handleSaveEntry}
              onOpenAddLocalLevel={(province, district) =>
                setLocalBodyModalState({ open: true, province, district })
              }
              onOpenQuickAddSectorStandard={(rowId, initialSector) =>
                setQuickModalState({ open: true, rowId, initialSector })
              }
              onOpenManageStandards={() => setActiveView('standards')}
              onNotify={notify}
              isAdmin={isAdmin}
            />
          )}

          {activeView === 'restoration' && (
            <RestorationView
              entries={cloudEntries}
              admin={effectiveAdmin}
              isAdmin={isAdmin}
              initialSearch={restorationSearch}
              onClearInitialSearch={() => setRestorationSearch('')}
              onUpdateProgress={(entry, item) => setRestorationTarget({ entry, item })}
              onViewReport={(entry) => setReportTarget(entry)}
            />
          )}

          {activeView === 'standards' && (
            <StandardsView
              sectors={effectiveSectors}
              sectorConfigs={cloudSectors}
              sectorQuestions={effectiveSectorQuestions}
              standards={effectiveStandards}
              isAdmin={isAdmin}
              currentUserId={user.uid}
              onSaveStandard={handleSaveStandard}
              onDeleteStandard={handleDeleteStandard}
              onSaveSector={handleSaveSector}
              onDeleteSector={handleDeleteSector}
            />
          )}

          {activeView === 'access' && isSuperAdmin && (
            <AccessManagementView
              currentUserUid={user.uid}
              currentUserEmail={user.email}
              currentUserName={user.displayName}
              isBootstrappedSuperAdmin={isBootstrappedSuperAdmin}
              usersDirectory={usersDirectory}
              adminMembers={adminMembers}
              roleAssignments={roleAssignments}
              entriesCount={cloudEntries.length}
              onAssignByEmail={handleAssignByEmail}
              onAssignByUid={handleAssignByUid}
              onRevokeAdminUid={handleRevokeAdminUid}
              onRevokeRoleAssignment={handleRevokeRoleAssignment}
              onGrantAllEntriesToUid={handleGrantAllEntriesToUid}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <RestorationModal
        target={restorationTarget}
        onClose={() => setRestorationTarget(null)}
        onSave={handleSaveRestoration}
      />

      <LocalBodyModal
        isOpen={localBodyModalState.open}
        admin={effectiveAdmin}
        initialProvince={localBodyModalState.province}
        initialDistrict={localBodyModalState.district}
        onClose={() => setLocalBodyModalState({ open: false })}
        onSave={handleSaveLocalBody}
      />

      <QuickSectorStandardModal
        isOpen={quickModalState.open}
        sectors={effectiveSectors}
        initialSector={quickModalState.initialSector}
        onClose={() => setQuickModalState({ open: false })}
        onSave={handleQuickAddSectorStandard}
      />

      <ReportModal entry={reportTarget} onClose={() => setReportTarget(null)} />

      <AssignEntryModal
        entry={assignTargetEntry}
        usersDirectory={usersDirectory}
        adminMembers={adminMembers}
        onClose={() => setAssignTargetEntry(null)}
        onSave={handleSaveEntryAssignment}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg no-print">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
