import React, { useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  Share2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminMemberRecord, RoleAssignmentRecord, UserProfileRecord } from '../types/mis';
import { BOOTSTRAPPED_SUPERADMIN_EMAIL } from '../firebase/config';
import { useLanguage } from '../i18n/LanguageContext';

interface AccessManagementViewProps {
  currentUserUid: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  isBootstrappedSuperAdmin: boolean;
  usersDirectory: UserProfileRecord[];
  adminMembers: AdminMemberRecord[];
  roleAssignments: RoleAssignmentRecord[];
  entriesCount: number;
  onAssignByEmail: (
    email: string,
    role: 'superadmin' | 'admin',
    note: string,
    grantAllEntries: boolean
  ) => Promise<void>;
  onAssignByUid: (
    uid: string,
    role: 'superadmin' | 'admin',
    grantAllEntries: boolean,
    email?: string,
    displayName?: string
  ) => Promise<void>;
  onRevokeAdminUid: (uid: string) => Promise<void>;
  onRevokeRoleAssignment: (id: string) => Promise<void>;
  onGrantAllEntriesToUid: (uid: string) => Promise<void>;
}

export const AccessManagementView: React.FC<AccessManagementViewProps> = ({
  currentUserUid,
  currentUserEmail,
  currentUserName,
  isBootstrappedSuperAdmin,
  usersDirectory,
  adminMembers,
  roleAssignments,
  entriesCount,
  onAssignByEmail,
  onAssignByUid,
  onRevokeAdminUid,
  onRevokeRoleAssignment,
  onGrantAllEntriesToUid,
}) => {
  const { t } = useLanguage();

  const [mode, setMode] = useState<'email' | 'uid'>('email');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'superadmin'>('admin');
  const [note, setNote] = useState('');
  const [grantAllEntries, setGrantAllEntries] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleCopy = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'email') {
        if (!targetEmail.trim()) return;
        await onAssignByEmail(targetEmail.trim(), selectedRole, note.trim(), grantAllEntries);
        setTargetEmail('');
        setNote('');
      } else {
        if (!targetUid.trim()) return;
        const known = usersDirectory.find((u) => u.uid === targetUid.trim());
        await onAssignByUid(
          targetUid.trim(),
          selectedRole,
          grantAllEntries,
          known?.email,
          known?.displayName
        );
        setTargetUid('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const adminRoleByUid = new Map<string, AdminMemberRecord>();
  adminMembers.forEach((m) => adminRoleByUid.set(m.uid, m));

  return (
    <div className="space-y-6">
      {/* Super Admin Identity Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                  {t.accessTitle}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-md">
                  {t.superadminRoleBadge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">{t.accessSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-slate-500 font-medium">{t.superadminIdentityTitle}</div>
            <div className="font-semibold text-slate-900 mt-1 truncate">
              {currentUserName ? `${currentUserName} (${currentUserEmail})` : currentUserEmail}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono-tabular text-[11px] text-slate-600 truncate">
                {t.myUserIdLabel}: {currentUserUid}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(currentUserUid, 'self-uid')}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-700 bg-white border border-slate-200 hover:bg-blue-50 rounded"
              >
                {copiedKey === 'self-uid' ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t.copyId}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-emerald-900">
            <div className="font-semibold flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t.superadminRoleBadge}</span>
            </div>
            <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
              {t.superadminPermissionsNote}
            </p>
          </div>
        </div>
      </section>

      {/* Assign Role Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-700" />
            <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900">
              {t.assignRoleFormTitle}
            </h3>
          </div>

          <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('email')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === 'email'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t.assignByEmailTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('uid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === 'uid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{t.assignByUidTab}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mode === 'email' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.targetEmailLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder={t.targetEmailPlaceholder}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.targetUidLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                  placeholder={t.targetUidPlaceholder}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.roleLevelLabel}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'superadmin')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="admin">{t.roleOptionAdmin}</option>
                <option value="superadmin">{t.roleOptionSuperAdmin}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.optionalNoteLabel}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={mode === 'uid'}
                placeholder={t.optionalNotePlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={grantAllEntries}
                onChange={(e) => setGrantAllEntries(e.target.checked)}
                className="rounded border-slate-300 accent-blue-700"
              />
              <span>
                {t.grantAllEntriesCheckbox} ({entriesCount})
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? t.assigningRoleBtn : t.assignRoleBtn}</span>
            </button>
          </div>
        </form>
      </section>

      {!isBootstrappedSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
          {t.directoryRequiresBootstrapNote}
        </div>
      )}

      {isBootstrappedSuperAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Active Admin & Super Admin UIDs */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {t.activeAdminsTitle}
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {adminMembers.length}
              </span>
            </div>

            {adminMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">{t.noAssignedAdminsYet}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {adminMembers.map((member) => {
                  const isPrimaryBootstrap =
                    member.email?.toLowerCase() === BOOTSTRAPPED_SUPERADMIN_EMAIL.toLowerCase() ||
                    member.uid === currentUserUid;
                  return (
                    <div
                      key={member.uid}
                      className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {member.displayName || member.email || member.uid}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${
                              member.role === 'superadmin'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {member.role === 'superadmin'
                              ? t.superadminRoleBadge
                              : t.adminRoleBadge}
                          </span>
                        </div>
                        {member.email && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {member.email}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-mono-tabular text-slate-500 truncate max-w-[230px]">
                            {member.uid}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(member.uid, `admin-${member.uid}`)}
                            className="text-slate-400 hover:text-slate-700"
                            title={t.copyId}
                          >
                            {copiedKey === `admin-${member.uid}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isPrimaryBootstrap && (
                          <>
                            <select
                              value={member.role}
                              onChange={(e) =>
                                onAssignByUid(
                                  member.uid,
                                  e.target.value as 'admin' | 'superadmin',
                                  false,
                                  member.email,
                                  member.displayName
                                )
                              }
                              className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                            >
                              <option value="admin">{t.adminRoleBadge}</option>
                              <option value="superadmin">{t.superadminRoleBadge}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => onGrantAllEntriesToUid(member.uid)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md"
                              title={t.syncEntriesBtn}
                            >
                              <Share2 className="w-3 h-3" />
                              <span>{t.syncEntriesBtn}</span>
                            </button>
                            {confirmRevokeId === `adm-${member.uid}` ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmRevokeId(null);
                                  void onRevokeAdminUid(member.uid);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
                              >
                                {t.confirmDeleteBtn}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(`adm-${member.uid}`)}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                                title={t.revokeBtn}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        {isPrimaryBootstrap && (
                          <span className="text-[11px] font-medium text-slate-400">
                            {t.selfProtectedLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Email Pre-Assignments */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-700" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {t.pendingEmailAssignmentsTitle}
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {roleAssignments.length}
              </span>
            </div>

            {roleAssignments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {t.noPendingAssignmentsYet}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {roleAssignments.map((ra) => (
                  <div
                    key={ra.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {ra.email}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${
                            ra.role === 'superadmin'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {ra.role === 'superadmin'
                            ? t.superadminRoleBadge
                            : t.adminRoleBadge}
                        </span>
                      </div>
                      {ra.note && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{ra.note}</div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {confirmRevokeId === `ra-${ra.id}` ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmRevokeId(null);
                            void onRevokeRoleAssignment(ra.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
                        >
                          {t.confirmDeleteBtn}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(`ra-${ra.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                          title={t.revokeBtn}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Signed-In Users Directory */}
      {isBootstrappedSuperAdmin && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {t.userDirectoryTitle}
              </h3>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {usersDirectory.length}
            </span>
          </div>

          {usersDirectory.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">{t.noUsersYet}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5">{t.signedInAs}</th>
                    <th className="py-2.5 px-4">User ID (UID)</th>
                    <th className="py-2.5 px-4">{t.roleLevelLabel}</th>
                    <th className="py-2.5 px-5 text-right">{t.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersDirectory.map((u) => {
                    const member = adminRoleByUid.get(u.uid);
                    const isSelf =
                      u.uid === currentUserUid ||
                      u.email.toLowerCase() === BOOTSTRAPPED_SUPERADMIN_EMAIL.toLowerCase();
                    const effectiveRole = isSelf ? 'superadmin' : member?.role || 'officer';
                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/75">
                        <td className="py-2.5 px-5">
                          <div className="font-medium text-slate-900">
                            {u.displayName || u.email}
                          </div>
                          {u.displayName && (
                            <div className="text-xs text-slate-500">{u.email}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-xs text-slate-600">
                          <div className="inline-flex items-center gap-1.5">
                            <span>{u.uid}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(u.uid, `usr-${u.uid}`)}
                              className="text-slate-400 hover:text-slate-700"
                              title={t.copyId}
                            >
                              {copiedKey === `usr-${u.uid}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          <span
                            className={`px-2 py-0.5 font-semibold rounded border ${
                              effectiveRole === 'superadmin'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : effectiveRole === 'admin'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {effectiveRole === 'superadmin'
                              ? t.superadminRoleBadge
                              : effectiveRole === 'admin'
                              ? t.adminRoleBadge
                              : t.officerRoleBadge}
                          </span>
                        </td>
                        <td className="py-2.5 px-5 text-right whitespace-nowrap">
                          {isSelf ? (
                            <span className="text-xs text-slate-400">{t.selfProtectedLabel}</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onAssignByUid(u.uid, 'admin', true, u.email, u.displayName)
                                }
                                className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md"
                              >
                                {t.assignAdminQuick}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onAssignByUid(u.uid, 'superadmin', true, u.email, u.displayName)
                                }
                                className="px-2.5 py-1 text-xs font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md"
                              >
                                {t.assignSuperAdminQuick}
                              </button>
                              <button
                                type="button"
                                onClick={() => onGrantAllEntriesToUid(u.uid)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                {t.syncEntriesBtn}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
