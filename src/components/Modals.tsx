import React, { useEffect, useState } from 'react';
import { Plus, Printer, Trash2, UserPlus, X } from 'lucide-react';
import {
  AdminMemberRecord,
  DamageEntry,
  DamageStandard,
  NepalAdminMap,
  QuestionFieldType,
  RestorationStage,
  RestorationState,
  SectorAssessmentItem,
  SectorQuestion,
  SeverityLevel,
  UserProfileRecord,
} from '../types/mis';
import { RESTORATION_STAGES } from '../data/defaults';
import {
  formatNPR,
  getEntrySectorItems,
  getItemRestoration,
  severityTextStyle,
  stageTextStyle,
} from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

/* ============================================================================
   1. RESTORATION PROGRESS UPDATE MODAL (PER-ITEM)
   ============================================================================ */
interface RestorationModalProps {
  target: { entry: DamageEntry; item: SectorAssessmentItem } | null;
  onClose: () => void;
  onSave: (entryId: string, itemId: string, updated: RestorationState) => void;
}

export const RestorationModal: React.FC<RestorationModalProps> = ({
  target,
  onClose,
  onSave,
}) => {
  const { lang, t, trDistrict, trMunicipality, trSector, trStage, trStandardName, trUnit } =
    useLanguage();
  const [stage, setStage] = useState<RestorationStage>('Not Started');
  const [progress, setProgress] = useState(0);
  const [budget, setBudget] = useState('0');
  const [spent, setSpent] = useState('0');
  const [agency, setAgency] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!target) return;
    const r = getItemRestoration(target.entry, target.item);
    setStage(r.stage);
    setProgress(r.progress);
    setBudget(String(r.budget));
    setSpent(String(r.spent));
    setAgency(r.agency || target.entry.municipality);
    setTargetDate(r.targetDate || '');
    setNote('');
  }, [target]);

  if (!target) return null;

  const { entry, item } = target;
  const currentRest = getItemRestoration(entry, item);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalProgress = stage === 'Restored' ? 100 : progress;
    const logs = [...(currentRest.logs || [])];
    logs.push({
      date: new Date().toISOString().slice(0, 10),
      note: note.trim() || `Stage updated to ${stage} (${finalProgress}%).`,
    });

    onSave(entry.id, item.id, {
      stage,
      progress: finalProgress,
      budget: parseFloat(budget) || 0,
      spent: parseFloat(spent) || 0,
      agency: agency.trim(),
      targetDate,
      logs,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-3 mb-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {t.updateRestorationTitle}
            </h3>
            <div className="text-xs font-semibold text-blue-800 mt-1">
              {trSector(item.sector)} · {trStandardName(item.standardName)} (
              <span className="font-mono-tabular">
                {(Number(item.qty) || 0).toLocaleString('en-IN')} {trUnit(item.unit)} ·{' '}
                {formatNPR(item.lossNPR, false, lang)}
              </span>
              )
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {entry.id} · {entry.title} · {trMunicipality(entry.municipality)} · {t.ward}{' '}
              {entry.ward}, {trDistrict(entry.district)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.restorationStage}
              </label>
              <select
                required
                value={stage}
                onChange={(e) => {
                  const next = e.target.value as RestorationStage;
                  setStage(next);
                  if (next === 'Restored') setProgress(100);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {RESTORATION_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {trStage(st)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>{t.physicalProgress}</span>
                <span className="font-mono-tabular text-blue-700">{progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full mt-2 accent-blue-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.allocatedBudgetNPR}
              </label>
              <input
                type="number"
                min="0"
                required
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.utilizedSpentNPR}
              </label>
              <input
                type="number"
                min="0"
                required
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.implementingAgency}
              </label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder={t.agencyPlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.targetCompletionDate}
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.newInspectionNote}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.inspectionNotePlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              {t.activityHistory} ({currentRest.logs.length})
            </div>
            <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              {currentRest.logs.length === 0 ? (
                <div className="text-xs text-slate-500">{t.noLogsYet}</div>
              ) : (
                currentRest.logs
                  .slice()
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={`${log.date}-${i}`}
                      className="text-xs text-slate-700 pb-2 border-b border-slate-200/70 last:border-b-0 last:pb-0"
                    >
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {log.date}:
                      </span>{' '}
                      {log.note}
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              {t.saveProgressUpdate}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   2. ADD CUSTOM LOCAL LEVEL / MUNICIPALITY MODAL
   ============================================================================ */
interface LocalBodyModalProps {
  isOpen: boolean;
  admin: NepalAdminMap;
  initialProvince?: string;
  initialDistrict?: string;
  onClose: () => void;
  onSave: (province: string, district: string, name: string, wards: number) => void;
}

export const LocalBodyModal: React.FC<LocalBodyModalProps> = ({
  isOpen,
  admin,
  initialProvince,
  initialDistrict,
  onClose,
  onSave,
}) => {
  const { t, trProvince, trDistrict } = useLanguage();
  const provinces = Object.keys(admin);
  const [province, setProvince] = useState(provinces[0] || '');
  const [district, setDistrict] = useState('');
  const [name, setName] = useState('');
  const [wards, setWards] = useState('9');

  useEffect(() => {
    if (!isOpen) return;
    const prov = initialProvince && admin[initialProvince] ? initialProvince : provinces[0];
    setProvince(prov);
    const dists = Object.keys(admin[prov] || {}).sort();
    setDistrict(
      initialDistrict && dists.includes(initialDistrict) ? initialDistrict : dists[0] || ''
    );
    setName('');
    setWards('9');
  }, [isOpen, initialProvince, initialDistrict, admin]);

  if (!isOpen) return null;

  const districts = Object.keys(admin[province] || {}).sort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numWards = Math.max(5, Math.min(35, parseInt(wards, 10) || 9));
    if (!name.trim() || !province || !district) return;
    onSave(province, district, name.trim(), numWards);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-3 mb-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {t.addLocalLevelTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.addLocalLevelDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.province}
            </label>
            <select
              required
              value={province}
              onChange={(e) => {
                const p = e.target.value;
                setProvince(p);
                const d = Object.keys(admin[p] || {}).sort();
                setDistrict(d[0] || '');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {trProvince(p)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.district}
            </label>
            <select
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {trDistrict(d)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.localLevelName} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.localLevelPlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.totalWards} <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              min="5"
              max="35"
              required
              value={wards}
              onChange={(e) => setWards(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">{t.wardCountHint}</p>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              {t.addLocalLevelBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   3. QUICK ADD SECTOR + DAMAGE STANDARD + RELATED QUESTIONS MODAL
   ============================================================================ */
interface QuickSectorStandardModalProps {
  isOpen: boolean;
  sectors: string[];
  initialSector?: string;
  onClose: () => void;
  onSave: (payload: {
    sector: string;
    standard: DamageStandard;
    sectorQuestionsToAdd: SectorQuestion[];
  }) => void;
}

export const QuickSectorStandardModal: React.FC<QuickSectorStandardModalProps> = ({
  isOpen,
  sectors,
  initialSector,
  onClose,
  onSave,
}) => {
  const { t, trSeverity } = useLanguage();
  const [sectorInput, setSectorInput] = useState('');
  const [code, setCode] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('Moderate');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [criteria, setCriteria] = useState('');

  const [questions, setQuestions] = useState<
    { label: string; type: QuestionFieldType; optionsText: string; required: boolean }[]
  >([]);

  useEffect(() => {
    if (!isOpen) return;
    setSectorInput(initialSector || '');
    setCode('');
    setSeverity('Moderate');
    setName('');
    setUnit('');
    setUnitCost('');
    setCriteria('');
    setQuestions([]);
  }, [isOpen, initialSector]);

  if (!isOpen) return null;

  const addQuestionRow = () => {
    setQuestions((prev) => [
      ...prev,
      { label: '', type: 'text', optionsText: '', required: false },
    ]);
  };

  const updateQuestionRow = (
    idx: number,
    patch: Partial<{
      label: string;
      type: QuestionFieldType;
      optionsText: string;
      required: boolean;
    }>
  ) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const removeQuestionRow = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSector = sectorInput.trim();
    if (!cleanSector || !name.trim()) return;

    const formattedQuestions: SectorQuestion[] = questions
      .filter((q) => q.label.trim().length > 0)
      .map((q, idx) => ({
        id: `q-custom-${Date.now()}-${idx}`,
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

    const standard: DamageStandard = {
      id: `STD-${Date.now()}`,
      code: code.trim() ? code.trim().toUpperCase() : undefined,
      sector: cleanSector,
      name: name.trim(),
      severity,
      unit: unit.trim() || 'Units',
      unitCost: parseFloat(unitCost) || 0,
      criteria: criteria.trim() || undefined,
      customQuestions: formattedQuestions.length > 0 ? formattedQuestions : undefined,
    };

    onSave({
      sector: cleanSector,
      standard,
      sectorQuestionsToAdd: formattedQuestions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-3 mb-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {t.quickAddModalTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.quickAddModalDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.sectorSelectOrType} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                list="quick-sector-list"
                value={sectorInput}
                onChange={(e) => setSectorInput(e.target.value)}
                placeholder={t.sectorInputPlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <datalist id="quick-sector-list">
                {sectors.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.standardCodeOpt}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., DMG-TEL-01"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Related Field Questions Builder */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {t.standardQuestionsOpt}
                </div>
                <div className="text-xs text-slate-500">{t.addConfigureSectorDesc}</div>
              </div>
              <button
                type="button"
                onClick={addQuestionRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-md whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addQuestion}</span>
              </button>
            </div>

            {questions.length > 0 && (
              <div className="space-y-2.5 mt-3">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => updateQuestionRow(idx, { label: e.target.value })}
                        placeholder={t.questionPromptPlaceholder}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestionRow(idx, { type: e.target.value as QuestionFieldType })
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="text">{t.qTypeText}</option>
                        <option value="yesno">{t.qTypeYesNo}</option>
                        <option value="number">{t.qTypeNumber}</option>
                        <option value="select">{t.qTypeSelect}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeQuestionRow(idx)}
                        className="p-1 text-slate-400 hover:text-red-700"
                        title={t.removeItem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {q.type === 'select' && (
                      <input
                        type="text"
                        value={q.optionsText}
                        onChange={(e) => updateQuestionRow(idx, { optionsText: e.target.value })}
                        placeholder={t.choicesPlaceholder}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    )}

                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestionRow(idx, { required: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span>{t.requiredInForm}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              {t.saveAndSelectInEntry}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   4. PRINTABLE FIELD INCIDENT REPORT MODAL
   ============================================================================ */
interface ReportModalProps {
  entry: DamageEntry | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ entry, onClose }) => {
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
    trVerification,
    trStage,
    trUnit,
    trStandardName,
    trQuestionLabel,
    trQuestionOption,
    trReliefItem,
  } = useLanguage();

  if (!entry) return null;
  const sectorItems = getEntrySectorItems(entry);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-xl print-surface">
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">{t.reportHeader}</div>
            <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">{entry.title}</h3>
            <div className="text-xs font-mono-tabular text-slate-500 mt-1">
              {t.referenceId}: {entry.id} · {t.incidentDate}: {entry.date}
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.print}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">{t.adminLocation}</div>
              <div className="font-medium text-slate-900 mt-0.5">
                {trMunicipality(entry.municipality)} · {t.ward} {entry.ward}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {entry.tole}, {trDistrict(entry.district)}, {trProvince(entry.province)}
              </div>
              {(entry.lat || entry.lng) && (
                <div className="text-xs font-mono-tabular text-slate-500 mt-1">
                  GPS: {entry.lat || '-'}, {entry.lng || '-'}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">{t.hazardVerification}</div>
              <div className="font-medium text-slate-900 mt-0.5">
                {trHazard(entry.hazard)} · {trVerification(entry.verification)} ·{' '}
                {trPriority(entry.priority)} {t.prioritySuffix}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t.fieldOfficer}: {entry.officer} {entry.contact ? `(${entry.contact})` : ''}
              </div>
            </div>
          </div>

          {/* Human & Displacement Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block">{t.death}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {entry.deaths ?? 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.missing}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {entry.missing ?? 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.injured}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {entry.injured ?? 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.affectedFamilies}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {entry.affectedHH}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.fullyDisplaced}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {entry.fullyDisplaced ?? 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.tempDisplaced}</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {typeof entry.tempDisplaced === 'number'
                  ? entry.tempDisplaced
                  : Math.max(0, (entry.affectedHH || 0) - (entry.fullyDisplaced || 0))}
              </span>
            </div>
          </div>

          {/* Multi-Sector Assessment Details + Answered Questions */}
          <div className="pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-700">
                {t.sectorDamageAssessments} ({sectorItems.length}{' '}
                {sectorItems.length === 1 ? t.itemSingular : t.itemPlural})
              </div>
              <div className="font-mono-tabular font-bold text-red-700">
                {t.colTotalEstLoss}: {formatNPR(entry.lossNPR, false, lang)}
              </div>
            </div>

            <div className="space-y-3">
              {Array.from(
                sectorItems.reduce((map, item) => {
                  const list = map.get(item.sector) || [];
                  list.push(item);
                  map.set(item.sector, list);
                  return map;
                }, new Map<string, typeof sectorItems>())
              ).map(([sectorName, items]) => {
                const mergedAnswers = items.reduce<Record<string, string>>(
                  (acc, i) => ({ ...acc, ...(i.answers || {}) }),
                  {}
                );
                const answeredPairs = Object.entries(mergedAnswers).filter(([, val]) =>
                  Boolean(val)
                );
                const sectorTotal = items.reduce((s, i) => s + (Number(i.lossNPR) || 0), 0);

                return (
                  <div
                    key={sectorName}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-900">{trSector(sectorName)}</span>
                      <span className="font-mono-tabular text-xs font-semibold text-red-700">
                        {t.subtotal}: {formatNPR(sectorTotal, false, lang)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const itemRest = getItemRestoration(entry, item);
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-medium text-slate-900">
                                {trStandardName(item.standardName)}
                              </span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className={severityTextStyle(item.severity)}>
                                {trSeverity(item.severity)}
                              </span>
                              {entry.trackRestoration && (
                                <>
                                  <span className="text-slate-400 mx-1.5">·</span>
                                  <span className={stageTextStyle(itemRest.stage)}>
                                    {trStage(itemRest.stage)} ({itemRest.progress}%)
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="font-mono-tabular text-slate-900">
                              {item.qty} {trUnit(item.unit)} ·{' '}
                              <span className="font-semibold">
                                {formatNPR(item.lossNPR, false, lang)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {answeredPairs.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {answeredPairs.map(([question, answer]) => (
                          <div key={question}>
                            <span className="text-slate-500">{trQuestionLabel(question)}: </span>
                            <span className="font-medium text-slate-900">
                              {trQuestionOption(answer)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Required Relief Materials Summary */}
          {entry.reliefItems && entry.reliefItems.length > 0 && (
            <div className="pb-4 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  {t.reliefSummaryHeader} ({entry.reliefItems.length}{' '}
                  {entry.reliefItems.length === 1 ? t.reliefItemWord : t.reliefItemsWord})
                </div>
                {(entry.reliefDurationDays ?? 21) > 0 && (
                  <div className="text-xs font-medium text-slate-600 font-mono-tabular">
                    {t.reliefEstimatedForPrefix} {entry.reliefDurationDays ?? 21}{' '}
                    {t.reliefDaysUnit}
                  </div>
                )}
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2 px-3">{t.reliefItemCol}</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">{t.reliefQtyCol}</th>
                      <th className="py-2 px-3">{t.reliefNoteCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.reliefItems.map((ri) => (
                      <tr key={ri.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {trReliefItem(ri.name)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                          {(Number(ri.qty) || 0).toLocaleString('en-IN')} {trUnit(ri.unit)}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{ri.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {entry.remarks && (
            <div className="pb-4 border-b border-slate-200">
              <div className="text-xs text-slate-500 mb-1">{t.fieldObservations}</div>
              <p className="text-slate-700 leading-relaxed">{entry.remarks}</p>
            </div>
          )}

          {entry.photoDataUrl && (
            <div className="pb-4 border-b border-slate-200">
              <div className="text-xs text-slate-500 mb-2">{t.fieldEvidencePhoto}</div>
              <img
                src={entry.photoDataUrl}
                alt={entry.photoName || 'Field damage evidence'}
                className="max-h-56 rounded-lg border border-slate-200 object-contain"
              />
            </div>
          )}

          {entry.trackRestoration && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-slate-700">
                  {t.majorRestorationStatus}
                </div>
                <span className={`text-xs ${stageTextStyle(entry.restoration.stage)}`}>
                  {trStage(entry.restoration.stage)} ({entry.restoration.progress}%)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                <div>
                  <span className="text-slate-500 block">{t.allocatedBudget}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatNPR(entry.restoration.budget, false, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.utilizedAmount}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatNPR(entry.restoration.spent, false, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.targetCompletion}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {entry.restoration.targetDate || t.tbd}
                  </span>
                </div>
              </div>
              {entry.restoration.logs.length > 0 && (
                <div className="space-y-1.5 text-xs text-slate-600">
                  {entry.restoration.logs.map((l, idx) => (
                    <div key={`${l.date}-${idx}`}>
                      <span className="font-mono-tabular font-semibold text-slate-800">
                        {l.date}:
                      </span>{' '}
                      {l.note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. ASSIGN ENTRY TO USER IDS MODAL (SUPER ADMIN)
   ============================================================================ */
interface AssignEntryModalProps {
  entry: DamageEntry | null;
  usersDirectory: UserProfileRecord[];
  adminMembers: AdminMemberRecord[];
  onClose: () => void;
  onSave: (entry: DamageEntry, nextOwnerId: string, nextAssignedIds: string[]) => Promise<void>;
}

export const AssignEntryModal: React.FC<AssignEntryModalProps> = ({
  entry,
  usersDirectory,
  adminMembers,
  onClose,
  onSave,
}) => {
  const { t } = useLanguage();
  const [ownerId, setOwnerId] = useState('');
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [newUidInput, setNewUidInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setOwnerId(entry.ownerId || '');
    setAssignedIds(entry.assignedIds || []);
    setNewUidInput('');
    setSaving(false);
  }, [entry]);

  if (!entry) return null;

  const knownUsersMap = new Map<string, { uid: string; label: string }>();
  usersDirectory.forEach((u) => {
    knownUsersMap.set(u.uid, {
      uid: u.uid,
      label: u.displayName ? `${u.displayName} (${u.email})` : u.email,
    });
  });
  adminMembers.forEach((m) => {
    if (!knownUsersMap.has(m.uid)) {
      knownUsersMap.set(m.uid, {
        uid: m.uid,
        label: m.displayName || m.email || m.uid,
      });
    }
  });
  const knownUsers = Array.from(knownUsersMap.values());

  const addAssignedUid = (rawUid: string) => {
    const clean = rawUid.trim();
    if (!clean || assignedIds.includes(clean) || assignedIds.length >= 20) return;
    setAssignedIds((prev) => [...prev, clean]);
    setNewUidInput('');
  };

  const removeAssignedUid = (uid: string) => {
    setAssignedIds((prev) => prev.filter((id) => id !== uid));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !ownerId.trim()) return;
    setSaving(true);
    try {
      await onSave(entry, ownerId.trim(), assignedIds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-3 mb-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{t.assignEntryModalTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.assignEntryModalDesc}</p>
            <div className="text-xs font-medium text-slate-700 mt-1.5 truncate">
              <span className="font-mono-tabular text-slate-500">{entry.id}</span> · {entry.title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.primaryOwnerIdLabel} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              list="known-entry-owner-uids"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder={t.targetUidPlaceholder}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono-tabular border border-slate-300 rounded-lg"
            />
            <datalist id="known-entry-owner-uids">
              {knownUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.label}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.additionalAssignedIdsLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newUidInput}
                onChange={(e) => setNewUidInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAssignedUid(newUidInput);
                  }
                }}
                placeholder={t.addUidPlaceholder}
                className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => addAssignedUid(newUidInput)}
                className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap"
              >
                {t.addUidBtn}
              </button>
            </div>

            {knownUsers.length > 0 && (
              <div className="mt-2.5">
                <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                  {t.pickFromUsersLabel}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {knownUsers.map((u) => {
                    const already = assignedIds.includes(u.uid) || ownerId === u.uid;
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        disabled={already}
                        onClick={() => addAssignedUid(u.uid)}
                        className="px-2 py-1 text-[11px] font-medium border border-slate-200 rounded-md bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800 disabled:opacity-45 disabled:cursor-not-allowed truncate max-w-[230px]"
                        title={u.uid}
                      >
                        + {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {assignedIds.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                {assignedIds.map((uid) => {
                  const match = knownUsers.find((u) => u.uid === uid);
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="min-w-0 truncate">
                        {match ? (
                          <>
                            <span className="font-medium text-slate-900">{match.label}</span>{' '}
                            <span className="font-mono-tabular text-[11px] text-slate-500">
                              ({uid})
                            </span>
                          </>
                        ) : (
                          <span className="font-mono-tabular text-slate-800">{uid}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAssignedUid(uid)}
                        className="p-1 text-slate-400 hover:text-red-700 rounded"
                        title={t.removeItem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !ownerId.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              {t.saveEntryAssignmentsBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

