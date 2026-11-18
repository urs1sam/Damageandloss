import React from 'react';
import { Languages, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useFirebase } from '../firebase/FirebaseContext';

export const AuthGate: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { signInWithGoogle, signingIn, authError } = useFirebase();

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-md w-full mx-auto flex justify-end">
        <div
          className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-lg"
          role="group"
          aria-label="Language switch"
        >
          <Languages className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('ne')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'ne' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            नेपाली
          </button>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 my-auto">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-red-600 flex items-center justify-center font-display font-bold text-base text-white shrink-0">
            NP
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              {t.appBrand}
            </div>
            <h1 className="font-display text-lg font-bold text-slate-900 leading-snug">
              {t.authHeading}
            </h1>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">{t.authSubtitle}</p>

        {authError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 break-words">
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={signingIn}
          className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{signingIn ? t.signingIn : t.signInWithGoogle}</span>
        </button>
      </div>

      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400">
        {t.sidebarSubtitle}
      </div>
    </div>
  );
};
