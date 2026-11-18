import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  DamageStandard,
  QuestionFieldType,
  SectorQuestion,
  SeverityLevel,
} from '../types/mis';
import { formatNPR, severityTextStyle } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface SectorMeta {
  name: string;
  scope?: 'system' | 'user';
  ownerId?: string;
}

interface StandardsViewProps {
  sectors: string[];
  sectorConfigs?: SectorMeta[];
  sectorQuestions: Record<string, SectorQuestion[]>;
  standards: DamageStandard[];
  isAdmin?: boolean;
  currentUserId?: string;
  onSaveStandard: (standard: DamageStandard, isEdit: boolean) => void;
  onDeleteStandard: (id: string) => void;
  onSaveSector: (sectorName: string, questions: SectorQuestion[]) => void;
  onDeleteSector: (sectorName: string) => void;
}

export const StandardsView: React.FC<StandardsViewProps> = ({
  sectors,
  sectorConfigs = [],
  sectorQuestions,
  standards,
  isAdmin = false,
  currentUserId,
  onSaveStandard,
  onDeleteStandard,
  onSaveSector,
  onDeleteSector,
}) => {
  const {
    lang,
    t,
    trSector,
    trSeverity,
    trUnit,
    trStandardName,
    trStandardCriteria,
    trQuestionLabel,
  } = useLanguage();

  const [activeTab, setActiveTab] = useState<'standards' | 'sectors'>('standards');
  const formRef = useRef<HTMLDivElement | null>(null);
  const sectorFormRef = useRef<HTMLDivElement | null>(null);

  // Standard Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('Moderate');
  const [sector, setSector] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [criteria, setCriteria] = useState('');
  const [stdQuestions, setStdQuestions] = useState<
    { id: string; label: string; type: QuestionFieldType; optionsText: string; required: boolean }[]
  >([]);
  const [search, setSearch] = useState('');

  // Sector & Sector Questions Form State
  const [editingSectorName, setEditingSectorName] = useState<string | null>(null);
  const [sectorNameInput, setSectorNameInput] = useState('');
  const [confirmDeleteSector, setConfirmDeleteSector] = useState<string | null>(null);
  const [secQuestionsDraft, setSecQuestionsDraft] = useState<
    { id: string; label: string; type: QuestionFieldType; optionsText: string; required: boolean }[]
  >([]);

  const canManageStandard = (std: DamageStandard) =>
    isAdmin || (std.scope !== 'system' && (!std.ownerId || std.ownerId === currentUserId));

  const sectorMetaMap = useMemo(() => {
    const map = new Map<string, SectorMeta>();
    sectorConfigs.forEach((sc) => map.set(sc.name, sc));
    return map;
  }, [sectorConfigs]);

  const canManageSector = (secName: string) => {
    if (isAdmin) return true;
    const meta = sectorMetaMap.get(secName);
    if (!meta) return false;
    return meta.scope !== 'system' && (!meta.ownerId || meta.ownerId === currentUserId);
  };

  const resetStandardForm = () => {
    setEditingId(null);
    setCode('');
    setSeverity('Moderate');
    setSector('');
    setName('');
    setUnit('');
    setUnitCost('');
    setCriteria('');
    setStdQuestions([]);
  };

  const populateStandardForm = (std: DamageStandard, asNewCopy = false) => {
    setActiveTab('standards');
    setConfirmDeleteId(null);
    setEditingId(asNewCopy ? null : std.id);
    setCode(asNewCopy ? '' : std.code || '');
    setSeverity(std.severity);
    setSector(std.sector);
    setName(asNewCopy ? `${std.name} (Custom)` : std.name);
    setUnit(std.unit || '');
    setUnitCost(std.unitCost > 0 ? String(std.unitCost) : '');
    setCriteria(std.criteria || '');
    setStdQuestions(
      (std.customQuestions || []).map((q, idx) => ({
        id: asNewCopy ? `q-std-${Date.now()}-${idx}` : q.id,
        label: q.label,
        type: q.type,
        optionsText: (q.options || []).join(', '),
        required: Boolean(q.required),
      }))
    );
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedQuestions: SectorQuestion[] = stdQuestions
      .filter((q) => q.label.trim().length > 0)
      .map((q, idx) => ({
        id: q.id || `q-std-${Date.now()}-${idx}`,
        label: q.label.trim(),
        type: q.type,
        options:
          q.type === 'select'
            ? q.optionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        required: q.required,
      }));

    const existingStd = editingId ? standards.find((s) => s.id === editingId) : undefined;

    const payload: DamageStandard = {
      id: editingId || `STD-${Date.now()}`,
      scope: existingStd?.scope,
      ownerId: existingStd?.ownerId,
      code: code.trim() ? code.trim().toUpperCase() : undefined,
      severity,
      sector: sector.trim(),
      name: name.trim(),
      unit: unit.trim() || 'Units',
      unitCost: parseFloat(unitCost) || 0,
      criteria: criteria.trim() || undefined,
      customQuestions: formattedQuestions.length > 0 ? formattedQuestions : undefined,
    };
    onSaveStandard(payload, Boolean(editingId));
    resetStandardForm();
  };

  const handleConfirmDeleteStandard = (id: string) => {
    onDeleteStandard(id);
    if (editingId === id) {
      resetStandardForm();
    }
    setConfirmDeleteId(null);
  };

  const resetSectorForm = () => {
    setEditingSectorName(null);
    setSectorNameInput('');
    setSecQuestionsDraft([]);
  };

  const handleSelectSectorToEdit = (secName: string) => {
    setActiveTab('sectors');
    setConfirmDeleteSector(null);
    setEditingSectorName(secName);
    setSectorNameInput(secName);
    const existing = sectorQuestions[secName] || [];
    setSecQuestionsDraft(
      existing.map((q) => ({
        id: q.id,
        label: q.label,
        type: q.type,
        optionsText: (q.options || []).join(', '),
        required: Boolean(q.required),
      }))
    );
    requestAnimationFrame(() => {
      sectorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleSectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sectorNameInput.trim();
    if (!clean) return;
    const formatted: SectorQuestion[] = secQuestionsDraft
      .filter((q) => q.label.trim().length > 0)
      .map((q, idx) => ({
        id: q.id || `q-sec-${Date.now()}-${idx}`,
        label: q.label.trim(),
        type: q.type,
        options:
          q.type === 'select'
            ? q.optionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        required: q.required,
      }));
    onSaveSector(clean, formatted);
    resetSectorForm();
  };

  const filteredStandards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return standards;
    return standards.filter((s) =>
      `${s.code || ''} ${s.sector} ${trSector(s.sector)} ${s.name} ${trStandardName(s.name)} ${s.criteria || ''} ${s.severity}`
        .toLowerCase()
        .includes(q)
    );
  }, [standards, search, trSector, trStandardName]);

  const allSectors = useMemo(
    () => Array.from(new Set([...sectors, ...standards.map((s) => s.sector)])).sort(),
    [sectors, standards]
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('standards')}
            className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'standards'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabDamageStandards} ({standards.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sectors')}
            className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'sectors'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabSectorsQuestions} ({allSectors.length})
          </button>
        </div>
      </div>

      {activeTab === 'standards' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Add / Edit Damage Standard Form */}
          <div
            ref={formRef}
            className={`xl:col-span-5 bg-white rounded-xl p-5 border ${
              editingId ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {editingId
                  ? `${t.editStandard}${code ? ` · ${code}` : ''}`
                  : t.addDamageStandardTitle}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetStandardForm}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 px-2.5 py-1 rounded-md"
                >
                  {t.cancel}
                </button>
              )}
            </div>

            <form onSubmit={handleStandardSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.standardCodeOpt}
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., DMG-HSG-01"
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.severityTier}
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {(['Minor', 'Moderate', 'Severe', 'Catastrophic'] as SeverityLevel[]).map(
                      (sev) => (
                        <option key={sev} value={sev}>
                          {trSeverity(sev)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.sectorReq} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="sector-suggestions"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder={t.sectorInputPlaceholder}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <datalist id="sector-suggestions">
                  {allSectors.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.damageNameReq} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.damageNamePlaceholder}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.unitOpt}
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={t.unitDefaultPlaceholder}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.defaultCostOpt}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder={t.leaveBlankManual}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.guidelineOpt}
                </label>
                <textarea
                  rows={2}
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  placeholder={t.guidelinePlaceholder}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Standard-specific Related Questions */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {t.standardQuestionsOpt}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setStdQuestions((prev) => [
                        ...prev,
                        {
                          id: `q-std-${Date.now()}`,
                          label: '',
                          type: 'text',
                          optionsText: '',
                          required: false,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addQuestion}</span>
                  </button>
                </div>

                {stdQuestions.length > 0 && (
                  <div className="space-y-2.5 mt-2">
                    {stdQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) =>
                              setStdQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, label: e.target.value } : item
                                )
                              )
                            }
                            placeholder={t.questionPromptPlaceholder}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          />
                          <select
                            value={q.type}
                            onChange={(e) =>
                              setStdQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, type: e.target.value as QuestionFieldType }
                                    : item
                                )
                              )
                            }
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          >
                            <option value="text">{t.qTypeText}</option>
                            <option value="yesno">{t.qTypeYesNo}</option>
                            <option value="number">{t.qTypeNumber}</option>
                            <option value="select">{t.qTypeSelect}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setStdQuestions((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {q.type === 'select' && (
                          <input
                            type="text"
                            value={q.optionsText}
                            onChange={(e) =>
                              setStdQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, optionsText: e.target.value } : item
                                )
                              )
                            }
                            placeholder={t.choicesPlaceholder}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingId ? t.updateDamageStandard : t.addDamageStandardBtn}</span>
              </button>
            </form>
          </div>

          {/* Right: Configured Standards Table */}
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {t.configuredStandards} ({standards.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{t.syncedToForm}</p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.filterStandardsPlaceholder}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {filteredStandards.length === 0 ? (
              <div className="py-12 px-6 text-center text-sm text-slate-500">
                {t.noStandardsMatch}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">{t.colCodeSector}</th>
                      <th className="py-3 px-4">{t.colCriteriaGuideline}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.colSeverity}</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">
                        {t.colUnitBenchmark}
                      </th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredStandards.map((std) => {
                      const isEditingRow = editingId === std.id;
                      const isConfirmingDelete = confirmDeleteId === std.id;
                      const manageable = canManageStandard(std);

                      return (
                        <tr
                          key={std.id}
                          className={`transition-colors ${
                            isEditingRow ? 'bg-blue-50/70' : 'hover:bg-slate-50/75'
                          }`}
                        >
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            <div className="font-mono-tabular font-semibold text-slate-900">
                              {std.code || '—'}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {trSector(std.sector)}
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top min-w-[230px]">
                            <div className="font-medium text-slate-900">
                              {trStandardName(std.name)}
                              {isEditingRow && (
                                <span className="ml-2 text-[11px] font-semibold text-blue-700">
                                  ({t.editingNow})
                                </span>
                              )}
                            </div>
                            {std.criteria && (
                              <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                {trStandardCriteria(std.criteria)}
                              </div>
                            )}
                            {std.customQuestions && std.customQuestions.length > 0 && (
                              <div className="text-xs text-blue-700 mt-1">
                                +{std.customQuestions.length}{' '}
                                {std.customQuestions.length === 1
                                  ? t.customFieldQuestionSingular
                                  : t.customFieldQuestionPlural}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            <span className={`text-xs ${severityTextStyle(std.severity)}`}>
                              {trSeverity(std.severity)}
                            </span>
                          </td>
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                            {std.unitCost > 0 ? (
                              <>
                                <div className="font-mono-tabular font-semibold text-slate-900">
                                  {formatNPR(std.unitCost, false, lang)}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {t.per} {trUnit(std.unit)}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs font-medium text-slate-600">
                                  {t.manualPerEntry}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {trUnit(std.unit)}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                            {manageable ? (
                              isConfirmingDelete ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeleteStandard(std.id)}
                                    className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
                                  >
                                    {t.confirmDeleteBtn}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                                    title={t.cancel}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => populateStandardForm(std, false)}
                                    className={`p-1.5 rounded-md ${
                                      isEditingRow
                                        ? 'text-blue-700 bg-blue-100'
                                        : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                                    }`}
                                    title={t.editStandard}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(std.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                                    title={t.deleteEntry}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => populateStandardForm(std, true)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                                title={t.adminOnlyStandardDelete}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{t.duplicateToEdit}</span>
                              </button>
                            )}
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
      ) : (
        /* ==================== TAB 2: SECTORS & RELATED QUESTIONS ==================== */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div
            ref={sectorFormRef}
            className={`xl:col-span-5 bg-white rounded-xl p-5 border ${
              editingSectorName ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {editingSectorName
                    ? `${t.editStandard} · ${trSector(editingSectorName)}`
                    : t.addConfigureSectorTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{t.addConfigureSectorDesc}</p>
              </div>
              {editingSectorName && (
                <button
                  type="button"
                  onClick={resetSectorForm}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 px-2.5 py-1 rounded-md shrink-0"
                >
                  {t.cancel}
                </button>
              )}
            </div>

            <form onSubmit={handleSectorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.sectorNameReq} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sectorNameInput}
                  onChange={(e) => setSectorNameInput(e.target.value)}
                  placeholder={t.sectorNamePlaceholder}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {t.relatedFieldQuestionsCount} ({secQuestionsDraft.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSecQuestionsDraft((prev) => [
                        ...prev,
                        {
                          id: `q-sec-${Date.now()}`,
                          label: '',
                          type: 'text',
                          optionsText: '',
                          required: false,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addQuestion}</span>
                  </button>
                </div>

                {secQuestionsDraft.length === 0 ? (
                  <p className="text-xs text-slate-500">{t.clickAddQuestionHint}</p>
                ) : (
                  <div className="space-y-2.5">
                    {secQuestionsDraft.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) =>
                              setSecQuestionsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, label: e.target.value } : item
                                )
                              )
                            }
                            placeholder={t.questionPromptPlaceholder}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          />
                          <select
                            value={q.type}
                            onChange={(e) =>
                              setSecQuestionsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, type: e.target.value as QuestionFieldType }
                                    : item
                                )
                              )
                            }
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          >
                            <option value="text">{t.qTypeText}</option>
                            <option value="yesno">{t.qTypeYesNo}</option>
                            <option value="number">{t.qTypeNumber}</option>
                            <option value="select">{t.qTypeSelect}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setSecQuestionsDraft((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {q.type === 'select' && (
                          <input
                            type="text"
                            value={q.optionsText}
                            onChange={(e) =>
                              setSecQuestionsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, optionsText: e.target.value } : item
                                )
                              )
                            }
                            placeholder={t.choicesPlaceholder}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                          />
                        )}

                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) =>
                              setSecQuestionsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, required: e.target.checked } : item
                                )
                              )
                            }
                            className="rounded border-slate-300"
                          />
                          <span>{t.required}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                {editingSectorName ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{t.saveSectorQuestions}</span>
              </button>
            </form>
          </div>

          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t.activeSectorsTitle}
              </h2>
            </div>

            <div className="divide-y divide-slate-200">
              {allSectors.map((sec) => {
                const qList = sectorQuestions[sec] || [];
                const stdCount = standards.filter((s) => s.sector === sec).length;
                const manageable = canManageSector(sec);
                const isConfirmingSec = confirmDeleteSector === sec;

                return (
                  <div
                    key={sec}
                    className={`p-4 flex flex-wrap items-start justify-between gap-4 transition-colors ${
                      sectorNameInput === sec ? 'bg-blue-50/70' : 'hover:bg-slate-50/75'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-900">
                        {trSector(sec)}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          · {stdCount} {stdCount === 1 ? t.standardSingular : t.standardPlural} ·{' '}
                          {qList.length}{' '}
                          {qList.length === 1 ? t.questionSingular : t.questionPlural}
                        </span>
                      </div>
                      {qList.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {qList.map((q) => (
                            <li key={q.id}>
                              • {trQuestionLabel(q.label)}{' '}
                              <span className="text-slate-400">
                                ({q.type}
                                {q.required ? `, ${t.required.toLowerCase()}` : ''})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {manageable && (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        {isConfirmingSec ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSector(sec);
                                setConfirmDeleteSector(null);
                              }}
                              className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
                            >
                              {t.confirmDeleteBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSector(null)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                              title={t.cancel}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectSectorToEdit(sec)}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                              title={t.editStandard}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSector(sec)}
                              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                              title={t.removeSector}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
