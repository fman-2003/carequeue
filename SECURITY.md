# Security

CareQueue handles protected health information: medical profiles, clinical
notes, prescriptions, lab documents, and patient contact details. This
document records how the application protects that data, what was fixed in
the security review, and what is deliberately still open.

---

## Threat model in one paragraph

Every authenticated user is a potential adversary. Patients, doctors,
receptionists, and clinic admins all hold valid sessions, and the platform
is multi-tenant — clinics share one database. So the questions that matter
are: can a signed-in account read a record belonging to someone it has no
relationship with, and can it read across a clinic boundary? Most of the
work below answers those two questions.

---

## Session handling

**Transport.** The session JWT is delivered in an `httpOnly`, `Secure`,
`SameSite=Lax` cookie (`lib/auth/session.ts`). It is never returned in a
response body and never stored in `localStorage`.

The token previously lived in `localStorage` and was attached as a
`Bearer` header by 48 call sites. Anything running in the page —
an injected script, a compromised dependency, a browser extension — could
read it and replay a valid role-carrying credential until it expired. An
`httpOnly` cookie is not reachable from JavaScript at all.

**Token verification** (`lib/auth/jwt.ts`):

- The algorithm is pinned to `HS256` on verify. Without `algorithms`,
  `jwt.verify` honours the `alg` the *token* declares, which is how
  `alg: none` forgeries and RS256→HS256 confusion attacks work.
- `issuer` and `audience` are set and checked.
- The secret must be at least 32 characters; the module refuses to load
  otherwise, so a weak secret fails at boot rather than silently signing
  guessable tokens.
- The decoded payload is shape-checked before any route sees it.

**CSRF.** `SameSite=Lax` is the primary defence: browsers withhold the
cookie on cross-site `POST`/`PATCH`/`DELETE`. Behind it,
`assertSameOrigin` (`lib/auth/middleware.ts`) rejects any state-changing
request whose `Origin` names a different host. Requests with no `Origin`
are allowed — they carry no ambient cookie and so cannot be forged.

Origins are compared **by host, not by full origin**. Behind a
TLS-terminating proxy the app is reached over http while the browser
reports https; a forged cross-site request always differs in host.

**Client-side session state.** The dashboard used to read the user's role
by base64-decoding the JWT in the browser — an unverified claim from a
token the client could also edit. It now calls `GET /api/auth/session`,
which reads the signed cookie server-side. A small display-only hint
(name, role, clinic) is cached in `localStorage` so components can render
without each issuing a request; it is explicitly **not** a permission
check, and editing it by hand reveals a menu item and no data.

---

## Authorization

`lib/auth/access.ts` is the single place patient-data access is decided.

| Role | Clinical records (profile, visits, documents) |
| --- | --- |
| Patient | Own records only |
| Doctor | Patients registered at the doctor's own clinic |
| Receptionist | None — scheduling and front desk only |
| Admin | None — clinic administration only |

This is minimum-necessary access. Admins and receptionists previously
could read every clinical record they could name an id for; they now
cannot read clinical content at all.

**Two patterns that were causing the leaks:**

1. `const patientId = role === "patient" ? userId : searchParams.get("patientId")`

   Any account that was not a patient could name any patient id and
   receive that person's records, across clinics, with no relationship
   required. Replaced by `resolvePatientAccess`, which proves access
   before a record is read.

2. `User.find({ clinicId: payload.clinicId, ... })`

   Mongoose **strips `undefined` values from a query filter**. For a
   session with no clinic — which an admin account has until it creates
   one, and admin signup is self-service — this became
   `User.find({ role: "doctor" })`: every doctor on the platform, with
   email and phone. `requireClinic` now guards every clinic-scoped query.

**Not-found over forbidden.** Where a `403` would confirm that an id
exists, the response is a `404` instead, so endpoints cannot be used to
enumerate real record ids.

---

## Input handling

- Ids are validated against the ObjectId format before reaching a query.
  This rejects the object-shaped payloads used for NoSQL operator
  injection (`{"patientId": {"$ne": null}}`) at the edge.
- Every free-text field has an explicit maximum length, and every array a
  maximum size. Unbounded text is a cheap way to inflate storage, slow
  later reads, and eventually breach MongoDB's 16MB document limit.
- Update schemas omit the identity fields (`patientId`, `doctorId`,
  `clinicId`, `appointmentId`). The visit-record `PATCH` previously
  forwarded the raw body into `$set`, so a request could move an existing
  clinical note onto a different patient's chart.
- `signupUser` writes an explicit field list rather than spreading the
  request body, so no field added to the schema later becomes settable at
  registration.

---

