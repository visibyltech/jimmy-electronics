# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Catalogue Integrity**: Only verified administrators (`isAdmin()`) may create, update, or delete `/products`, `/categories`, `/brands`, and `/settings`. Public shoppers may read active catalogue documents.
2. **PII Isolation**: Customer profiles (`/users/{userId}`) and delivery addresses (`/users/{userId}/addresses/{addressId}`) are strictly readable and writable only by the authenticated owner (`request.auth.uid == userId`) or an administrator.
3. **Order Ownership & Status Integrity**: Customers can create orders solely under their own `userId` with initial status `awaiting_payment_verification` (or `credably_pending` for Credably BNPL) and cannot elevate `paymentStatus` to `paid_verified` or `orderStatus` to `delivered`. Customers may only cancel orders while `orderStatus == 'processing'` or `'awaiting_payment_verification'`.
4. **Payment & Receipt Verification Gate**: Customers can submit bank transfer payment records strictly with `status == 'pending_verification'`, and cannot self-approve or modify `verifiedBy`. Only admins can transition payment status to `approved` or `rejected`.
5. **Save to Buy Instalment Guard**: Customers cannot self-approve (`adminApproved == true`), lower `remainingBalanceNgn`, or waive late fees. Only admins can verify instalments, grant deadline extensions, or mark plans `completed`.
6. **Temporal & Structural Enforcement**: Every document enforces explicit `keys().hasAll(...)` and `keys().hasOnly(...)`, `isValidId()` path checks, string `.size()` bounds, bounded list sizes (`<= 50` items, `<= 5` images, `<= 12` instalments), and `request.time` server timestamp equality on `createdAt`/`updatedAt`.

## 2. The "Dirty Dozen" Attack Payloads (Must All Return `PERMISSION_DENIED`)
1. **Shadow Field Injection on Product**: Non-admin or admin sends `{ ..., shadowField: "hack" }` to `/products/p1`.
2. **Privilege Escalation on User Profile**: Authenticated user writes `{ uid: auth.uid, role: "admin" }` to `/users/{uid}`.
3. **Cross-User PII Read**: User A attempts `get` or `list` on `/users/userB` or `/users/userB/addresses/addr1`.
4. **Self-Verified Order Creation**: Customer creates `/orders/ord1` with `paymentStatus: "paid_verified"` or `orderStatus: "delivered"`.
5. **Client-Side Payment Self-Approval**: Customer updates `/payments/pay1` setting `status: "approved"` and `verifiedBy: auth.uid`.
6. **Admin Role Self-Grant**: Non-admin creates `/admins/{auth.uid}`.
7. **Unbounded Array Resource Exhaustion**: Customer creates `/orders/ord2` with 200 items in `items` array.
8. **ID Poisoning**: Attacker writes to `/orders/` with a 500-character document ID containing special characters (`../admin`).
9. **Instalment Plan Balance Tampering**: Customer updates `/instalment_plans/plan1` setting `remainingBalanceNgn: 0` or `adminApproved: true`.
10. **Order Cancellation Bypass**: Customer attempts to cancel an order whose `orderStatus` is already `"delivered"` or `"out_for_delivery"`.
11. **Timestamp Forgery**: User submits `createdAt: "1999-01-01T00:00:00Z"` instead of `request.time` server timestamp.
12. **Unverified Email Write**: User with `request.auth.token.email_verified == false` attempts to create an order or upload a payment record.
