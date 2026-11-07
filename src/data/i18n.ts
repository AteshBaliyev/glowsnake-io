import { LanguageCode, RarityTier } from '@/types/game';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycan' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

export const RARITY_LABELS: Record<RarityTier, Record<LanguageCode, string>> = {
  common: {
    en: 'Common',
    az: 'Adi',
    tr: 'Sıradan',
    ru: 'Обычный',
  },
  rare: {
    en: 'Rare',
    az: 'Nadir',
    tr: 'Nadir',
    ru: 'Редкий',
  },
  epic: {
    en: 'Epic',
    az: 'Epik',
    tr: 'Epik',
    ru: 'Эпический',
  },
  legendary: {
    en: 'Legendary',
    az: 'Əfsanəvi',
    tr: 'Efsanevi',
    ru: 'Легендарный',
  },
  mythic: {
    en: 'Mythic',
    az: 'Mifik',
    tr: 'Mitik',
    ru: 'Мифический',
  },
  divine: {
    en: 'Divine',
    az: 'İlahi',
    tr: 'İlahi',
    ru: 'Божественный',
  },
};

export interface UITranslations {
  nicknamePlaceholder: string;
  enterNameWarning: string;
  offline: string;
  online: string;
  play: string;
  highScore: string;
  lastScore: string;
  level: string;
  snakes: string;
  themes: string;
  achievements: string;
  settings: string;
  language: string;
  soundEffects: string;
  soundOn: string;
  soundOff: string;
  serverUrlLabel: string;
  firebaseUrlLabel: string;
  close: string;
  select: string;
  selected: string;
  equip: string;
  equipped: string;
  previewLabel: string;
  unlocksAtLevel: string;
  lockedLevel: string;
  unlockedCount: string;
  ability: string;
  cooldown: string;
  leaderboard: string;
  score: string;
  collectedScore: string;
  length: string;
  kills: string;
  rank: string;
  players: string;
  serverRoom: string;
  exit: string;
  ready: string;
  boost: string;
  skill: string;
  switchOffline: string;
  connectionFailed: string;
  connectingOnline: string;
  internetRequired: string;
  onlineRegion: string;
  gameOver: string;
  timePlayed: string;
  bestRank: string;
  xpEarned: string;
  levelUp: string;
  newRecord: string;
  newAchievementUnlocked: string;
  playAgain: string;
  mainMenu: string;
  unlockedBadge: string;
  lockedBadge: string;
  newBadge: string;
  authorCredit: string;
  controlArrowMode: string;
  controlClassicMode: string;
  controlJoystickMode: string;
  controlLayoutLeft: string;
  controlLayoutRight: string;
  autoRotateLabel: string;
  showPlayerNames: string;
  fadeMyName: string;
  bestGraphics: string;
  wigglingFood: string;
  mapOnTop: string;
  doubleTapToBoost: string;
  lookAhead: string;
  newMusic: string;
  newSounds: string;
  privacyPolicy: string;
  privacyTitle: string;
  privacyBody: string;
  ok: string;
  reviveWithAd: string;
  continueWhereLeft: string;
  getFreeCoins: string;
  adLoading: string;
  adNotReady: string;
  adRewardSuccess: string;
}

