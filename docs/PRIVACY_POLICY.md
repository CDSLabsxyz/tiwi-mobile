# Privacy Policy

**Application:** TIWI Protocol Mobile App ("TIWI", "the App")
**Publisher:** TIWI Ecosystem, a company registered under the laws of the Federal Republic of Nigeria ("we", "us", "our")
**Support Contact:** info@tiwiprotocol.xyz
**Effective Date:** May 14, 2026
**Last Updated:** May 14, 2026

---

## 1. Introduction

TIWI Ecosystem values your privacy. This Privacy Policy explains what information we and our service providers collect when you use the TIWI Protocol mobile application, how we use it, the legal bases for processing, who we share it with, how long we keep it, the choices you have, and how to contact us.

TIWI is a **non-custodial, self-custodial multi-chain wallet and DeFi interface**. This means your private keys, recovery phrase ("Seed Phrase"), and digital assets remain on your device under your sole control. **We never collect, transmit, or store your Seed Phrase, private keys, or wallet passwords.**

By installing or using the App, you confirm that you have read and understood this Privacy Policy. If you do not agree with this Policy, please do not install or use the App.

This Policy is designed to comply with applicable data protection requirements, including the **Nigeria Data Protection Act, 2023 (NDPA)** and the regulations issued by the **Nigeria Data Protection Commission (NDPC)**, the **EU/UK General Data Protection Regulation (GDPR)**, the **California Consumer Privacy Act (CCPA/CPRA)**, the **Apple App Store** privacy disclosure requirements (including App Privacy "nutrition labels"), and the **Google Play Data Safety** disclosure requirements.

---

## 2. Who We Are (Data Controller)

The data controller responsible for the personal information processed in connection with the App is **TIWI Ecosystem**, a company organized under the laws of the **Federal Republic of Nigeria**. We make the App available to users worldwide and process personal data in line with the Nigeria Data Protection Act, 2023 and other applicable laws described in this Policy.

You can contact us at **info@tiwiprotocol.xyz** with any privacy-related question or request.

---

## 3. Summary of What We Do - and Don't Do

| Category | Status |
|---|---|
| Collect or store your Seed Phrase or private keys | ❌ Never |
| Have access to your funds | ❌ Never |
| Sell your personal information | ❌ Never |
| Use your data for cross-context behavioral advertising | ❌ Never |
| Knowingly collect data from children under 18 | ❌ Never |
| Require account registration, email, name, or KYC to use the wallet | ❌ Not required |
| Collect device metadata (model, OS, IP-based country, language) | ✅ Yes - to operate the App, deliver notifications, and protect against fraud |
| Send your AI prompts to a third-party AI provider when you use the chatbot | ✅ Yes - only when you use the chatbot |
| Store push notification tokens and price-alert preferences on our backend | ✅ Yes - when you opt in to notifications/alerts |

---

## 4. Information We Collect

Because the App is non-custodial, most of your data stays on your device. We collect the categories described below.

### 4.1 Information Stored Locally on Your Device (Never Sent to Us)

The following data is stored **only on your device**, inside secure storage (Apple Keychain / Android Keystore via `expo-secure-store`) or local app storage (AsyncStorage). It does not leave your device unless you explicitly export or back it up yourself:

- Seed Phrase / mnemonic (12-word recovery phrase)
- Private keys for all supported chains (EVM, Solana, TRON, TON, Cosmos, etc.)
- Wallet addresses and derived account data
- App PIN/password (hashed) and biometric authentication settings
- dApp browser history, bookmarks and tabs
- Saved contacts, watchlists, and custom-token configurations
- App preferences (language, theme, currency, notification settings)
- Cached price data, transaction history, and chatbot conversation history

### 4.2 Information We Collect Automatically When You Use the App

When you install and use the App, we (and the service providers listed in Section 7) automatically collect:

- **Device information**: device model, manufacturer, operating system and version, device type (phone/tablet), device language, device identifier (Expo device ID / installation ID), and app version.
- **Network and connection information**: IP address and approximate geolocation derived from your IP address (city and country level only - we do not collect precise GPS location).
- **Session information**: timestamps of app launches, last-active timestamp, and basic session metadata used to power the "Connected Devices" feature so you can see where your wallet has been used.
- **Push notification token**: a token issued by Apple Push Notification Service (APNs), Firebase Cloud Messaging (FCM), or Expo Push that allows us to deliver notifications to your specific device.
- **Wallet addresses you choose to associate with the App backend**: e.g., wallet addresses used to register for price alerts, the referral program, or push notifications. Wallet addresses are **public blockchain identifiers**, not directly personally identifying, but combined with other data they may become identifying.
- **Aggregated, non-personal diagnostic logs**: minimal crash and error logs used for debugging.

We do **not** use third-party analytics SDKs such as Google Analytics, Firebase Analytics, Mixpanel, Amplitude, PostHog, Segment, or Sentry in the App at this time. We do not place advertising identifiers, IDFAs, or tracking pixels, and we do not engage in cross-context behavioral advertising.

### 4.3 Information You Provide to Us Voluntarily

We collect data you choose to provide, including:

- **Referral data**: referral codes you create or apply, and the wallet address associated with your referral identity, so we can attribute referrals and any rewards.
- **Token watchlists and price-alert preferences**: the tokens you watch, the price-change threshold you set, and the cooldown you choose, so we can deliver alerts to your device.
- **Custom tokens you add**: token contract address, chain, symbol, and decimals. This is stored locally and, in some cases, on our backend so it can be re-displayed on your other devices.
- **Chatbot inputs**: text prompts you type, images you upload, and any voice clips you record while using the AI chatbot or voice-to-text feature.
- **Support correspondence**: when you email **info@tiwiprotocol.xyz** or otherwise contact us, we receive your email address, the content of your message, and any information you choose to share.
- **WalletConnect session metadata**: when you connect to an external dApp via WalletConnect/Reown, the metadata of the session (peer dApp name, URL, requested chains and methods) is processed to maintain the connection.

### 4.4 On-Chain (Public Blockchain) Data

Public blockchain data - including your wallet addresses, balances, NFT holdings, transaction history, and any token approvals - is read directly from public block explorers and RPC providers, and from data providers like Moralis. This information is **inherently public and immutable** because it lives on the blockchain. We do not control or store it on our own infrastructure beyond ordinary caching.

### 4.5 Information We Do **Not** Collect

We do not collect:

- your real name, postal address, date of birth, government ID, or KYC documents;
- your bank account, credit card, or other payment instrument details;
- precise GPS location;
- biometric templates - biometric authentication is processed entirely on your device by the operating system, and we never receive your fingerprint or face data;
- the content of your private messages with other users (the App does not include user-to-user messaging);
- contacts from your address book (the App does not request contacts permission);
- health, fitness, or wellness data.

---

## 5. Device Permissions and Why We Request Them

The App requests the following permissions on iOS and/or Android. Each permission is requested only when needed, and you may grant, deny, or revoke any of them in your device settings at any time.