## File uploads

`lib/security/fileValidation.ts` and `lib/services/storage.service.ts`.

- **Content is sniffed, not trusted.** `file.type` and `file.name` come
  from the browser. Uploads are checked against the actual file signature
  (JPEG / PNG / WEBP / PDF); a file whose bytes disagree with its declared
  type is rejected. Medical document uploads previously had no type or
  size check at all and used Cloudinary's `resource_type: "auto"`, which
  let the uploaded content decide how it was stored and served.
- **Size** is capped before and after buffering (5MB avatars, 15MB
  documents), because the reported size is also client-controlled.
- **Filenames** are stripped of path separators, traversal sequences, and
  control characters.
- **Patient documents use Cloudinary's `authenticated` delivery type**
  under a random public id, so an asset is only reachable through a URL
  signed with the account secret. They were previously public assets at
  `carequeue/patients/<patientId>/<fileType>_<timestamp>` — a guessable
  path, and public to anyone who obtained the URL.

  Signed URLs are generated per request at read time. They do not expire;
  Cloudinary's expiring URLs need the token-based auth add-on. If that is
  available on the account, add `auth_token: { duration: 300 }` in
  `signedAssetUrl` and links become short-lived as well.

Documents uploaded before this change have no `publicId` recorded and
still resolve through their stored public URL. See *Migration* below.

---

## Rate limiting

`lib/security/rateLimit.ts`. Fixed-window counters on the paths worth
protecting:

| Endpoint | Limit |
| --- | --- |
| Login (per IP **and** per account) | 8 / 15 min |
| Signup | 5 / hour |
| Password change | 5 / 15 min |
| File uploads | 20 / hour |
| AI scheduling | 15 / hour |
| Model training | 2 / hour |
| WhatsApp webhook | 120 / min |

Login is limited on two keys. Per-IP alone does not stop a distributed
attempt against one mailbox; per-account alone does not stop spraying many
accounts from one host. A successful login clears both counters so a user
is not locked out by their own typos.

**Scope limit:** counters live in the process. On a multi-instance or
serverless deployment each instance keeps its own window, so the effective
limit is (limit × instances). That still cuts brute-force throughput
substantially and costs nothing to run. Move the counters to Redis/Upstash
when the app runs on more than one instance.

---

## Shared secrets

- **Cron** (`/api/cron/cleanup-waitlist`, `/api/cron/retrain-model`)
  compare the header with
  `safeCompare` (`lib/security/secrets.ts`), a constant-time comparison
  over SHA-256 digests. The previous check interpolated the secret into a
  template string, so an unset `CRON_SECRET` made the expected header the
  literal `Bearer undefined` — which anyone can send. It now fails closed
  when the secret is missing.
- **Twilio webhook** signatures are verified whenever a Twilio auth token
  is configured, and in production a missing token means the endpoint
  refuses every request rather than trusting unsigned input. Verification
  previously ran in production only, which left an endpoint that confirms
  and cancels real appointments open to anyone who knew the URL.
  `crypto.timingSafeEqual` throws on length mismatch, so lengths are
  checked first — the throw was being swallowed into a `200`.
- **Invite codes** carry 96 bits of entropy, expire after 7 days, and are
  claimed atomically in a single `findOneAndUpdate` matching
  `isUsed: false` and the requested role. The previous read-then-write
  left a race in which two concurrent signups could redeem one code, and
  a receptionist code could be redeemed for a doctor account — which is
  read access to every patient record at that clinic.

---

## Transport and browser hardening