export const UI_TEXT: Record<LanguageCode, UITranslations> = {
  en: {
    nicknamePlaceholder: 'Enter nickname...',
    enterNameWarning: 'Please enter a nickname',
    offline: 'Offline',
    online: 'Online',
    play: 'PLAY',
    highScore: 'Best Score',
    lastScore: 'Last',
    level: 'Level',
    snakes: 'Snakes',
    themes: 'Themes',
    achievements: 'Achievements',
    settings: 'Settings',
    language: 'Language',
    soundEffects: 'Sound effects',
    soundOn: 'On',
    soundOff: 'Off',
    serverUrlLabel: 'Server URL (optional)',
    firebaseUrlLabel: 'Firebase DB URL (optional)',
    close: 'Close',
    select: 'Select',
    selected: 'Selected',
    equip: 'Use Snake',
    equipped: 'Selected',
    previewLabel: 'Live Preview',
    unlocksAtLevel: 'Unlocks at Level',
    lockedLevel: 'Lvl',
    unlockedCount: 'Unlocked',
    ability: 'Ability',
    cooldown: 'Cooldown',
    leaderboard: 'Leaderboard',
    score: 'Score',
    collectedScore: 'Score Collected',
    length: 'Length',
    kills: 'Kills',
    rank: 'Rank',
    players: 'Players',
    serverRoom: 'Server',
    exit: 'Exit',
    ready: 'Ready',
    boost: 'Boost',
    skill: 'Skill',
    switchOffline: 'Play Offline',
    connectionFailed: 'Could not connect to server',
    connectingOnline: 'Connecting to Global Arena...',
    internetRequired: 'Internet connection required to enter Online Arena!',
    onlineRegion: 'Frankfurt #1 (EU)',
    gameOver: 'Match Summary',
    timePlayed: 'Time Played',
    bestRank: 'Best Rank',
    xpEarned: 'XP Earned',
    levelUp: 'Level Up!',
    newRecord: 'New High Score!',
    newAchievementUnlocked: 'New Achievement Unlocked!',
    playAgain: 'Play Again',
    mainMenu: 'Main Menu',
    unlockedBadge: 'Unlocked',
    lockedBadge: 'Locked',
    newBadge: 'NEW',
    authorCredit: 'Creator: Atəş Balıyev | Created by Baliyews Studio',
    controlArrowMode: 'Arrow mode (recommended!)',
    controlClassicMode: 'Classic mode',
    controlJoystickMode: 'Joystick mode',
    controlLayoutLeft: 'Left-handed controls',
    controlLayoutRight: 'Right-handed controls',
    autoRotateLabel: 'Auto-rotate / Orientation',
    showPlayerNames: 'Show player names',
    fadeMyName: 'Fade my name',
    bestGraphics: 'Best graphics',
    wigglingFood: 'Wiggling food',
    mapOnTop: 'Map on top',
    doubleTapToBoost: 'Double tap to boost',
    lookAhead: 'Look ahead',
    newMusic: 'New music',
    newSounds: 'New sounds',
    privacyPolicy: 'Privacy Policy',
    privacyTitle: 'Privacy Policy — GlowSnake.io',
    privacyBody:
      'GlowSnake.io was created by Atəş Balıyev (Baliyews Studio). The game does not collect, store, or sell any personal data. All player stats, unlocked snakes, high scores, levels, and preferences are stored exclusively on your device via local browser storage. In multiplayer mode, only your chosen nickname and gameplay coordinates are synced in real-time.',
    ok: 'OK',
    reviveWithAd: 'Watch Ad to Revive (Keep Score)',
    continueWhereLeft: 'Continue where you left off',
    getFreeCoins: 'Watch Ad (+150 XP / Coins)',
    adLoading: 'Loading Ad...',
    adNotReady: 'Ad is loading, please try again in a moment.',
    adRewardSuccess: 'Reward granted! +150 XP',
  },
  az: {
    nicknamePlaceholder: 'Ləqəb daxil edin...',
    enterNameWarning: 'Zəhmət olmasa ləqəb daxil edin',
    offline: 'Oflayn',
    online: 'Onlayn',
    play: 'OYNA',
    highScore: 'Rekord',
    lastScore: 'Son',
    level: 'Səviyyə',
    snakes: 'İlanlar',
    themes: 'Tema',
    achievements: 'Nailiyyətlər',
    settings: 'Ayarlar',
    language: 'Dil',
    soundEffects: 'Səs effektləri',
    soundOn: 'Açıq',
    soundOff: 'Bağlı',
    serverUrlLabel: 'Server URL (istəyə bağlı)',
    firebaseUrlLabel: 'Firebase DB URL (istəyə bağlı)',
    close: 'Bağla',
    select: 'Seç',
    selected: 'Seçilib',
    equip: 'İlanı Seç',
    equipped: 'Seçilib',
    previewLabel: 'Görünüş Önizləməsi',
    unlocksAtLevel: 'Açılacaq səviyyə:',
    lockedLevel: 'Səv',
    unlockedCount: 'Açıq ilanlar',
    ability: 'Bacarıq',
    cooldown: 'Gözləmə',
    leaderboard: 'Liderlər',
    score: 'Xal',
    collectedScore: 'Yığılan Xal',
    length: 'Uzunluq',
    kills: 'Məhv',
    rank: 'Sıra',
    players: 'Oyunçu',
    serverRoom: 'Server',
    exit: 'Çıxış',
    ready: 'Hazır',
    boost: 'Sürət',
    skill: 'Güc',
    switchOffline: 'Oflayn oyna',
    connectionFailed: 'Serverlə bağlantı qurulmadı',
    connectingOnline: 'Qlobal Arenaya qoşulur...',
    internetRequired: 'Onlayn arenaya daxil olmaq üçün internet bağlantısı tələb olunur!',
    onlineRegion: 'Frankfurt #1 (EU)',
    gameOver: 'Oyun Nəticəsi',
    timePlayed: 'Oynanılan Müddət',
    bestRank: 'Ən Yaxşı Sıra',
    xpEarned: 'Qazanılan XP',
    levelUp: 'Yeni Səviyyə!',
    newRecord: 'Yeni Rekord!',
    newAchievementUnlocked: 'Yeni Nailiyyət Açıldı!',
    playAgain: 'Yenidən Oyna',
    mainMenu: 'Başlanğıc Ekranı',
    unlockedBadge: 'Açıq',
    lockedBadge: 'Qapalı',
    newBadge: 'YENİ',
    authorCredit: 'Yaradıcı: Atəş Balıyev | Baliyews Studio tərəfindən yaradılmışdır',
    controlArrowMode: 'Ox rejimi (tövsiyə olunur!)',
    controlClassicMode: 'Klassik rejim',
    controlJoystickMode: 'Coystik rejimi',
    controlLayoutLeft: 'Sol əl idarəetməsi',
    controlLayoutRight: 'Sağ əl idarəetməsi',
    autoRotateLabel: 'Avto-fırlanma / Orientasiya',
    showPlayerNames: 'Oyunçu adlarını göstər',
    fadeMyName: 'Öz adımı şəffaflaşdır',
    bestGraphics: 'Yüksək qrafika',
    wigglingFood: 'Tərpənən yemlər',
    mapOnTop: 'Xəritə yuxarıda',
    doubleTapToBoost: 'Sürət üçün cüt toxunma',
    lookAhead: 'İrəlini gör',
    newMusic: 'Yeni musiqi',
    newSounds: 'Yeni səslər',
    privacyPolicy: 'Məxfilik Siyasəti',
    privacyTitle: 'Məxfilik Siyasəti — GlowSnake.io',
    privacyBody:
      'GlowSnake.io oyunu Atəş Balıyev (Baliyews Studio) tərəfindən yaradılmışdır. Oyun heç bir fərdi məlumatı toplamır, saxlamır və paylaşmır. Oyun statistikaları, qazanılan xallar, səviyyələr və ayarlar yalnız sizin cihazınızın lokal yaddaşında saxlanılır. Onlayn rejimdə yalnız daxil etdiyiniz ləqəb və oyun koordinatları ötürülür.',
    ok: 'OK',
    reviveWithAd: 'Reklama baxaraq Diril (Xalını Qoru)',
    continueWhereLeft: 'Qaldığın yerdən davam et',
    getFreeCoins: 'Reklam izlə (+150 XP / Coin Qazan)',
    adLoading: 'Reklam açılır...',
    adNotReady: 'Reklam yüklənir, zəhmət olmasa bir neçə saniyə sonra yenidən cəhd edin.',
    adRewardSuccess: 'Mükafat qazanıldı! +150 XP',
  },
  tr: {
    nicknamePlaceholder: 'Takma ad girin...',
    enterNameWarning: 'Lütfen bir takma ad girin',
    offline: 'Çevrimdışı',
    online: 'Çevrimiçi',
    play: 'OYNA',
    highScore: 'Rekor',
    lastScore: 'Son',
    level: 'Seviye',
    snakes: 'Yılanlar',
    themes: 'Tema',
    achievements: 'Başarımlar',
    settings: 'Ayarlar',
    language: 'Dil',
    soundEffects: 'Ses efektleri',
    soundOn: 'Açık',
    soundOff: 'Kapalı',
    serverUrlLabel: 'Sunucu URL (isteğe bağlı)',
    firebaseUrlLabel: 'Firebase DB URL (isteğe bağlı)',
    close: 'Kapat',
    select: 'Seç',
    selected: 'Seçildi',
    equip: 'Yılanı Seç',
    equipped: 'Seçildi',
    previewLabel: 'Görünüm Önizleme',
    unlocksAtLevel: 'Açılacağı Seviye:',
    lockedLevel: 'Sv',
    unlockedCount: 'Açık yılanlar',
    ability: 'Yetenek',
    cooldown: 'Bekleme',
    leaderboard: 'Liderler',
    score: 'Skor',
    collectedScore: 'Toplanan Skor',
    length: 'Uzunluk',
    kills: 'Av',
    rank: 'Sıra',
    players: 'Oyuncu',
    serverRoom: 'Sunucu',
    exit: 'Çıkış',
    ready: 'Hazır',
    boost: 'Hız',
    skill: 'Güç',
    switchOffline: 'Çevrimdışı oyna',
    connectionFailed: 'Sunucuya bağlanılamadı',
    connectingOnline: 'Küresel Arenaya bağlanıyor...',
    internetRequired: 'Çevrimiçi arenaya girmek için internet bağlantısı gereklidir!',
    onlineRegion: 'Frankfurt #1 (EU)',
    gameOver: 'Oyun Özeti',
    timePlayed: 'Oynanan Süre',
    bestRank: 'En İyi Sıra',
    xpEarned: 'Kazanılan XP',
    levelUp: 'Seviye Atladın!',
    newRecord: 'Yeni Rekor!',
    newAchievementUnlocked: 'Yeni Başarım Açıldı!',
    playAgain: 'Tekrar Oyna',
    mainMenu: 'Ana Ekran',
    unlockedBadge: 'Açık',
    lockedBadge: 'Kilitli',
    newBadge: 'YENİ',
    authorCredit: 'Yapımcı: Atəş Balıyev | Baliyews Studio tarafından geliştirilmiştir',
    controlArrowMode: 'Ok modu (önerilen!)',
    controlClassicMode: 'Klasik mod',
    controlJoystickMode: 'Joystick modu',
    controlLayoutLeft: 'Sol el kontrolleri',
    controlLayoutRight: 'Sağ el kontrolleri',
    autoRotateLabel: 'Otomatik döndürme / Yönlendirme',
    showPlayerNames: 'Oyuncu isimlerini göster',
    fadeMyName: 'Kendi adımı soluklaştır',
    bestGraphics: 'En iyi grafikler',
    wigglingFood: 'Kıpırdayan yemler',
    mapOnTop: 'Harita üstte',
    doubleTapToBoost: 'Hızlanmak için çift dokun',
    lookAhead: 'İleriye bakış',
    newMusic: 'Yeni müzik',
    newSounds: 'Yeni sesler',
    privacyPolicy: 'Gizlilik Politikası',
    privacyTitle: 'Gizlilik Politikası — GlowSnake.io',
    privacyBody:
      'GlowSnake.io, Atəş Balıyev (Baliyews Studio) tarafından geliştirilmiştir. Oyun hiçbir kişisel veriyi toplamaz, saklamaz veya satmaz. Tüm istatistikler, açılan yılanlar, seviyeler ve tercihler yalnızca cihazınızın tarayıcı belleğinde saklanır.',
    ok: 'OK',
    reviveWithAd: 'Reklam İzleyerek Canlan (Skorunu Koru)',
    continueWhereLeft: 'Kaldığın yerden devam et',
    getFreeCoins: 'Reklam İzle (+150 XP / Coin Kazan)',
    adLoading: 'Reklam açılıyor...',
    adNotReady: 'Reklam yükleniyor, lütfen birkaç saniye sonra tekrar deneyin.',
    adRewardSuccess: 'Ödül kazanıldı! +150 XP',
  },
  ru: {
    nicknamePlaceholder: 'Введите никнейм...',
    enterNameWarning: 'Пожалуйста, введите никнейм',
    offline: 'Офлайн',
    online: 'Онлайн',
    play: 'ИГРАТЬ',
    highScore: 'Рекорд',
    lastScore: 'Прошлый',
    level: 'Уровень',
    snakes: 'Змеи',
    themes: 'Темы',
    achievements: 'Достижения',
    settings: 'Настройки',
    language: 'Язык',
    soundEffects: 'Звуковые эффекты',
    soundOn: 'Вкл',
    soundOff: 'Выкл',
    serverUrlLabel: 'URL сервера (необязательно)',
    firebaseUrlLabel: 'URL Firebase БД (необязательно)',
    close: 'Закрыть',
    select: 'Выбрать',
    selected: 'Выбрано',
    equip: 'Выбрать Змею',
    equipped: 'Выбрано',
    previewLabel: 'Предпросмотр',
    unlocksAtLevel: 'Откроется на уровне:',
    lockedLevel: 'Ур',
    unlockedCount: 'Открыто',
    ability: 'Навык',
    cooldown: 'Перезарядка',
    leaderboard: 'Лидеры',
    score: 'Счёт',
    collectedScore: 'Набранный счёт',
    length: 'Длина',
    kills: 'Победы',
    rank: 'Место',
    players: 'Игроков',
    serverRoom: 'Сервер',
    exit: 'Выход',
    ready: 'Готово',
    boost: 'Рывок',
    skill: 'Навык',
    switchOffline: 'Играть офлайн',
    connectionFailed: 'Не удалось подключиться к серверу',
    connectingOnline: 'Подключение к глобальной арене...',
    internetRequired: 'Для входа на онлайн-арену требуется подключение к интернету!',
    onlineRegion: 'Франкфурт #1 (EU)',
    gameOver: 'Итоги Игры',
    timePlayed: 'Время в игре',
    bestRank: 'Лучшее место',
    xpEarned: 'Получено XP',
    levelUp: 'Новый уровень!',
    newRecord: 'Новый рекорд!',
    newAchievementUnlocked: 'Открыто достижение!',
    playAgain: 'Играть снова',
    mainMenu: 'Главное меню',
    unlockedBadge: 'Открыто',
    lockedBadge: 'Закрыто',
    newBadge: 'НОВОЕ',
    authorCredit: 'Создатель: Атеш Балыев | Разработано Baliyews Studio',
    controlArrowMode: 'Режим стрелок (рекомендуется!)',
    controlClassicMode: 'Классический режим',
    controlJoystickMode: 'Режим джойстика',
    controlLayoutLeft: 'Управление левой рукой',
    controlLayoutRight: 'Управление правой рукой',
    autoRotateLabel: 'Автоповорот / Ориентация',
    showPlayerNames: 'Показывать имена игроков',
    fadeMyName: 'Скрывать свое имя',
    bestGraphics: 'Лучшая графика',
    wigglingFood: 'Анимированная еда',
    mapOnTop: 'Карта сверху',
    doubleTapToBoost: 'Двойное нажатие для ускорения',
    lookAhead: 'Взгляд вперед',
    newMusic: 'Новая музыка',
    newSounds: 'Новые звуки',
    privacyPolicy: 'Политика конфиденциальности',
    privacyTitle: 'Политика конфиденциальности — GlowSnake.io',
    privacyBody:
      'GlowSnake.io создана Атешем Балыевым (Baliyews Studio). Игра не собирает и не передает персональные данные. Все достижения, рекорды и настройки хранятся исключительно локально на вашем устройстве.',
    ok: 'OK',
    reviveWithAd: 'Возродиться за рекламу (Сохранить счет)',
    continueWhereLeft: 'Продолжить с места гибели',
    getFreeCoins: 'Смотреть рекламу (+150 XP / Монет)',
    adLoading: 'Загрузка рекламы...',
    adNotReady: 'Реклама загружается, попробуйте через пару секунд.',
    adRewardSuccess: 'Награда получена! +150 XP',
  },
};