| Permission | Why It Is Used | Required? |
|---|---|---|
| **Camera** | Scan QR codes for wallet addresses, WalletConnect pairing, and dApp linking. | Optional - only when you use QR features. |
| **Microphone (Android RECORD_AUDIO)** | Capture short voice clips for the optional **voice-to-text** input in the AI chatbot. Audio is processed by a third-party speech-to-text service and is not stored by the App. The microphone is **not** used by `expo-camera` on iOS (declared as `microphonePermission: false`). | Optional - only if you use voice input. |
| **Photo Library / Media Library** | Save QR codes, receipts, or chart screenshots you generate; allow you to attach an image to a chatbot question. | Optional - only when you save or upload an image. |
| **Notifications** | Deliver push notifications (price alerts, transaction confirmations, security alerts) and display local notifications. | Optional - you can disable in OS settings. |
| **Biometrics (Face ID / Touch ID / Android Biometric)** | Locally unlock the App, authorize sensitive operations, and protect access to your Seed Phrase. Biometric data never leaves your device. | Optional - you may use a PIN instead. |
| **Clipboard** | Paste wallet addresses, transaction hashes, and referral codes. | Used only on user action. |
| **Background fetch / processing (iOS UIBackgroundModes; Android background tasks)** | Periodically poll for new transactions and price alert triggers so the App can notify you. | Optional - controlled by OS. |
| **Install packages (Android REQUEST_INSTALL_PACKAGES)** | Apply in-app updates delivered via Expo Updates / OTA where required. | Used only on user action. |

We do **not** request: precise location (GPS), contacts, calendar, SMS, call history, or health data.

---

## 6. How We Use Your Information

We use the categories of information described above for the following purposes:

1. **To provide and operate the App** - generate and manage wallets, sign and broadcast transactions, route swaps and bridges via aggregators, display balances, render NFTs and market data.
2. **To deliver push notifications and price alerts** - send a push to your specific device when your subscribed price threshold is hit, a new transaction is detected, or a security event occurs.
3. **To power the AI chatbot** - process your prompt with a third-party AI provider (e.g., Google Gemini) and, where relevant and you have authorized it, enrich the prompt with public market data and a snapshot of your portfolio you choose to share.
4. **To operate the referral program** - generate and validate referral codes, track referrals associated with your wallet address, and credit rewards.
5. **To manage devices and sessions** - show you a list of devices currently connected to your wallet and allow you to revoke them.
6. **To maintain security and integrity** - detect and prevent fraud, abuse, sybil attacks, sanctions evasion, and violations of our Terms of Use.
7. **To comply with legal obligations** - respond to lawful requests from regulators, courts, or law enforcement, and meet our sanctions screening obligations where required.
8. **To improve and debug the App** - fix bugs, monitor stability, and develop new features based on aggregated, non-identifying signals.
9. **To respond to your support requests** - communicate with you when you email us.

---

## 7. Third-Party Services We Use

The App relies on third-party services to function. Each service receives only the data necessary to perform its role. We have selected providers we consider reputable, but we do not control their independent processing. Their privacy policies apply to data they collect.

| Provider | Role | Categories of Data Shared |
|---|---|---|
| **Supabase** (Supabase Inc.) | Backend database for sessions, push tokens, price alert subscriptions, custom tokens, referral records | Wallet address (where applicable), device metadata, push token, IP-derived city/country, app version |
| **Apple Push Notification Service (Apple)** | iOS push delivery | APNs token, notification payload |
| **Firebase Cloud Messaging / Firebase Admin SDK (Google)** | Android push delivery and backend admin tasks | FCM token, notification payload |
| **Expo Push Notifications (Expo / 650 Industries)** | Push delivery relay | Expo push token, notification payload |
| **Expo Updates (Expo / 650 Industries)** | Over-the-air app updates | Device/runtime version, update channel |
| **CoinGecko** | Token price and market data | None (read-only requests; no user identifier sent) |
| **Moralis** | Multi-chain balances, NFT and token metadata | Wallet address (so balances can be returned) |
| **LI.FI** | Cross-chain swap quotes and routing | Source and destination tokens, chain IDs, amounts, wallet address (for quote/order) |
| **Relay Protocol** | Cross-chain quotes and bridging | Source and destination tokens, chain IDs, wallet address |
| **Across Protocol** | Cross-chain bridging | Token, amount, recipient address |
| **Jupiter / native DEXs (Uniswap, PancakeSwap, etc.)** | On-chain swap routing | Public transaction data |
| **WalletConnect / Reown AppKit** | Connect the wallet to external dApps | Public wallet address, session metadata, dApp URL |
| **Google Generative AI (Gemini) via `@google/genai`** | AI chatbot model inference | The text of your prompt, attached images (if any), and contextual data you authorize (e.g., wallet address, portfolio summary, recent messages - up to the last 8 turns) |
| **Speech-to-text service** | Transcribe voice notes in the chatbot | Short base64-encoded audio clip you record |
| **ipapi.co (or equivalent IP-geolocation provider)** | Map IP to approximate city/country for connected-devices listing | IP address |
| **Public blockchain RPC providers / block explorers** | Read and broadcast transactions | Wallet addresses and signed transactions (which are inherently public) |
| **Apple App Store / Google Play** | Distribution and platform services | Governed by Apple's and Google's privacy policies |