`proxy.ts` (Next 16's replacement for `middleware.ts`) sets, on every
response:

- `Content-Security-Policy` — nonce-based, with `strict-dynamic`. Next.js
  stamps the per-request nonce onto its own bundles. `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
  API routes get `default-src 'none'` instead.
- `Strict-Transport-Security` — 2 years, subdomains, preload (production).
- `X-Content-Type-Options: nosniff` — an uploaded file a browser decides
  to treat as HTML is stored XSS.
- `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- `Cache-Control: no-store, private` on API responses, which carry PHI.
- `poweredByHeader: false` in `next.config.ts`.

`style-src` keeps `'unsafe-inline'` because MUI/Emotion inject stylesheets
at runtime through the CSSOM. Inline *styles* cannot execute script;
`script-src` is what blocks XSS, and it carries no `'unsafe-inline'`.

Nonces require server rendering, so `app/layout.tsx` sets
`export const dynamic = "force-dynamic"`. A statically prerendered page is
built before any request exists and its scripts carry no nonce, so a strict
`script-src` would block them. Every page here is behind authentication or
fetches on mount, so little was gained from prerendering.

**Fonts are self-hosted** through `next/font` rather than loaded from
`fonts.googleapis.com`. A third-party stylesheet request reveals every
visitor's IP address and the page they are on; on a healthcare app the URL
alone can be sensitive.

---

## Error handling and logging

`lib/security/errors.ts`. Routes previously returned `err.message`
directly, which for a driver failure meant connection strings, collection
and field names, and cast errors naming the schema went to the client.
Errors the application raised itself (`AppError`, or a plain `Error` whose
message passes a leak filter) are returned; everything else is logged
server-side with a route tag and reported generically.

Logs no longer carry patient phone numbers, waitlist candidate documents,
form contents, or session payloads.

---

## Passwords

- bcrypt, cost factor 12.
- Minimum 8 characters, must contain a letter and a digit, common
  passwords rejected, maximum 72 (bcrypt silently ignores bytes past 72,
  so a longer password is no stronger and only costs hashing work).
- Login compares against a dummy hash when the account does not exist, so
  a missing account and a wrong password take the same time. Without it
  the endpoint is a user-enumeration oracle — on a healthcare platform,
  confirming that an address is registered is itself a disclosure.
- Login and signup return one message for every failure mode.

---

## Known gaps

Recorded honestly rather than left implicit.

1. **No token revocation.** JWTs are stateless and valid until they
   expire (default 1 day). A password change re-issues the cookie in that
   browser but does not invalidate tokens held elsewhere. A "sign out
   everywhere" needs a `tokenVersion` on the user document that
   `verifyToken` checks — a small change, and the right next step if
   session hijacking is in scope.

2. **Rate limits are per-process.** See above.

3. **Self-service admin signup.** Anyone can register as `admin` and
   create a clinic. This appears to be the intended onboarding flow, and
   the data leak it enabled is closed (`requireClinic`), so a new admin
   with no clinic now sees nothing. But it does mean the `admin` role is
   not vouched for by anyone. Consider requiring email verification, or
   manual approval, before a clinic goes live.

4. **Email addresses are not verified.** `isVerified` exists on the user
   model and is never set. A user can change their email to any address
   without confirming it.

5. **Signed document URLs do not expire.** See *File uploads*.

6. **No audit log.** HIPAA-style regimes expect a record of who accessed
   which patient record and when. Nothing here records reads. If CareQueue
   is going to operate under a compliance regime, this is the largest
   remaining gap.

7. **Prompt injection in AI scheduling.** Patient messages reach an LLM
   whose system prompt contains other patients' availability. The message
   is length-capped and the prompt instructs the model not to disclose
   other users, but instruction-based defences are not guarantees. The
   blast radius is limited to doctor names and open slots at the caller's
   own clinic.

---

## Migration notes

Changes that need action on an existing deployment.

**1. Everyone is signed out.** Sessions moved from `localStorage` to a
cookie. Existing users need to log in again. Nothing else is required.

**2. `NEXT_PUBLIC_APP_URL` must be set.** Twilio signature verification
and the origin allowlist both use it. Without it they fall back to the
request `Host` header, which works but is weaker. It was referenced by the
old signature check and was never set, which means that check was
computing against `undefined/api/webhooks/whatsapp` and failing every
request in production.

**3. Password policy applies to new passwords only.** Existing users can
still sign in with passwords that predate the rule; the policy applies at
signup and password change.

**4. The `phone` index needs rebuilding.** `phone` was `unique` without
`sparse`, so only one user in the entire system could exist without a
phone number. It is now sparse. On an existing database:

```javascript
db.users.dropIndex("phone_1")
```

Mongoose recreates it correctly on next start.

**5. Existing medical documents remain public.** Documents uploaded before
this change are stored with Cloudinary's public delivery type and have no
`publicId` recorded, so they still resolve through their stored URL. To
close that, re-upload them as `authenticated` assets and backfill
`publicId` / `resourceType` / `deliveryType`. New uploads are private from
the start.

**6. Rotate any secret that was ever committed.** The seed script
contained a hardcoded password (`lib/db/seed.ts`) that looked like a
personal one. If it is reused anywhere, change it there too. `debug.log`
was tracked in git and has been removed. Git history still contains both —
rotate rather than rely on the file being gone.

**7. Receptionists and admins lose access to clinical records.** This is
intentional (see *Authorization*). If the product genuinely needs
front-desk staff to read clinical notes, widen `CLINICAL_ROLES` in
`lib/auth/access.ts` — one line, in one place, deliberately.

---

## Reporting a vulnerability

Email the maintainer rather than opening a public issue. Include the
endpoint, the request, and what you were able to read or change.
