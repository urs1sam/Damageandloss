import React from 'react';
import {
  BarChart3,
  Check,
  ClipboardPlus,
  Copy,
  Wrench,
  Ruler,
  Download,
  LogOut,
  MapPinPlus,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { ViewId } from '../types/mis';
import { useLanguage } from '../i18n/LanguageContext';
import { NepalGovLogo } from './NepalGovLogo';

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  restorationCount: number;
  standardsCount: number;
  isOpen: boolean;
  onClose: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onOpenLocalBodyModal: () => void;
  onResetDemoData: () => void;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  restorationCount,
  standardsCount,
  isOpen,
  onClose,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onOpenLocalBodyModal,
  onResetDemoData,
  userEmail,
  userName,
  userId,
  isAdmin,
  isSuperAdmin,
  onSignOut,
}) => {
  const { t } = useLanguage();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  React.useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const navItems: { id: ViewId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'dashboard', label: t.navDashboard, icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: 'entry', label: t.navEntry, icon: <ClipboardPlus className="w-4 h-4 shrink-0" /> },
    {
      id: 'restoration',
      label: t.navRestoration,
      icon: <Wrench className="w-4 h-4 shrink-0" />,
      count: restorationCount,
    },
    {
      id: 'standards',
      label: t.navStandards,
      icon: <Ruler className="w-4 h-4 shrink-0" />,
      count: standardsCount,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'access' as ViewId,
            label: t.navAccess,
            icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden no-print"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-out lg:translate-x-0 no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <NepalGovLogo className="w-10 h-10 shadow-md" />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-white truncate">
                {t.sidebarTitle}
              </div>
              <div className="text-xs text-slate-400 truncate">{t.sidebarSubtitle}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono-tabular text-xs ${
                      isActive ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={onOpenLocalBodyModal}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 transition-colors whitespace-nowrap"
          >
            <MapPinPlus className="w-3.5 h-3.5 shrink-0 text-blue-400" />
            <span>{t.addLocalLevelWard}</span>
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{t.exportCsv}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onExportJSON}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
              title="Backup all MIS data as JSON"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{t.backup}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
              title="Import MIS JSON backup"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>{t.restore}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportJSON(file);
                e.target.value = '';
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              setConfirmClear(false);
              onResetDemoData();
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              confirmClear
                ? 'bg-red-950/70 text-red-200 border border-red-800 hover:bg-red-900/70'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{confirmClear ? t.confirmClearEntries : t.resetSample}</span>
          </button>

          {userEmail && onSignOut && (
            <div className="pt-2 mt-2 border-t border-slate-800 space-y-1.5">
              <div className="px-2 py-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-300 truncate">
                    {userName || userEmail}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-300 shrink-0">
                    {isSuperAdmin
                      ? t.superadminRoleBadge
                      : isAdmin
                      ? t.adminRoleBadge
                      : t.officerRoleBadge}
                  </span>
                </div>
                {userName && (
                  <div className="text-[10px] text-slate-400 truncate">{userEmail}</div>
                )}
                {userId && (
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <span className="text-[10px] font-mono-tabular text-slate-400 truncate">
                      {t.myUserIdLabel}: {userId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(userId).catch(() => {});
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 1800);
                      }}
                      className="text-slate-400 hover:text-white shrink-0 p-0.5"
                      title={t.copyId}
                    >
                      {copiedId ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{t.signOut}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