We do **not** sell your personal information to any third party, and we do **not** share your personal information for cross-context behavioral advertising.

---

## 8. Legal Bases for Processing

### 8.1 Nigeria (Nigeria Data Protection Act, 2023)

If you are in Nigeria, or if your personal data is otherwise processed under the Nigeria Data Protection Act, 2023 ("NDPA"), we rely on the following lawful bases under Section 25 of the NDPA:

- **Performance of a contract** - to provide the features of the App you request.
- **Legitimate interests** of TIWI Ecosystem - to keep the App secure, prevent fraud and abuse, and improve the service, where these interests are not overridden by your fundamental rights.
- **Compliance with a legal obligation** to which we are subject under Nigerian law - including anti-money-laundering, counter-terrorist-financing, sanctions, and tax obligations.
- **Consent** - for optional processing (such as use of notifications, microphone, camera, photo library, and AI chatbot inputs). You may withdraw consent at any time, without affecting the lawfulness of processing carried out before withdrawal.

### 8.2 EEA / UK / Switzerland (GDPR / UK GDPR)

If you are in the European Economic Area, United Kingdom, or Switzerland, we rely on the following legal bases under Article 6 GDPR:

- **Performance of a contract (Art. 6(1)(b))** - to deliver the features you request (wallet operations, swaps, notifications, chatbot responses, referrals).
- **Legitimate interests (Art. 6(1)(f))** - to maintain security, prevent fraud and abuse, debug the App, and improve the service. Our legitimate interests are balanced against your rights.
- **Compliance with a legal obligation (Art. 6(1)(c))** - to comply with sanctions, anti-money-laundering, tax, and other applicable laws.
- **Consent (Art. 6(1)(a))** - for optional features that require permission (notifications, microphone, camera, media library, AI chatbot inputs). You can withdraw consent at any time without affecting earlier processing.

---

## 9. International Data Transfers

TIWI Ecosystem is based in Nigeria, and our service providers operate globally, including in the United States and the European Union. As a result, personal data we collect may be transferred to, stored in, and processed in countries other than the country in which you reside.

When personal data of **Nigerian data subjects** is transferred outside Nigeria, we rely on the safeguards permitted under **Section 41 of the Nigeria Data Protection Act, 2023** - including transfers to jurisdictions recognised as providing an adequate level of protection, transfers subject to binding agreements that incorporate the protections required by the NDPA, or transfers carried out with your explicit consent.

When personal data of **EEA, UK, or Swiss** data subjects is transferred to a country that does not provide an adequate level of data protection, we rely on appropriate safeguards such as the European Commission's **Standard Contractual Clauses (SCCs)**, the UK International Data Transfer Addendum, and equivalent mechanisms.

---

## 10. Data Retention

We keep personal data only for as long as we need it for the purposes described in this Policy and for legal compliance:

