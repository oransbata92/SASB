# Security Specification: Trading SaaS Pro

## Data Invariants
1. A signal must belong to an asset class (crypto, forex, or stocks).
2. A signal's confidence cannot exceed 100%.
3. User balances and risk percentages must be non-negative.
4. Users can only read and write their own profile data.
5. Signals are immutable once created (except for system results, but for now we keep it simple).

## The "Dirty Dozen" Payloads (Denial Tests)
1. Set `confidence` to 150.
2. Set `assetClass` to "commodities".
3. Update another user's profile.
4. Delete a signal.
5. Create a signal with a client-controlled `createdAt` timestamp.
6. Inject a 1MB string into `symbol`.
7. Modify the `email` field in a user update.
8. Create a user profile with a different `auth.uid`.
9. Set `riskPercent` to -5.
10. Read all users list.
11. Update a signal's `entry` price after creation.
12. Create a signal without being signed in.
