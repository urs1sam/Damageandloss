import React, { useEffect, useMemo, useState } from 'react';
import { Search, Wrench, FileText, X } from 'lucide-react';
import {
  DamageEntry,
  NepalAdminMap,
  PriorityLevel,
  RestorationState,
  SectorAssessmentItem,
} from '../types/mis';
import { RESTORATION_STAGES } from '../data/defaults';
import {
  formatNPR,
  getEntrySectorItems,
  getItemRestoration,
  priorityTextStyle,
  severityTextStyle,
  stageTextStyle,
} from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface TrackedItemRow {
  entry: DamageEntry;
  item: SectorAssessmentItem;
  restoration: RestorationState;
}

interface RestorationViewProps {
  entries: DamageEntry[];
  admin: NepalAdminMap;
  isAdmin?: boolean;
  initialSearch?: string;
  onClearInitialSearch?: () => void;
  onUpdateProgress: (entry: DamageEntry, item: SectorAssessmentItem) => void;
  onViewReport: (entry: DamageEntry) => void;
}

export const RestorationView: React.FC<RestorationViewProps> = ({
  entries,
  admin,
  isAdmin = false,
  initialSearch = '',
  onClearInitialSearch,
  onUpdateProgress,
  onViewReport,
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
    trPriority,
    trStage,
    trUnit,
    trStandardName,
  } = useLanguage();

  const [search, setSearch] = useState(initialSearch);
  const [provinceFilter, setProvinceFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const provinces = useMemo(() => Object.keys(admin), [admin]);
  const trackedEntries = useMemo(() => entries.filter((e) => e.trackRestoration), [entries]);

  // Flatten each tracked entry into individual Sector + Damage Name rows
  const allTrackedItems = useMemo<TrackedItemRow[]>(() => {
    const rows: TrackedItemRow[] = [];
    trackedEntries.forEach((entry) => {
      const items = getEntrySectorItems(entry);
      items.forEach((item) => {
        rows.push({
          entry,
          item,
          restoration: getItemRestoration(entry, item),
        });
      });
    });
    return rows;
  }, [trackedEntries]);

  const availableSectors = useMemo(
    () => Array.from(new Set(allTrackedItems.map((row) => row.item.sector))).sort(),
    [allTrackedItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTrackedItems.filter(({ entry, item, restoration }) => {
      if (provinceFilter && entry.province !== provinceFilter) return false;
      if (sectorFilter && item.sector !== sectorFilter) return false;
      if (stageFilter && restoration.stage !== stageFilter) return false;
      if (priorityFilter && entry.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${entry.id} ${entry.title} ${entry.municipality} ${trMunicipality(entry.municipality)} ${entry.district} ${entry.tole} ${item.sector} ${trSector(item.sector)} ${item.standardName} ${trStandardName(item.standardName)} ${restoration.agency || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allTrackedItems,
    search,
    provinceFilter,
    sectorFilter,
    stageFilter,
    priorityFilter,
    trMunicipality,
    trSector,
    trStandardName,
  ]);

  const stats = useMemo(() => {
    const uniqueEntries = new Set(filtered.map((row) => row.entry.id)).size;
    const totalLoss = filtered.reduce((acc, row) => acc + (Number(row.item.lossNPR) || 0), 0);
    const totalBudget = filtered.reduce(
      (acc, row) => acc + (Number(row.restoration.budget) || 0),
      0
    );
    const totalSpent = filtered.reduce(
      (acc, row) => acc + (Number(row.restoration.spent) || 0),
      0
    );
    const avgPct = filtered.length
      ? Math.round(
          filtered.reduce((acc, row) => acc + (Number(row.restoration.progress) || 0), 0) /
            filtered.length
        )
      : 0;
    const completed = filtered.filter((row) => row.restoration.stage === 'Restored').length;
    return { uniqueEntries, totalLoss, totalBudget, totalSpent, avgPct, completed };
  }, [filtered]);

  const hasActiveFilters = Boolean(
    search || provinceFilter || sectorFilter || stageFilter || priorityFilter
  );

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">{t.trackedCases}</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-slate-900">
            {filtered.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono-tabular">
            {stats.uniqueEntries}{' '}
            {stats.uniqueEntries === 1 ? t.entrySingular : t.entryPlural} ·{' '}
            {t.activeCompletedWorks}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">{t.totalDamageValuation}</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-red-700">
            {formatNPR(stats.totalLoss, true, lang)}
          </div>
          <div className="mt-1.5 text-xs font-mono-tabular text-slate-500">
            {formatNPR(stats.totalLoss, false, lang)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">{t.allocatedBudget}</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-slate-900">
            {formatNPR(stats.totalBudget, true, lang)}
          </div>
          <div className="mt-1.5 text-xs font-mono-tabular text-slate-500">
            {t.utilized}: {formatNPR(stats.totalSpent, true, lang)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">{t.avgPhysicalProgress}</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-emerald-700">
            {stats.avgPct}%
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {stats.completed} {t.fullyRestored}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value && onClearInitialSearch) onClearInitialSearch();
            }}
            placeholder={t.searchRestorationPlaceholder}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                if (onClearInitialSearch) onClearInitialSearch();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              title={t.clearFilters}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[160px]"
        >
          <option value="">{t.allSectors}</option>
          {availableSectors.map((sec) => (
            <option key={sec} value={sec}>
              {trSector(sec)}
            </option>
          ))}
        </select>

        <select
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[155px]"
        >
          <option value="">{t.allProvinces}</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {trProvince(p)}
            </option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[165px]"
        >
          <option value="">{t.allStages}</option>
          {RESTORATION_STAGES.map((s) => (
            <option key={s} value={s}>
              {trStage(s)}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[130px]"
        >
          <option value="">{t.allPriorities}</option>
          {(['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).map((prio) => (
            <option key={prio} value={prio}>
              {trPriority(prio)}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setProvinceFilter('');
              setSectorFilter('');
              setStageFilter('');
              setPriorityFilter('');
              if (onClearInitialSearch) onClearInitialSearch();
            }}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Monitoring Table: One row per entered Sector & Damage Name */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {t.majorRestorationMonitoring}
            </h2>
            <span className="text-xs text-slate-500">{t.restorationSubtitle}</span>
          </div>
          <span className="text-xs font-mono-tabular text-slate-500">
            {filtered.length} {filtered.length === 1 ? t.itemWord : t.itemsWord}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm text-slate-500">
            {t.noRestorationMatch}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">{t.colSectorsCriteria}</th>
                  <th className="py-3 px-4">{t.colIncidentLocation}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.colPriorityStage}</th>
                  <th className="py-3 px-4 min-w-[160px]">{t.colPhysicalProgress}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t.colFinancialsNPR}</th>
                  <th className="py-3 px-4">{t.colAgencyTarget}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map(({ entry, item, restoration: r }) => {
                  const barColor =
                    r.progress >= 100
                      ? 'bg-emerald-600'
                      : r.progress >= 40
                      ? 'bg-blue-600'
                      : 'bg-amber-600';

                  return (
                    <tr
                      key={`${entry.id}-${item.id}`}
                      className="hover:bg-slate-50/75 transition-colors"
                    >
                      <td className="py-3 px-4 align-top min-w-[230px]">
                        <div className="font-semibold text-slate-900">
                          {trStandardName(item.standardName)}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          <span className="font-medium">{trSector(item.sector)}</span> ·{' '}
                          <span className="font-mono-tabular">
                            {(Number(item.qty) || 0).toLocaleString('en-IN')} {trUnit(item.unit)}
                          </span>{' '}
                          · <span className={severityTextStyle(item.severity)}>{trSeverity(item.severity)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top min-w-[220px]">
                        <div className="font-medium text-slate-900">{entry.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {trMunicipality(entry.municipality)} · {t.ward} {entry.ward} ·{' '}
                          {trDistrict(entry.district)}
                        </div>
                        <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                          {entry.id} · {trHazard(entry.hazard)}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className={`text-xs ${priorityTextStyle(entry.priority)}`}>
                          {trPriority(entry.priority)} {t.prioritySuffix}
                        </div>
                        <div className={`text-xs mt-1 ${stageTextStyle(r.stage)}`}>
                          {trStage(r.stage)}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center justify-between text-xs font-mono-tabular mb-1.5">
                          <span className="text-slate-600">{t.completion}</span>
                          <span className="font-semibold text-slate-900">{r.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${r.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {r.logs.length}{' '}
                          {r.logs.length === 1 ? t.inspectionLogSingular : t.inspectionLogPlural}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono-tabular">
                        <div className="text-slate-900 font-medium">
                          {t.budget}: {formatNPR(r.budget, true, lang)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {t.spent}: {formatNPR(r.spent, true, lang)}
                        </div>
                        <div className="text-xs text-red-700 mt-0.5">
                          {t.loss}: {formatNPR(item.lossNPR, true, lang)}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top min-w-[170px]">
                        <div className="text-slate-900 text-xs font-medium">
                          {r.agency || trMunicipality(entry.municipality)}
                        </div>
                        <div className="text-xs font-mono-tabular text-slate-500 mt-0.5">
                          {t.target}: {r.targetDate || t.tbd}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
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
                            disabled={!isAdmin && entry.verification === 'Approved by Palika'}
                            onClick={() => onUpdateProgress(entry, item)}
                            title={
                              !isAdmin && entry.verification === 'Approved by Palika'
                                ? t.lockedApprovedTooltip
                                : t.updateBtn
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-700"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{t.updateBtn}</span>
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