| Data category | Typical retention |
|---|---|
| Push tokens | Until you uninstall the App, disable notifications, or your token becomes invalid (typically within 30–90 days of inactivity). |
| Device session records (for "Connected Devices") | Up to 24 months, or until you revoke the device. |
| Price-alert subscriptions and watchlists | Until you remove them or stop using the App for an extended period (≥ 24 months). |
| Referral records | For the life of the referral program plus any period required to resolve disputes or comply with law. |
| Chatbot conversation history | Stored only on your device. Inference logs at the third-party AI provider follow that provider's retention. |
| Support correspondence | Up to 3 years after your last contact. |
| Logs and minimal diagnostic data | Up to 90 days. |
| Data we are legally required to retain | For the duration required by law. |

When data is no longer needed, we delete it or irreversibly anonymize it.

---

## 11. Security

We take security seriously and use a combination of technical and organizational measures:

- Private keys and Seed Phrases are stored only on your device, inside the operating system's hardware-backed secure storage (Apple Keychain / Android Keystore).
- The App supports an in-app PIN and biometric lock to gate sensitive actions.
- Network communication uses TLS (HTTPS) to encrypt data in transit.
- Backend access is protected by standard authentication and access controls.
- We follow secure software-development practices and review third-party dependencies.

**Limitations.** No security measure is perfect. We cannot guarantee absolute security. **You are responsible for protecting your device, PIN, biometrics, and Seed Phrase.** If you lose your Seed Phrase, your assets cannot be recovered by us. We will never ask you for your Seed Phrase, password, or private key by email, in-app, or otherwise. Anyone who does is attempting to defraud you.

---

## 12. Children's Privacy

The App is **not intended for, directed to, or designed for children under the age of 18**. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal data, please contact us at **info@tiwiprotocol.xyz** and we will delete the data promptly. Parents/guardians who become aware that a child has used the App without permission should also contact us.

---

## 13. Your Rights

Depending on where you live, you have the following rights with respect to your personal data:

### 13.1 Nigeria (NDPA, 2023)

If you are a data subject in Nigeria, you have the following rights under the Nigeria Data Protection Act, 2023:

- **Right to be informed** about the collection and use of your personal data.
- **Right of access** - to request confirmation of, and a copy of, the personal data we hold about you.
- **Right to rectification** - to have inaccurate or incomplete personal data corrected.
- **Right to erasure / deletion**, subject to lawful retention obligations.
- **Right to restriction of processing**.
- **Right to object** to processing, including processing based on our legitimate interests.
- **Right to data portability** - to receive your personal data in a structured, commonly used, machine-readable format.
- **Right to withdraw consent** at any time, where processing is based on your consent.
- **Right not to be subject to a decision based solely on automated processing** that produces legal or similarly significant effects on you.
- **Right to lodge a complaint with the Nigeria Data Protection Commission (NDPC)** if you believe your rights have been infringed.

### 13.2 GDPR / UK GDPR (EEA / UK / Switzerland)

- **Right of access** - request a copy of the personal data we hold about you.
- **Right of rectification** - correct inaccurate or incomplete data.
- **Right of erasure** ("right to be forgotten") - ask us to delete your data, subject to legal retention.
- **Right to restriction of processing**.
- **Right to data portability** - receive your data in a structured, machine-readable format.
- **Right to object** to processing based on legitimate interests.
- **Right to withdraw consent** at any time where processing is based on consent.
- **Right to lodge a complaint** with your local supervisory authority.

### 13.3 California Residents (CCPA / CPRA)

- **Right to know** what categories of personal information we collect, the sources, the purposes, and the categories of third parties we share with.
- **Right to access** the specific pieces of personal information collected about you.
- **Right to delete** personal information, subject to exceptions.
- **Right to correct** inaccurate personal information.
- **Right to opt out** of "sale" or "sharing" - **we do not sell or share personal information for cross-context behavioral advertising**.
- **Right to limit use of sensitive personal information** - we do not use sensitive personal information for purposes that trigger this right.
- **Right not to receive discriminatory treatment** for exercising your rights.

### 13.4 Other Jurisdictions

