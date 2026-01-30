# Implementation Plan: Modular Success, Security Flow, and Session Management

## Goal
Implement a consistent "Success" modal, a mandatory post-wallet security setup (Passcode -> Biometrics -> Notifications), and a robust session management system that correctly routes returning users and auto-locks the app securely.

---

## 1. Modular Success Feedback
### [Components]
- **`components/ui/SuccessModal.tsx`**:
    - Centralized modal matching Figma (`3279:122997`).
    - **Props**:
        - `isVisible`: boolean
        - `onDone`: () => void
        - `type`: 'created' | 'imported' | 'connected'
    - **Logic**: Dynamic text ("Wallet Created Successfully!", etc.) based on type.

---

## 2. Security Flow (The Mandatory Gatekeeper)
### [Stores]
- **`store/securityStore.ts`**:
    - Add `isSetupComplete: boolean` to track the first-time setup flow.
    - Add `lastActive: number` to track when the app was last used (for auto-lock).

### [Routes]
- **`app/security/index.tsx`**: Passcode Creation (Move existing `app/security.tsx` logic here).
- **`app/security/confirm.tsx`**: Passcode Confirmation.
- **`app/security/biometrics.tsx`**: Biometrics pitch (Optional but presented).
- **`app/security/notifications.tsx`**: Push Notification permission request.

### [Services]
- **`services/notificationService.ts`**:
    - Uses `expo-notifications`.
    - Handles permission checks/requests.
    - Obtains Push Token for FCM/APNs.

---

## 3. Session Management & Returning Users
### [Logic]
- **Auto-Lock Logic**:
    - Use `AppState` in `RootLayout`.
    - When `AppState` changes from `active` -> `background`, record `Date.now()`.
    - When `AppState` changes back to `active`, check if delta > 5 minutes.
    - If yes, `lockApp()`.

- **Navigation Guards (`app/_layout.tsx`)**:
    - **New User**: `!hasCompletedOnboarding` -> Onboarding.
    - **Returning (Not Connected)**: `hasCompletedOnboarding && !isConnected` -> Welcome.
    - **Returning (Connected & Locked)**: `isConnected && hasPasscode && (isLocked || sessionExpired)` -> Lock Screen (Passcode).
    - **Setup Flow**: `isConnected && !isSetupComplete` -> Mandatory Security Flow.

### [Fixes]
- **CRITICAL**: Remove `AsyncStorage.clear()` from `RootLayout` initialization. This is current causing all users to look like "New Users".

---

## 4. Verification Plan
- **Flow 1**: Connect wallet -> See modular modal -> Redirect to Security Flow.
- **Flow 2**: Complete Security Flow -> Arrive at (tabs) -> Move app to background for 5+ mins -> Re-open -> Expect Lock Screen.
- **Flow 3**: Force close app -> Re-open -> Expect Lock Screen (skipping welcome/onboarding).
- **Notifications**: Trigger a test notification to verify the `notificationService`.

---

## Phase Execution
1. **Phase 1**: Remove `AsyncStorage.clear()` and implement `SuccessModal`.
2. **Phase 2**: Refactor `securityStore` and build the 4-step Security Flow.
3. **Phase 3**: Implement `AppState` monitoring and Auto-Lock in `RootLayout`.
4. **Phase 4**: Implement `notificationService` and integrate into the flow.
