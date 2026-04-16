/**
 * Global Translations Dictionary
 * 
 * Ported and optimized from the Tiwi Protocol Web App.
 * Structure: [lang_code] -> [key]
 */

export const TRANSLATIONS: Record<string, Record<string, string>> = {
    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.market': 'Market',
        'nav.swap': 'Swap',
        'nav.earn': 'Earn',
        'nav.wallet': 'Wallet',
        'nav.settings': 'Settings',
        'nav.referral': 'Referral',

        // Settings Main
        'settings.title': 'Settings',
        'settings.account_details': 'Account Details',
        'settings.security': 'Security',
        'settings.connected_devices': 'Connected Devices',
        'settings.language_region': 'Language & Region',
        'settings.notifications': 'Notifications',
        'settings.support': 'Support',
        'settings.add_new_wallet': 'Add New Wallet',
        'settings.import_wallet': 'Import Wallet',
        'settings.app_updates_cache': 'App Updates & Cache',

        // Language & Region Screen
        'locale.title': 'Language & Region',
        'locale.language': 'Application Language',
        'locale.currency': 'Currency Display',
        'locale.format': 'Regional Format',
        'locale.disclaimer': 'Applies language and currency formats across the entire app.',

        // Home Screen
        'home.title': 'Home',
        'home.trade_without_limits': 'Trade Without Limits',
        'home.twc_price': 'TWC Token Price',
        'home.active_chains': 'Active Chains',
        'home.market_cap': 'Market Cap',
        'home.volume_24h': '24h Volume',
        'home.holders': 'Holders',
        'home.total_supply': 'Total Supply',
        'home.just_now': 'Just now',
        'home.minutes_ago': '{{count}}m ago',
        'home.market': 'Market',
        'home.favourite': 'Favourite',
        'home.top': 'Top',
        'home.new': 'New',
        'home.gainers': 'Gainers',
        'home.losers': 'Losers',
        'home.vol': 'Vol',
        'home.view_all': 'View All',
        'home.no_favorites': 'No favorite tokens yet.',
        'home.spotlight': 'Spotlight',
        'home.quick_actions': 'Quick Actions',
        'home.smart_markets': 'Smart Markets',
        'home.stake': 'Stake',
        'home.total_balance': 'Total Balance',
        'home.claimable_rewards': 'Claimable Rewards',

        // Navigation / Wallet Actions
        'nav.send': 'Send',
        'nav.receive': 'Receive',
        'nav.pay': 'Pay',
        'nav.activities': 'Activities',

        // Connected Devices
        'devices.title': 'Connected Devices',
        'devices.info': 'These are the devices currently logged into your TIWI Protocol Wallet. If you notice any unfamiliar activity, terminate the session immediately.',
        'devices.terminate': 'Terminate',
        'devices.terminate_all': 'Terminate All Sessions',
        'devices.terminate_all_desc': 'Signs out every device except the one you\'re using now.',
        'devices.status_active': 'Active',
        'devices.status_terminated': 'Terminated',

        // Buttons / Common
        'common.save': 'Save Changes',
        'common.cancel': 'Cancel',
        'common.apply': 'Apply',
        'common.back': 'Back',
        'common.loading': 'Loading...',

        // Welcome / Login
        'welcome.connect_wallet': 'Connect wallet',
        'welcome.connect_app_wallet': 'Connect in-app wallet',
        'welcome.terms_prefix': 'By continuing, you agree to TIWI\'s',
        'welcome.terms_service': 'Terms of Service',
        'welcome.terms_and': 'and',
        'welcome.privacy_policy': 'Privacy Policy',

        // Lock Screen
        'lock.welcome_back': 'Welcome Back',
        'lock.enter_passcode': 'Enter your passcode to unlock',
        'lock.incorrect': 'Incorrect passcode',
        'lock.biometric_prompt': 'Unlock with Fingerprint',

        // Onboarding
        'onboarding.slide1_title': 'Trade Smarter',
        'onboarding.slide1_desc': 'One tap. Any chain. Best prices guaranteed.',
        'onboarding.slide2_title': 'Pay Like the Future Is Now',
        'onboarding.slide2_desc': 'Send and accept crypto payments instantly',
        'onboarding.slide3_title': 'NFTs Unlocked',
        'onboarding.slide3_desc': 'Mint, trade, and unlock exclusive utilities seamlessly',

        // Referral Screen
        'referral.title': 'Referrals',
        'referral.hero_title': 'Invite Friends, Earn Together',
        'referral.hero_desc': 'Share your link and get 10% of their trading fees. Your friends also get a 5% discount on their first trade!',
        'referral.your_code': 'Your Referral Code',
        'referral.copy_success': 'Referral code copied!',
        'referral.share_msg': 'Join me on TIWI Protocol! Use my code {{code}} to get a 5% discount on your first trade: {{link}}',
        'referral.stats_title': 'Your Stats',
        'referral.total_referrals': 'Total Referrals',
        'referral.earned_rewards': 'Total Earned',
        'referral.rewards_desc': 'Rewards are paid instantly to your wallet in TWC tokens.',
    },
    fr: {
        // Navigation
        'nav.home': 'Accueil',
        'nav.market': 'Marché',
        'nav.swap': 'Échanger',
        'nav.earn': 'Gagner',
        'nav.wallet': 'Portefeuille',
        'nav.settings': 'Paramètres',

        // Settings Main
        'settings.title': 'Paramètres',
        'settings.account_details': 'Détails du compte',
        'settings.security': 'Sécurité',
        'settings.connected_devices': 'Appareils connectés',
        'settings.language_region': 'Langue et région',
        'settings.notifications': 'Notifications',
        'settings.support': 'Support',
        'settings.add_new_wallet': 'Ajouter un portefeuille',
        'settings.import_wallet': 'Importer un portefeuille',
        'settings.app_updates_cache': 'Mises à jour et cache',

        // Home Screen
        'home.title': 'Accueil',
        'home.trade_without_limits': 'Trader Sans Limites',
        'home.twc_price': 'Prix du jeton TWC',
        'home.active_chains': 'Chaînes actives',
        'home.market_cap': 'Cap. boursière',
        'home.volume_24h': 'Volume 24h',
        'home.holders': 'Détenteurs',
        'home.total_supply': 'Offre totale',
        'home.just_now': 'À l\'instant',
        'home.minutes_ago': 'Il y a {{count}}m',
        'home.market': 'Marché',
        'home.favourite': 'Favoris',
        'home.top': 'Top',
        'home.new': 'Nouveau',
        'home.gainers': 'Gagnants',
        'home.losers': 'Perdants',
        'home.vol': 'Vol.',
        'home.view_all': 'Voir tout',
        'home.no_favorites': 'Aucun jeton favori.',
        'home.spotlight': 'À la une',
        'home.quick_actions': 'Actions rapides',
        'home.smart_markets': 'Marchés intelligents',
        'home.stake': 'Staker',
        'home.total_balance': 'Solde total',
        'home.claimable_rewards': 'Récompenses récupérables',

        // Navigation / Wallet Actions
        'nav.send': 'Envoyer',
        'nav.receive': 'Recevoir',
        'nav.pay': 'Payer',
        'nav.activities': 'Activités',

        // Common
        'common.save': 'Enregistrer',
        'common.cancel': 'Annuler',
        'common.apply': 'Appliquer',
        'common.back': 'Retour',
        'common.loading': 'Chargement...',

        // Welcome
        'welcome.connect_wallet': 'Connecter portefeuille',
        'welcome.connect_app_wallet': 'Connecter portefeuille in-app',
        'welcome.terms_prefix': 'En continuant, vous acceptez les',
        'welcome.terms_service': 'Conditions d\'utilisation',
        'welcome.terms_and': 'et la',
        'welcome.privacy_policy': 'Politique de confidentialité',

        // Lock
        'lock.welcome_back': 'Bon retour',
        'lock.enter_passcode': 'Entrez votre code pour déverrouiller',
        'lock.incorrect': 'Code incorrect',
        'lock.biometric_prompt': 'Déverrouiller avec empreinte',

        // Onboarding
        'onboarding.slide1_title': 'Tradez plus intelligemment',
        'onboarding.slide1_desc': 'Un clic. N\'importe quelle chaîne. Meilleurs prix garantis.',
        'onboarding.slide2_title': 'Payez comme si le futur était maintenant',
        'onboarding.slide2_desc': 'Envoyez et acceptez des paiements crypto instantanément',
        'onboarding.slide3_title': 'NFT débloqués',
        'onboarding.slide3_desc': 'Créez, échangez et débloquez des utilités exclusives en toute fluidité.',
    },
    yo: {
        'nav.home': 'Ile',
        'nav.market': 'Ojà',
        'nav.swap': 'Paṣípàrọ̀',
        'nav.earn': 'Gba Èrè',
        'nav.wallet': 'Àpò Owó',
        'nav.settings': 'Ètò',
        'settings.title': 'Ètò App',
        'home.title': 'Ile',
        'home.trade_without_limits': 'Ṣe òwò láìsí ààlà',
        'home.total_balance': 'Gbogbo Owó',
        'nav.send': 'Fi Ránṣẹ́',
        'nav.receive': 'Gba Wọlé',
        'common.save': 'Fi pamọ́',
        'common.cancel': 'Fagilé',

        // Welcome
        'welcome.connect_wallet': 'Sopọ àpò owó',
        'welcome.terms_prefix': 'Síbẹ̀síbẹ̀, o gbà sí TIWI',

        // Onboarding
        'onboarding.slide1_title': 'Òwò tó mọ́gbọ́n dání',
    }
};

export type TranslationKey = keyof typeof TRANSLATIONS.en;
