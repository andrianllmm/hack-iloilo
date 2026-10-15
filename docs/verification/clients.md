# Clients merge verification

The clients directory keeps `findOrRegisterByPhone(phone, defaults?)` returning
`Promise<Client>`. `registerClientRecord` continues returning `{ client, created }`,
and `clientsDirectory()` continues returning all client rows. The signature checks
live in `queries.test.ts` and are checked by TypeScript. SMS and gate can call the
server helpers from their actions or queries without importing React or TanStack
Table. Their full workflows remain outside this clients change.

Column sorting applies to all filtered clients before pagination. Clearing the sort
restores co-op grouping and alphabetical member order. Co-op context is repeated
when a sorted page begins with a member or switches co-ops. Search and kind filters
continue to run in the pure directory helper; table-specific features stay under
`components/`.

Staff can delete a client from its edit sheet after confirming. Existing foreign
keys reject deletion when any co-op member, booking, offer, queue entry, batch,
purchase or dispatch references the client. The UI reports the restriction and
keeps the record. No cascading deletes or schema changes are introduced.

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. With local Supabase running,
`RUN_ACCOUNTS_DB_TESTS=1 pnpm test` also exercises shared-helper CRUD, simultaneous
phone registration, co-op protection and booking protection. Those integration
tests refuse remote database URLs and clean up their temporary records. Table
model tests cover page boundaries, page sizes and sorting across the full dataset.
Browser verification should also cover searching from a later page, kind filters,
empty results, sorting toggles, page-size selection, quick registration, editing,
delete cancellation, successful deletion and a linked-client error.

Rollback is an application-code rollback: revert the clients feature changes as a
unit, including `package.json`, `pnpm-lock.yaml`, the clients page, and accounts
helpers, UI and tests, then run `pnpm install --frozen-lockfile` and the checks.
The original table-only change is commit `b4b1408`; reverting only that commit
restores the pre-table UI and removes its TanStack dependency while retaining the
shared clients helpers. A full clients rollback must include subsequent dependent
clients commits together and account for any later consumers of those helpers.
Do not reset the database: this feature has no migrations or stored-data format
changes. Reverting code preserves remaining data; it does not restore clients
intentionally deleted while the feature was active.
