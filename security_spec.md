# Firestore Security Specification — Nepal Loss & Damage Entry MIS

## 1. Data Invariants
1. **Verified Identity Required**: Every read and write operation requires an authenticated user with `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Ownership & Anti-Spoofing**:
   - All user-created documents (`damageEntries`, `damageStandards`, `sectors`, `localBodies`) MUST have `ownerId == request.auth.uid` on `create`.
   - `ownerId`, `id`, and `createdAt` are immutable on `update`.
3. **PII Isolation (`damageEntries`)**:
   - `damageEntries` contains reporting officer PII (`officer`, `contact`, GPS `lat`/`lng`).
   - `get` and `list` access is strictly restricted to the document's `ownerId` or an authorized administrator (`isBootstrappedAdmin()` for `list` to avoid O(n) lookup costs; `isAdmin()` for `get`).
4. **System vs. User Catalog Scope (`damageStandards`, `sectors`, `localBodies`)**:
   - Non-admin users may only create/read/update/delete catalog items where `scope == 'user'` and `ownerId == request.auth.uid` (plus read `scope == 'system'` reference items).
   - Only `isAdmin()` may create, update, or delete `scope == 'system'` reference items.
5. **Terminal State Locking (`damageEntries.verification`)**:
   - Once a record reaches `'Approved by Palika'`, non-admin owners cannot modify the record (`isAdmin()` override allowed for corrections).
   - Non-admin owners cannot self-approve a record (`incoming().verification` must remain `'Pending Review'` on `create` unless `isAdmin()`, and cannot transition to `'Field Verified'` / `'Approved by Palika'` on `update` unless `isAdmin()`).
6. **Temporal Integrity & Path Hardening**:
   - All single-document operations validate `isValidId(docId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars) and `incoming().id == docId`.
   - `createdAt == request.time` on `create`; `createdAt == existing().createdAt && updatedAt == request.time` on `update`.
7. **Strict Schema & Size Bounds**:
   - Every string enforces `.size()` limits matching `firebase-blueprint.json`.
   - Every array (`sectorItems <= 50`, `restoration.logs <= 100`, `questions <= 40`, `customQuestions <= 30`) enforces `.size()` limits and first-element type checks.
   - Shadow/ghost keys are blocked via `keys().hasAll(...)`, `keys().hasOnly(...)`, and `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `damageEntries/LD-2026-9001` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: Sign in with `email == 'shrestha.nibas@gmail.com'` and `email_verified == false`, attempt `list` or `get` on another user's `damageEntries` -> `PERMISSION_DENIED`.
3. **Owner ID Spoofing on Create**: User A creates `damageEntries/LD-2026-9002` with `ownerId: 'user-b-uid'` -> `PERMISSION_DENIED`.
4. **Cross-User PII Read (`get`)**: User B attempts `get` on User A's `damageEntries/LD-2026-0001` -> `PERMISSION_DENIED`.
5. **Cross-User List Scraping (`list`)**: User B executes an unfiltered `list` query on `damageEntries` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: User A creates or updates `damageEntries/LD-2026-9003` with an extra key `{ isSuperApproved: true }` -> `PERMISSION_DENIED`.
7. **Self-Approved Verification Bypass**: Non-admin User A creates a `damageEntry` with `verification: 'Approved by Palika'` or updates `verification` to `'Approved by Palika'` -> `PERMISSION_DENIED`.
8. **Terminal State Mutation**: Non-admin User A attempts to update a `damageEntry` whose `existing().verification == 'Approved by Palika'` -> `PERMISSION_DENIED`.
9. **Path Variable / ID Poisoning**: User A writes to `damageEntries/bad$id with spaces` -> `PERMISSION_DENIED`.
10. **Payload Exhaustion (Denial of Wallet)**: User A sends a 250KB `photoDataUrl` (> 150,000 limit) or a 10KB `remarks` (> 2,000 limit) -> `PERMISSION_DENIED`.
11. **Privilege Escalation via `scope: 'system'`**: Non-admin User A creates a `damageStandard` with `scope: 'system'` -> `PERMISSION_DENIED`.
12. **Client-Forged Timestamp**: User A creates or updates a `damageEntry` with a backdated `createdAt` or `updatedAt` instead of `request.time` -> `PERMISSION_DENIED`.