If you live in a jurisdiction with privacy laws not listed above (such as Brazil's LGPD, Canada's PIPEDA, Australia's Privacy Act, South Africa's POPIA, Kenya's Data Protection Act, or Ghana's Data Protection Act), you may have similar rights. Please contact us to exercise them.

### 13.5 How to Exercise Your Rights

Email us at **info@tiwiprotocol.xyz** with the subject line "Privacy Rights Request" and describe your request. We may need to verify your identity or your control of a particular wallet address (for example, by asking you to sign a short message) before we act. We will respond within the timeframes required by applicable law (typically within 30 days under GDPR and the NDPA, and within 45 days under CCPA, extendable where permitted by law).

You also have the right to authorize an agent to act on your behalf, where permitted by law.

---

## 14. Cookies and Similar Technologies

The App is a native mobile application and does not use browser cookies for its own functionality. However, the **in-app dApp browser** and any web content rendered within the App (for example, third-party dApps you visit) may use cookies, localStorage, IndexedDB, and similar technologies controlled by those websites. Their use is governed by the privacy policies of those third-party sites, not by this Policy.

---

## 15. AI Chatbot - Additional Notice

When you use the AI chatbot, **your prompt** and, where applicable, the **wallet address, portfolio summary, recent conversation context, and any image or voice clip you attach**, are transmitted to a third-party large-language-model provider (currently Google Generative AI / Gemini, and/or fallback providers as configured) for the sole purpose of generating a response.

- Do **not** share your Seed Phrase, private key, password, or other secrets with the chatbot. We will never ask for them, and the chatbot does not need them.
- The chatbot's output is informational only and is not financial, investment, tax, legal, or other professional advice.
- AI providers may retain prompts for their own service-improvement and abuse-prevention purposes, subject to their privacy policies. Please review the relevant provider's policy if this concerns you, and avoid sharing sensitive personal information in chatbot prompts.

---

## 16. Apple App Privacy & Google Play Data Safety Disclosure (Plain-Language Summary)

This section summarizes the disclosures we provide in the App Store and Play Store. It is intended to mirror the platform "nutrition label" / "Data safety" forms.

**Data linked to you (i.e., associated with your identity/device):**

- Identifiers - device ID, installation ID, push token, public wallet address.
- Usage data - feature interaction signals required to operate notifications, alerts, and referrals.
- Diagnostics - crash logs and performance data (minimal).
- User content - text prompts, voice clips, and images you submit to the chatbot.
- Contact info - your email address, only if you write to us at info@tiwiprotocol.xyz.

**Data not linked to you / collected anonymously:**

- IP-derived approximate city/country (used at the time of session creation and not used to track you afterward).
- Aggregated, non-identifying diagnostic counters.

**Data used to track you across apps and websites owned by other companies:** **None.** The App does not include third-party tracking SDKs or advertising identifiers.

**Data sold:** **None.**

---

## 17. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, the App's features, or applicable law. When we do, we will update the "Last Updated" date at the top of this Policy and, where appropriate, notify you through the App. Your continued use of the App after the changes take effect constitutes acceptance of the updated Policy. If you do not agree with the changes, please stop using the App and uninstall it.

---

## 18. How to Contact Us

If you have any questions, requests, or complaints about this Privacy Policy or our handling of your personal data, please contact us:

**TIWI Ecosystem**
*A company organized under the laws of the Federal Republic of Nigeria*
Email: **info@tiwiprotocol.xyz**
Subject line for privacy requests: **"Privacy Rights Request"**

If you are in **Nigeria** and you are not satisfied with our response, you may lodge a complaint with the **Nigeria Data Protection Commission (NDPC)**.

If you are in the **EEA, the UK, or Switzerland** and you are not satisfied with our response, you also have the right to lodge a complaint with your local data protection supervisory authority.

---

*Thank you for trusting TIWI Protocol with your on-chain experience. We are committed to protecting your privacy and to keeping your assets self-custodial, secure, and under your control.*
