# Nepal Loss & Damage Entry MIS

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Run `npm run lint` (TypeScript check) and `npm run build` before deployment.
5. Deploy `dist/` to Firebase Hosting or any static host. Add the hosting domain under Firebase Console → Authentication → Settings → Authorized domains.

## Firebase configuration

The app is configured for Firebase project `quaint-voyager-nmbw7` and the named Firestore database:

`ai-studio-nepallossdamagee-85b00d9c-fa55-4e44-b60a-71c1ad3442cd`

Firestore security rules are database-specific. The included `firebase.json` targets this named database (not `(default)`). To publish the rules, install and sign in to the Firebase CLI, then run:

```bash
firebase use quaint-voyager-nmbw7
firebase deploy --only firestore
```

After deployment, open Firebase Console → Firestore Database and confirm the Rules tab for the named database above shows the same rules. Do not publish these rules only to `(default)`.

## Important security notes

- Do not replace the rules with `allow read, write: if request.auth != null`.
- The bootstrapped superadmin is `shrestha.nibas@gmail.com`; the email must be verified.
- The app refreshes the Firebase ID token before saving damage entries so the verified-email claim is current.
- `createdAt` and `updatedAt` must be server timestamps.

## Known limitations

- `firestore.rules.test.ts` is a specification of adversarial cases, not an executable test suite. Run the rules against the Firebase Emulator (`@firebase/rules-unit-testing`) before go-live.
- Firestore rules cannot loop over lists, so only the first element of `sectorItems`, `reliefItems` and `restoration.logs` is schema-checked server-side.
- `photoDataUrl` is stored inline in Firestore (limit 150 KB). Consider Cloud Storage if photo volume grows.
- The production bundle is a single ~1.2 MB chunk (326 KB gzipped); acceptable for now, code-splitting is optional.
