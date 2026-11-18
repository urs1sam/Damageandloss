import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Language,
  UI_TEXT,
  UIText,
  tDistrict,
  tHazard,
  tMunicipality,
  tPriority,
  tProvince,
  tQuestionLabel,
  tQuestionOption,
  tReliefItem,
  tSector,
  tSeverity,
  tStage,
  tStandardCriteria,
  tStandardName,
  tUnit,
  tVerification,
} from './translations';
import { PriorityLevel, RestorationStage, SeverityLevel, VerificationStatus } from '../types/mis';

const LANG_STORAGE_KEY = 'nepal_mis_lang';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: UIText;
  trProvince: (p: string) => string;
  trDistrict: (d: string) => string;
  trMunicipality: (m: string) => string;
  trHazard: (h: string) => string;
  trSector: (s: string) => string;
  trSeverity: (sev: SeverityLevel) => string;
  trPriority: (prio: PriorityLevel) => string;
  trVerification: (ver: VerificationStatus) => string;
  trStage: (stage: RestorationStage) => string;
  trUnit: (unit: string) => string;
  trStandardName: (name: string) => string;
  trStandardCriteria: (criteria?: string) => string;
  trQuestionLabel: (label: string) => string;
  trQuestionOption: (opt: string) => string;
  trReliefItem: (name: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ne' || saved === 'en') return saved;
    } catch {
      // ignore storage errors
    }
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = lang === 'ne' ? 'ne' : 'en';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      toggleLang: () => setLangState((prev) => (prev === 'en' ? 'ne' : 'en')),
      t: (UI_TEXT[lang] || UI_TEXT.en) as UIText,
      trProvince: (p) => tProvince(p, lang),
      trDistrict: (d) => tDistrict(d, lang),
      trMunicipality: (m) => tMunicipality(m, lang),
      trHazard: (h) => tHazard(h, lang),
      trSector: (s) => tSector(s, lang),
      trSeverity: (sev) => tSeverity(sev, lang),
      trPriority: (prio) => tPriority(prio, lang),
      trVerification: (ver) => tVerification(ver, lang),
      trStage: (stage) => tStage(stage, lang),
      trUnit: (unit) => tUnit(unit, lang),
      trStandardName: (name) => tStandardName(name, lang),
      trStandardCriteria: (criteria) => tStandardCriteria(criteria, lang),
      trQuestionLabel: (label) => tQuestionLabel(label, lang),
      trQuestionOption: (opt) => tQuestionOption(opt, lang),
      trReliefItem: (name) => tReliefItem(name, lang),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
