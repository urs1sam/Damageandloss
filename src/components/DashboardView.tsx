import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Droplets,
  FileText,
  Flame,
  GraduationCap,
  HeartPulse,
  Landmark,
  Mountain,
  Pencil,
  Search,
  ShieldAlert,
  Sprout,
  Trash2,
  UserPlus,
  Waves,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { DamageEntry, NepalAdminMap, SectorAssessmentItem, SeverityLevel } from '../types/mis';
import { RESTORATION_STAGES } from '../data/defaults';
import {
  formatNPR,
  getEntrySectorItems,
  severityTextStyle,
  stageTextStyle,
} from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardViewProps {
  entries: DamageEntry[];
  admin: NepalAdminMap;
  sectors: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  onEditEntry: (entry: DamageEntry) => void;
  onAssignEntry?: (entry: DamageEntry) => void;
  onTrackRestoration: (entry: DamageEntry) => void;
  onViewReport: (entry: DamageEntry) => void;
  onDeleteEntry: (id: string) => void;
  onOpenNewEntry: () => void;
  onOpenRestorationView: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  entries,
  admin,
  sectors,
  isAdmin = false,
  isSuperAdmin = false,
  onEditEntry,
  onAssignEntry,
  onTrackRestoration,
  onViewReport,
  onDeleteEntry,
  onOpenNewEntry,
  onOpenRestorationView,
}) => {
  const {
    lang,
    t,
    trProvince,
    trDistrict,
    trMunicipality,
    trHazard,
    trSector,
    trSeverity,
    trVerification,
    trStage,
    trUnit,
    trStandardName,
  } = useLanguage();

  const [incidentFilter, setIncidentFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [hazardFilter, setHazardFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorViewMode, setSectorViewMode] = useState<'consolidated' | 'itemized'>('consolidated');
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({});

  const provinces = useMemo(() => Object.keys(admin), [admin]);
  const incidentTitles = useMemo(
    () => Array.from(new Set(entries.map((e) => e.title.trim()).filter(Boolean))).sort(),
    [entries]
  );
  const hazards = useMemo(
    () => Array.from(new Set(entries.map((e) => e.hazard))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (incidentFilter && e.title.trim() !== incidentFilter) return false;
      if (provinceFilter && e.province !== provinceFilter) return false;
      if (hazardFilter && e.hazard !== hazardFilter) return false;
      if (sectorFilter) {
        const items = getEntrySectorItems(e);
        if (!items.some((item) => item.sector === sectorFilter)) return false;
      }
      if (q) {
        const items = getEntrySectorItems(e);
        const itemText = items.map((i) => `${i.sector} ${i.standardName}`).join(' ');
        const hay = `${e.id} ${e.title} ${e.district} ${e.municipality} ${e.tole} ${e.officer} ${itemText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, incidentFilter, provinceFilter, hazardFilter, sectorFilter, searchQuery]);

  const kpis = useMemo(() => {
    const totalLoss = filtered.reduce((acc, e) => acc + (Number(e.lossNPR) || 0), 0);
    const affectedHH = filtered.reduce((acc, e) => acc + (Number(e.affectedHH) || 0), 0);
    const fullyDisplaced = filtered.reduce((acc, e) => acc + (Number(e.fullyDisplaced) || 0), 0);
    const tempDisplaced = filtered.reduce((acc, e) => {
      const td =
        typeof e.tempDisplaced === 'number'
          ? e.tempDisplaced
          : Math.max(0, (e.affectedHH || 0) - (e.fullyDisplaced || 0));
      return acc + td;
    }, 0);
    const deaths = filtered.reduce((acc, e) => acc + (Number(e.deaths) || 0), 0);
    const missing = filtered.reduce((acc, e) => acc + (Number(e.missing) || 0), 0);
    const injured = filtered.reduce((acc, e) => acc + (Number(e.injured) || 0), 0);
    const verifiedCount = filtered.filter((e) => e.verification !== 'Pending Review').length;
    const pendingCount = filtered.length - verifiedCount;
    const tracked = filtered.filter((e) => e.trackRestoration);
    const restoredCount = tracked.filter((e) => e.restoration?.stage === 'Restored').length;
    const avgProgress = tracked.length
      ? Math.round(
          tracked.reduce((acc, e) => acc + (Number(e.restoration?.progress) || 0), 0) /
            tracked.length
        )
      : 0;

    return {
      totalLoss,
      affectedHH,
      fullyDisplaced,
      tempDisplaced,
      deaths,
      missing,
      injured,
      verifiedCount,
      pendingCount,
      trackedCount: tracked.length,
      restoredCount,
      avgProgress,
    };
  }, [filtered]);

  const humanitarianSummary = useMemo(() => {
    let deaths = 0;
    let missing = 0;
    let injured = 0;
    let affectedHH = 0;
    let fullyDisplaced = 0;
    let tempDisplaced = 0;
    filtered.forEach((e) => {
      deaths += Number(e.deaths) || 0;
      missing += Number(e.missing) || 0;
      injured += Number(e.injured) || 0;
      affectedHH += Number(e.affectedHH) || 0;
      fullyDisplaced += Number(e.fullyDisplaced) || 0;
      tempDisplaced +=
        typeof e.tempDisplaced === 'number'
          ? e.tempDisplaced
          : Math.max(0, (e.affectedHH || 0) - (e.fullyDisplaced || 0));
    });
    return {
      deaths,
      missing,
      injured,
      affectedHH,
      fullyDisplaced,
      tempDisplaced,
      totalCasualties: deaths + missing + injured,
    };
  }, [filtered]);

  const pipelineStats = useMemo(() => {
    const tracked = filtered.filter((e) => e.trackRestoration);
    const counts = RESTORATION_STAGES.map((stage) => ({
      stage,
      count: tracked.filter((e) => (e.restoration?.stage || 'Not Started') === stage).length,
    }));
    return { trackedCount: tracked.length, counts };
  }, [filtered]);

  const sectorTracking = useMemo(() => {
    const sevRank: Record<SeverityLevel, number> = {
      Minor: 0,
      Moderate: 1,
      Severe: 2,
      Catastrophic: 3,
    };

    const groupsMap = new Map<
      string,
      {
        sector: string;
        totalLoss: number;
        entryIds: Set<string>;
        items: { entry: DamageEntry; item: SectorAssessmentItem }[];
        consolidatedMap: Map<
          string,
          {
            key: string;
            standardName: string;
            unit: string;
            severity: SeverityLevel;
            totalQty: number;
            totalLoss: number;
            count: number;
          }
        >;
      }
    >();

    filtered.forEach((entry) => {
      const entryItems = getEntrySectorItems(entry);
      entryItems.forEach((item) => {
        if (sectorFilter && item.sector !== sectorFilter) return;
        let grp = groupsMap.get(item.sector);
        if (!grp) {
          grp = {
            sector: item.sector,
            totalLoss: 0,
            entryIds: new Set<string>(),
            items: [],
            consolidatedMap: new Map(),
          };
          groupsMap.set(item.sector, grp);
        }
        const itemLoss = Number(item.lossNPR) || 0;
        const itemQty = Number(item.qty) || 0;
        grp.totalLoss += itemLoss;
        grp.entryIds.add(entry.id);
        grp.items.push({ entry, item });

        const cKey = `${item.standardName.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`;
        const existingC = grp.consolidatedMap.get(cKey);
        if (existingC) {
          existingC.totalQty += itemQty;
          existingC.totalLoss += itemLoss;
          existingC.count += 1;
          if (sevRank[item.severity] > sevRank[existingC.severity]) {
            existingC.severity = item.severity;
          }
        } else {
          grp.consolidatedMap.set(cKey, {
            key: cKey,
            standardName: item.standardName,
            unit: item.unit,
            severity: item.severity,
            totalQty: itemQty,
            totalLoss: itemLoss,
            count: 1,
          });
        }
      });
    });

    const groups = Array.from(groupsMap.values())
      .map((g) => ({
        sector: g.sector,
        totalLoss: g.totalLoss,
        entryCount: g.entryIds.size,
        items: g.items,
        consolidated: Array.from(g.consolidatedMap.values()).sort(
          (a, b) => b.totalLoss - a.totalLoss || b.totalQty - a.totalQty
        ),
      }))
      .sort((a, b) => b.totalLoss - a.totalLoss || b.items.length - a.items.length);

    const grandTotalLoss = groups.reduce((acc, g) => acc + g.totalLoss, 0);
    const totalItemsCount = groups.reduce((acc, g) => acc + g.items.length, 0);

    return { groups, grandTotalLoss, totalItemsCount };
  }, [filtered, sectorFilter]);

  const hazardStats = useMemo(() => {
    const map = new Map<string, { count: number; loss: number }>();
    filtered.forEach((e) => {
      const h = e.hazard || 'Other';
      const cur = map.get(h) || { count: 0, loss: 0 };
      cur.count += 1;
      cur.loss += Number(e.lossNPR) || 0;
      map.set(h, cur);
    });
    return Array.from(map.entries())
      .map(([hazard, data]) => ({ hazard, ...data }))
      .sort((a, b) => b.loss - a.loss);
  }, [filtered]);

  const getHazardIcon = (hazard: string) => {
    const h = hazard.toLowerCase();
    if (h.includes('flood') || h.includes('बाढी')) return <Waves className="w-4 h-4 text-blue-600" />;
    if (h.includes('landslide') || h.includes('पहिरो')) return <Mountain className="w-4 h-4 text-amber-600" />;
    if (h.includes('earthquake') || h.includes('भूकम्प')) return <Activity className="w-4 h-4 text-red-600" />;
    if (h.includes('fire') || h.includes('आगलागी')) return <Flame className="w-4 h-4 text-orange-600" />;
    if (h.includes('wind') || h.includes('storm') || h.includes('हुरी')) return <Wind className="w-4 h-4 text-cyan-600" />;
    if (h.includes('glof') || h.includes('flash')) return <CloudRain className="w-4 h-4 text-indigo-600" />;
    return <AlertTriangle className="w-4 h-4 text-slate-600" />;
  };

  const hasFilters = Boolean(
    incidentFilter || provinceFilter || hazardFilter || sectorFilter || searchQuery
  );

  const bannerIncidentText = useMemo(() => {
    if (incidentFilter) return incidentFilter;
    if (incidentTitles.length === 1) return incidentTitles[0];
    return t.allIncidents;
  }, [incidentFilter, incidentTitles, t.allIncidents]);

  const bannerAreaText = useMemo(() => {
    const districts = Array.from(new Set(filtered.map((e) => e.district).filter(Boolean)));
    if (provinceFilter) {
      return districts.length === 1
        ? `${trDistrict(districts[0])}, ${trProvince(provinceFilter)}`
        : trProvince(provinceFilter);
    }
    if (districts.length === 1) {
      return trDistrict(districts[0]);
    }
    return t.bannerAllAffectedDistricts;
  }, [filtered, provinceFilter, trDistrict, trProvince, t.bannerAllAffectedDistricts]);

  const reportDateText = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-5">
      {/* Official Disaster Command Post Header Banner */}
      <section className="rounded-xl bg-gradient-to-r from-[#183059] via-[#234375] to-[#1c3359] px-6 py-5 sm:py-6 text-white border border-[#26487e] shadow-md relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left relative z-10">
          <div className="shrink-0 bg-white p-2 rounded-xl shadow-lg border border-white/20">
            <img
              src="/assets/aistudio/1280px-Emblem_of_Nepal.svg_ee194173.webp"
              alt="Emblem of Nepal"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
            />
          </div>
          <div className="flex-1 flex flex-col items-center sm:items-start min-w-0">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-blue-100 uppercase">
              {t.bannerGovLine}
            </p>
            <p className="text-xs font-medium text-blue-200 mt-0.5">
              {t.bannerDaoLine}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 truncate max-w-full">
              {t.bannerCommandTitle}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-blue-100">
              <span className="font-medium">
                {t.bannerIncidentLabel}: <span className="text-white font-semibold">{bannerIncidentText}</span>
              </span>
              <span aria-hidden="true" className="text-blue-300">·</span>
              <span>
                {t.bannerAreaLabel}: <span className="text-white font-semibold">{bannerAreaText}</span>
              </span>
              <span aria-hidden="true" className="text-blue-300">·</span>
              <span className="font-mono-tabular">
                {t.bannerReportDateLabel}: <span className="text-white font-semibold">{reportDateText}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchDashboardPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>

        <select
          value={incidentFilter}
          onChange={(e) => setIncidentFilter(e.target.value)}
          aria-label={t.allIncidents}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[170px] max-w-[250px]"
        >
          <option value="">{t.allIncidents}</option>
          {incidentTitles.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>

        <select
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[150px]"
        >
          <option value="">{t.allProvinces}</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {trProvince(p)}
            </option>
          ))}
        </select>

        <select
          value={hazardFilter}
          onChange={(e) => setHazardFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[135px]"
        >
          <option value="">{t.allHazards}</option>
          {hazards.map((h) => (
            <option key={h} value={h}>
              {trHazard(h)}
            </option>
          ))}
        </select>

        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[155px]"
        >
          <option value="">{t.allSectors}</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {trSector(s)}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setIncidentFilter('');
              setProvinceFilter('');
              setHazardFilter('');
              setSectorFilter('');
              setSearchQuery('');
            }}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {incidentFilter && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-700">{t.incidentDashboardView}</div>
            <div className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate mt-0.5">
              {incidentFilter}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
            <span className="font-mono-tabular">
              {filtered.length} {filtered.length === 1 ? t.entrySingular : t.entryPlural}
            </span>
            <button
              type="button"
              onClick={() => setIncidentFilter('')}
              className="font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              {t.showAllIncidents}
            </button>
          </div>
        </div>
      )}

      {/* UNDRR / UNOCHA Disaster Hazard Risk Infographic Strip */}
      {hazardStats.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              <h2 className="font-display text-sm font-semibold text-slate-900">
                {lang === 'ne' ? 'प्रकोप जोखिम तथा क्षति विश्लेषण (UNDRR मानक)' : 'Disaster Hazard Risk & Loss Breakdown (UNDRR Standard)'}
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono-tabular">
              {filtered.length} {t.entryPlural} · {hazardStats.length} {lang === 'ne' ? 'प्रकारका प्रकोप' : 'Hazard Types'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {hazardStats.map((item) => {
              const sharePct = kpis.totalLoss > 0 ? Math.round((item.loss / kpis.totalLoss) * 100) : 0;
              return (
                <div key={item.hazard} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getHazardIcon(item.hazard)}
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {trHazard(item.hazard)}
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-500 shrink-0">
                      {item.count} {item.count === 1 ? t.entrySingular : t.entryPlural}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                      <span className="font-semibold text-red-700">{formatNPR(item.loss, false, lang)}</span>
                      <span className="text-slate-500">{sharePct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-red-600 h-full rounded-full"
                        style={{ width: `${Math.max(4, sharePct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* DRRM Expert Human Vulnerability & Casualty Analytics Strip */}
      <section className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-white border border-amber-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-amber-700" />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {lang === 'ne' ? 'मानवीय क्षति तथा विस्थापन जोखिम विश्लेषण (OCHA मानक)' : 'Human Casualty & Population Vulnerability Analytics (OCHA Standard)'}
            </h2>
          </div>
          <span className="text-xs font-mono-tabular text-amber-800 font-medium">
            {humanitarianSummary.totalCasualties} {lang === 'ne' ? 'कुल मानवीय क्षति' : 'Total Human Casualties'} · {humanitarianSummary.affectedHH.toLocaleString('en-IN')} {lang === 'ne' ? 'परिवार प्रभावित' : 'HH Affected'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.death}</div>
            <div className="text-xl font-bold font-mono-tabular text-red-700 mt-1">{humanitarianSummary.deaths}</div>
          </div>
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.missing}</div>
            <div className="text-xl font-bold font-mono-tabular text-amber-700 mt-1">{humanitarianSummary.missing}</div>
          </div>
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.injured}</div>
            <div className="text-xl font-bold font-mono-tabular text-blue-700 mt-1">{humanitarianSummary.injured}</div>
          </div>
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.affectedFamiliesImpact}</div>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{humanitarianSummary.affectedHH.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.fullLabel}</div>
            <div className="text-xl font-bold font-mono-tabular text-rose-700 mt-1">{humanitarianSummary.fullyDisplaced.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white border border-amber-200/80 rounded-lg p-3 text-center shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase">{t.tempDisplacedLabel}</div>
            <div className="text-xl font-bold font-mono-tabular text-indigo-700 mt-1">{humanitarianSummary.tempDisplaced.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.totalDamageEntries}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-slate-900">
            {filtered.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {kpis.verifiedCount} {t.verified} · {kpis.pendingCount} {t.pendingReview}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.estimatedFinancialLoss}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-red-700">
            {formatNPR(kpis.totalLoss, true, lang)}
          </div>
          <div className="mt-1 text-xs font-mono-tabular text-slate-500">
            {formatNPR(kpis.totalLoss, false, lang)} {t.directDamage}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.affectedFamiliesImpact}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-slate-900">
            {kpis.affectedHH.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({kpis.fullyDisplaced} {t.fullLabel} · {kpis.tempDisplaced} {t.tempDisplacedLabel})
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono-tabular">
            {t.death}: {kpis.deaths} · {t.missing}: {kpis.missing} · {t.injured}: {kpis.injured}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.restorationCompletion}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-emerald-700">
            {kpis.avgProgress}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {lang === 'ne'
              ? `${kpis.trackedCount} ${t.of} ${kpis.restoredCount} ${t.ofTracksRestored}`
              : `${kpis.restoredCount} ${t.of} ${kpis.trackedCount} ${t.ofTracksRestored}`}
          </div>
        </div>
      </div>

      {/* Compact Restoration Stage Strip */}
      <section className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {t.restorationPipeline}
            </h2>
            <span className="text-xs text-slate-500 font-mono-tabular">
              · {pipelineStats.trackedCount} {t.trackedProjects}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {pipelineStats.counts.map((item) => (
              <div key={item.stage} className="flex items-center gap-1.5">
                <span className="text-slate-600">{trStage(item.stage)}:</span>
                <span
                  className={`font-mono-tabular font-semibold ${
                    item.stage === 'Restored' && item.count > 0
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  }`}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenRestorationView}
          className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
        >
          {t.openRestorationTracker} →
        </button>
      </section>

      {/* Clean Sector-Wise Entered Damage Names Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {t.sectorWiseTrackingTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.sectorWiseTrackingDesc}</p>
          </div>

          {sectorTracking.groups.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSectorViewMode('consolidated')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    sectorViewMode === 'consolidated'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.damageNamesView}
                </button>
                <button
                  type="button"
                  onClick={() => setSectorViewMode('itemized')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    sectorViewMode === 'itemized'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.itemDetailsView}
                </button>
              </div>
            </div>
          )}
        </div>

        {sectorTracking.groups.length === 0 ? (
          <div className="py-10 px-6 text-center text-sm text-slate-500">
            {t.noSectorTrackingData}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {sectorViewMode === 'consolidated' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5">{t.colDamageItem}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">{t.colSeverity}</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">
                      {t.colRecordsCount}
                    </th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.colQtyUnit}</th>
                    <th className="py-2.5 px-5 text-right whitespace-nowrap">{t.colLossNPR}</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {sectorTracking.groups.map((group) => {
                    const isCollapsed = Boolean(collapsedSectors[group.sector]);
                    const sharePct =
                      sectorTracking.grandTotalLoss > 0
                        ? Math.round((group.totalLoss / sectorTracking.grandTotalLoss) * 100)
                        : 0;

                    return (
                      <React.Fragment key={group.sector}>
                        <tr
                          onClick={() =>
                            setCollapsedSectors((prev) => ({
                              ...prev,
                              [group.sector]: !prev[group.sector],
                            }))
                          }
                          className="bg-slate-50/90 hover:bg-slate-100/80 cursor-pointer border-t border-slate-200/80"
                        >
                          <td colSpan={4} className="py-2 px-5">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )}
                              <span className="font-display text-xs font-bold text-slate-900">
                                {trSector(group.sector)}
                              </span>
                              <span className="text-xs text-slate-500 font-mono-tabular">
                                · {group.consolidated.length}{' '}
                                {group.consolidated.length === 1 ? t.itemWord : t.itemsWord} ·{' '}
                                {sharePct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-5 text-right font-mono-tabular text-xs font-bold text-slate-800 whitespace-nowrap">
                            {formatNPR(group.totalLoss, false, lang)}
                          </td>
                        </tr>

                        {!isCollapsed &&
                          group.consolidated.map((c) => (
                            <tr key={c.key} className="hover:bg-slate-50/75 transition-colors">
                              <td className="py-2.5 pl-10 pr-4 text-slate-900 font-medium">
                                {trStandardName(c.standardName)}
                              </td>
                              <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                                <span className={severityTextStyle(c.severity)}>
                                  {trSeverity(c.severity)}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular text-xs text-slate-600">
                                {c.count}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular text-xs text-slate-800 whitespace-nowrap">
                                {c.totalQty.toLocaleString('en-IN')} {trUnit(c.unit)}
                              </td>
                              <td className="py-2.5 px-5 text-right font-mono-tabular text-xs sm:text-sm font-semibold text-red-700 whitespace-nowrap">
                                {formatNPR(c.totalLoss, false, lang)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-800">
                    <td colSpan={4} className="py-3 px-5">
                      {t.grandTotalAllSectors}{' '}
                      <span className="font-normal text-slate-500 font-mono-tabular">
                        · {sectorTracking.groups.length} {t.sectorsWord} ·{' '}
                        {sectorTracking.totalItemsCount}{' '}
                        {sectorTracking.totalItemsCount === 1 ? t.itemWord : t.itemsWord}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular text-sm font-bold text-red-700 whitespace-nowrap">
                      {formatNPR(sectorTracking.grandTotalLoss, false, lang)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5">{t.colDamageItem}</th>
                    <th className="py-2.5 px-4">{t.sectorReq}</th>
                    <th className="py-2.5 px-4">{t.colLocationIncident}</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.colQtyUnit}</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.colLossNPR}</th>
                    <th className="py-2.5 px-5 text-right whitespace-nowrap">{t.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {sectorTracking.groups.flatMap((group) =>
                    group.items.map(({ entry, item }) => {
                      const canEdit = isAdmin || entry.verification !== 'Approved by Palika';
                      return (
                        <tr
                          key={`${entry.id}-${item.id}`}
                          className="hover:bg-slate-50/75 transition-colors"
                        >
                          <td className="py-2.5 px-5 font-medium text-slate-900 min-w-[200px]">
                            {trStandardName(item.standardName)}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {trSector(group.sector)}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 min-w-[210px]">
                            <span className="font-medium text-slate-800">
                              {trMunicipality(entry.municipality)} · {t.ward} {entry.ward}
                            </span>{' '}
                            · {entry.title}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-xs text-slate-800 whitespace-nowrap">
                            {(Number(item.qty) || 0).toLocaleString('en-IN')} {trUnit(item.unit)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-xs font-semibold text-red-700 whitespace-nowrap">
                            {formatNPR(item.lossNPR, false, lang)}
                          </td>
                          <td className="py-2.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onViewReport(entry)}
                                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                title={t.viewPrintableReport}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onEditEntry(entry)}
                                className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                                title={canEdit ? t.editEntry : t.lockedApprovedTooltip}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* Clean Field Entries Register */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {t.fieldRegisterTitle}
          </h2>
          <span className="text-xs text-slate-500 font-mono-tabular">
            {filtered.length} {filtered.length === 1 ? t.entrySingular : t.entryPlural}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 px-6 text-center">
            <p className="text-sm text-slate-600 mb-4">{t.noRecordsMatch}</p>
            <button
              type="button"
              onClick={onOpenNewEntry}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              {t.logFirstEntry}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.colDateId}</th>
                  <th className="py-2.5 px-4">{t.colIncidentHazard}</th>
                  <th className="py-2.5 px-4">{t.colSectorsStandards}</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.colTotalEstLoss}</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.colRestoration}</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((entry) => {
                  const sectorItems = getEntrySectorItems(entry);
                  const damageNamesList = sectorItems.map((i) => trStandardName(i.standardName));
                  const canEdit = isAdmin || entry.verification !== 'Approved by Palika';

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-2.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono-tabular text-xs font-medium text-slate-900">
                          {entry.date}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-500 mt-0.5">
                          {entry.id}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 align-top min-w-[220px]">
                        <div className="font-medium text-slate-900">{entry.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {trMunicipality(entry.municipality)} · {t.ward} {entry.ward} ·{' '}
                          {trDistrict(entry.district)} · {trHazard(entry.hazard)}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 align-top min-w-[240px]">
                        <div className="text-xs sm:text-sm font-medium text-slate-900">
                          {damageNamesList.join(', ')}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {Array.from(new Set(sectorItems.map((i) => trSector(i.sector)))).join(
                            ' · '
                          )}{' '}
                          ·{' '}
                          <span className={severityTextStyle(entry.severity)}>
                            {trSeverity(entry.severity)}
                          </span>{' '}
                          · {trVerification(entry.verification)}
                        </div>
                        {(entry.reliefItems?.length || 0) > 0 && (
                          <div className="text-[11px] text-blue-700 mt-0.5 font-mono-tabular">
                            {t.reliefSummaryHeader}: {entry.reliefItems!.length}{' '}
                            {entry.reliefItems!.length === 1
                              ? t.reliefItemWord
                              : t.reliefItemsWord}
                            {(entry.reliefDurationDays ?? 21) > 0 &&
                              ` (${entry.reliefDurationDays ?? 21} ${t.reliefDaysUnit})`}
                          </div>
                        )}
                        {(entry.assignedIds?.length || 0) > 0 && (
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                            {entry.assignedIds!.length} {t.assignedCountLabel}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="font-mono-tabular font-semibold text-red-700">
                          {formatNPR(entry.lossNPR, false, lang)}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                          {formatNPR(entry.lossNPR, true, lang)}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 align-top whitespace-nowrap">
                        {entry.trackRestoration ? (
                          <div>
                            <div className={`text-xs ${stageTextStyle(entry.restoration.stage)}`}>
                              {trStage(entry.restoration.stage)}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                              {entry.restoration.progress}% {t.complete}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{t.notTracked}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewReport(entry)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title={t.viewPrintableReport}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onEditEntry(entry)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                            title={canEdit ? t.editEntry : t.lockedApprovedTooltip}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && onAssignEntry && (
                            <button
                              type="button"
                              onClick={() => onAssignEntry(entry)}
                              className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md"
                              title={t.assignIdsBtn}
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          {entry.trackRestoration && (
                            <button
                              type="button"
                              onClick={() => onTrackRestoration(entry)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                              title={t.updateRestorationProgress}
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onDeleteEntry(entry.id)}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                            title={canEdit ? t.deleteEntry : t.lockedApprovedTooltip}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
