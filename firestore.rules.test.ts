/**
 * Security Rules Audit & Dirty Dozen Verification Suite for firestore.rules
 * Validates the 12 adversarial attack vectors from security_spec.md against the ruleset logic.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_AUDIT: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Product',
    collection: '/products/{productId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidProduct(incoming()) -> keys().hasOnly([...])',
  },
  {
    id: 2,
    name: 'Privilege Escalation on User Profile',
    collection: '/users/{userId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserProfile() -> keys().hasOnly([...]) excludes role/isAdmin',
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    collection: '/users/{userId} & /users/{userId}/addresses/{addressId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow get/list strictly requires isOwner(userId) || isAdmin()',
  },
  {
    id: 4,
    name: 'Self-Verified Order Creation',
    collection: '/orders/{orderId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().paymentStatus in ['awaiting_payment_verification', 'deposit_pending_verification', 'credably_pending']",
  },
  {
    id: 5,
    name: 'Client-Side Payment Self-Approval',
    collection: '/payments/{paymentId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update: if isAdmin() only',
  },
  {
    id: 6,
    name: 'Admin Role Self-Grant',
    collection: '/admins/{userId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow create: if isBootstrappedAdmin() only',
  },
  {
    id: 7,
    name: 'Unbounded Array Resource Exhaustion',
    collection: '/orders/{orderId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.items.size() >= 1 && data.items.size() <= 50',
  },
  {
    id: 8,
    name: 'ID Poisoning via Malformed Document ID',
    collection: 'All Collections',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "isValidId(id) -> id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 9,
    name: 'Instalment Plan Balance Tampering',
    collection: '/instalment_plans/{planId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update: if isAdmin(); create enforces adminApproved == false && amountPaidVerifiedNgn == 0',
  },
  {
    id: 10,
    name: 'Order Cancellation Bypass After Dispatch',
    collection: '/orders/{orderId}',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "existing().orderStatus in ['awaiting_payment_verification', 'processing']",
  },
  {
    id: 11,
    name: 'Timestamp Forgery',
    collection: 'All Collections',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 12,
    name: 'Unverified Email Write',
    collection: 'All User-Writable Collections',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
];
