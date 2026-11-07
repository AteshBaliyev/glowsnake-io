import {
  AbilityId,
  LocalizedText,
  RarityTier,
  SnakeAbilitySpec,
  SnakeTypeSpec,
} from '@/types/game';

interface AbilityTemplate {
  id: AbilityId;
  name: LocalizedText;
  desc: (dur: number) => LocalizedText;
  baseCd: number;
  baseDur: number;
  badgeColor: string;
}

const ABILITY_TEMPLATES: Record<AbilityId, AbilityTemplate> = {
  // ---- Common ----
  quick_dash: {
    id: 'quick_dash',
    name: { en: 'Quick Dash', az: 'Sürətli Atılış', tr: 'Hızlı Atılma', ru: 'Быстрый Рывок' },
    desc: (d) => ({
      en: `Bursts forward for ${d}s without spending score.`,
      az: `Xal itirmədən ${d} saniyə irəli sürətlənir.`,
      tr: `Skor harcamadan ${d} saniye ileri hızlanır.`,
      ru: `Ускоряется на ${d} сек без потери очков.`,
    }),
    baseCd: 10.5,
    baseDur: 2.5,
    badgeColor: '#3b82f6',
  },
  venom_trail: {
    id: 'venom_trail',
    name: { en: 'Venom Drops', az: 'Zəhər Damcıları', tr: 'Zehir Damlası', ru: 'Ядовитый След' },
    desc: (d) => ({
      en: `Leaves toxic drops for ${d}s that slow pursuers.`,
      az: `${d} saniyə arxada rəqibləri yavaşladan zəhər buraxır.`,
      tr: `${d} saniye arkada rakipleri yavaşlatan zehir bırakır.`,
      ru: `Оставляет позади капли яда на ${d} сек.`,
    }),
    baseCd: 11,
    baseDur: 4.0,
    badgeColor: '#22c55e',
  },
  food_magnet: {
    id: 'food_magnet',
    name: { en: 'Food Magnet', az: 'Yem Maqniti', tr: 'Yem Mıknatısı', ru: 'Магнит Еды' },
    desc: (d) => ({
      en: `Attracts nearby food pellets for ${d}s.`,
      az: `${d} saniyə ətrafdakı yemləri özünə çəkir.`,
      tr: `${d} saniye yakındaki yemleri kendine çeker.`,
      ru: `Притягивает ближайшую еду в течение ${d} сек.`,
    }),
    baseCd: 12,
    baseDur: 4.5,
    badgeColor: '#f43f5e',
  },
  armor_shield: {
    id: 'armor_shield',
    name: { en: 'Iron Guard', az: 'Dəmir Qalxan', tr: 'Demir Kalkan', ru: 'Стальной Щит' },
    desc: (d) => ({
      en: `Protects from fatal collisions for ${d}s.`,
      az: `${d} saniyə ölümcül toqquşmadan qoruyur.`,
      tr: `${d} saniye ölümcül çarpışmalardan korur.`,
      ru: `Защищает от столкновений на ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 2.8,
    badgeColor: '#94a3b8',
  },
  score_boost_15: {
    id: 'score_boost_15',
    name: { en: 'Golden Appetite', az: 'Qızıl İştaha (2x)', tr: 'Altın İştah (2x)', ru: 'Золотой Аппетит' },
    desc: (d) => ({
      en: `Doubles score gained from food for ${d}s.`,
      az: `${d} saniyə yeyilən yemlərdən 2 qat xal verir.`,
      tr: `${d} saniye yenilen yemlerden 2 kat skor verir.`,
      ru: `Удваивает очки за еду на ${d} сек.`,
    }),
    baseCd: 13,
    baseDur: 5.0,
    badgeColor: '#f59e0b',
  },
  frost_chill: {
    id: 'frost_chill',
    name: { en: 'Frost Pulse', az: 'Buz Dalğası', tr: 'Buz Dalgası', ru: 'Ледяной Импульс' },
    desc: (d) => ({
      en: `Chills nearby rivals and slows their movement for ${d}s.`,
      az: `Yaxındakı rəqibləri ${d} saniyə dondurub yavaşladır.`,
      tr: `Yakındaki rakipleri ${d} saniye yavaşlatır.`,
      ru: `Замораживает и замедляет врагов рядом на ${d} сек.`,
    }),
    baseCd: 12,
    baseDur: 3.2,
    badgeColor: '#06b6d4',
  },

  // ---- Rare ----
  ghost_phase: {
    id: 'ghost_phase',
    name: { en: 'Spectral Phase', az: 'Ruh Keçidi', tr: 'Hayalet Geçişi', ru: 'Фаза Призрака' },
    desc: (d) => ({
      en: `Pass safely right through rival snakes for ${d}s.`,
      az: `${d} saniyə rəqib ilanların içindən maneəsiz keçir.`,
      tr: `${d} saniye rakip yılanların içinden geçer.`,
      ru: `Позволяет проходить сквозь змей на ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 3.2,
    badgeColor: '#38bdf8',
  },
  ember_trail: {
    id: 'ember_trail',
    name: { en: 'Ember Sparks', az: 'Alov Qığılcımı', tr: 'Ateş Kıvılcımı', ru: 'Огненный След' },
    desc: (d) => ({
      en: `Fires burning fireballs from tail for ${d}s.`,
      az: `${d} saniyə quyruqdan yandırıcı alov şarları atır.`,
      tr: `${d} saniye kuyruktan yakıcı ateş topları fırlatır.`,
      ru: `Выпускает огненные шары из хвоста на ${d} сек.`,
    }),
    baseCd: 12,
    baseDur: 4.2,
    badgeColor: '#ea580c',
  },
  time_shift: {
    id: 'time_shift',
    name: { en: 'Reflex Warp', az: 'Zaman Əyilməsi', tr: 'Zaman Bükümü', ru: 'Сдвиг Времени' },
    desc: (d) => ({
      en: `Slows nearby snakes while sharpening your turn rate for ${d}s.`,
      az: `Ətrafdakıları yavaşladır və manevrini ${d}s kəskinləşdirir.`,
      tr: `Çevreyi yavaşlatır ve dönüş hızını ${d}s artırır.`,
      ru: `Замедляет врагов вокруг и ускоряет повороты на ${d} сек.`,
    }),
    baseCd: 13,
    baseDur: 3.8,
    badgeColor: '#818cf8',
  },
  forward_blink: {
    id: 'forward_blink',
    name: { en: 'Warp Blink', az: 'İrəli Sıçrayış', tr: 'İleri Işınlanma', ru: 'Телепорт Вперёд' },
    desc: () => ({
      en: 'Instantly teleports forward through danger traps.',
      az: 'Tələlərin üzərindən ani olaraq irəli ışınlanır.',
      tr: 'Tuzakların üzerinden anında ileri ışınlanır.',
      ru: 'Мгновенно телепортирует вперёд сквозь преграды.',
    }),
    baseCd: 11,
    baseDur: 0.8,
    badgeColor: '#a855f7',
  },
  score_drain: {
    id: 'score_drain',
    name: { en: 'Siphon Aura', az: 'Xal Sorucu', tr: 'Skor Sömürücü', ru: 'Поглощение Очков' },
    desc: (d) => ({
      en: `Siphons score directly from nearby rivals for ${d}s.`,
      az: `${d} saniyə yaxındakı rəqiblərdən xal çəkir.`,
      tr: `${d} saniye yakındaki rakiplerden skor çeker.`,
      ru: `Вытягивает очки у ближайших соперников ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 4.0,
    badgeColor: '#ec4899',
  },
  shock_push: {
    id: 'shock_push',
    name: { en: 'Shockwave', az: 'Şok Dalğası', tr: 'Şok Dalgası', ru: 'Ударная Волна' },
    desc: () => ({
      en: 'Blasts nearby enemies outward with heavy knockback.',
      az: 'Yaxınlaşan rəqibləri güclü zərbə ilə kənara atır.',
      tr: 'Yaklaşan rakipleri güçlü darbeyle uzağa iter.',
      ru: 'Отбрасывает ближайших соперников ударной волной.',
    }),
    baseCd: 11.5,
    baseDur: 1.5,
    badgeColor: '#38bdf8',
  },
  eagle_vision: {
    id: 'eagle_vision',
    name: { en: 'Eagle Sight', az: 'Qartal Baxışı', tr: 'Kartal Görüşü', ru: 'Орлиный Взор' },
    desc: (d) => ({
      en: `Expands arena camera zoom and boosts agility for ${d}s.`,
      az: `${d} saniyə xəritə görmə bucağını və çevikliyi artırır.`,
      tr: `${d} saniye görüş açısını ve çevikliği artırır.`,
      ru: `Расширяет обзор арены и манёвренность на ${d} сек.`,
    }),
    baseCd: 12,
    baseDur: 5.5,
    badgeColor: '#fbbf24',
  },

  // ---- Epic / Mystic ----
  decoy_clone: {
    id: 'decoy_clone',
    name: { en: 'Shadow Decoy', az: 'Kölgə Klonu', tr: 'Gölge Klonu', ru: 'Теневой Клон' },
    desc: (d) => ({
      en: `Turns stealthy and launches a live decoy snake for ${d}s.`,
      az: `Görünməz olur və irəli saxta klon ilan göndərir (${d}s).`,
      tr: `Görünmez olur ve ileri sahte klon yılan salar (${d}s).`,
      ru: `Даёт невидимость и выпускает змею-приманку на ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 3.8,
    badgeColor: '#a855f7',
  },
  gravity_vortex: {
    id: 'gravity_vortex',
    name: { en: 'Gravity Well', az: 'Qravitasiya Burulğanı', tr: 'Çekim Girdabı', ru: 'Грави-Вихрь' },
    desc: (d) => ({
      en: `Deploys a dark vortex for ${d}s pulling rivals & orbs.`,
      az: `${d} saniyə rəqibləri və yemləri çəkən burulğan yaradır.`,
      tr: `${d} saniye rakipleri ve yemleri çeken girdap açar.`,
      ru: `Создаёт вихрь на ${d} сек, затягивающий врагов и еду.`,
    }),
    baseCd: 14,
    baseDur: 4.2,
    badgeColor: '#9333ea',
  },
  slice_wave: {
    id: 'slice_wave',
    name: { en: 'Plasma Cutter', az: 'Plazma Kəsici', tr: 'Plazma Kesici', ru: 'Плазменный Резак' },
    desc: () => ({
      en: 'Fires a high-speed energy crescent that cuts 25% rival score.',
      az: 'Rəqibin xalının 25%-ni kəsən sürətli enerji dalğası atır.',
      tr: 'Rakibin skorunun %25’ini kesen enerji dalgası fırlatır.',
      ru: 'Выпускает волну, срезающую 25% очков врага.',
    }),
    baseCd: 10.5,
    baseDur: 1.5,
    badgeColor: '#10b981',
  },
  bio_regen: {
    id: 'bio_regen',
    name: { en: 'Bio Surge', az: 'Bio-Böyümə', tr: 'Biyo-Büyüme', ru: 'Био-Рост' },
    desc: (d) => ({
      en: `Generates passive score & free boost speed for ${d}s.`,
      az: `${d} saniyə pulsuz sürət və avtomatik xal artımı verir.`,
      tr: `${d} saniye ücretsiz hız ve otomatik skor artışı sağlar.`,
      ru: `Даёт бесплатное ускорение и рост очков на ${d} сек.`,
    }),
    baseCd: 13,
    baseDur: 4.5,
    badgeColor: '#4ade80',
  },
  star_harvest: {
    id: 'star_harvest',
    name: { en: 'Star Alchemy', az: 'Ulduz Kimyası', tr: 'Yıldız Simyası', ru: 'Звёздная Жатва' },
    desc: (d) => ({
      en: `Turns nearby pellets into high-value stars + ${d}s magnet.`,
      az: `Ətrafdakı yemləri qızıl ulduza çevirir və ${d}s çəkir.`,
      tr: `Yakındaki yemleri altın yıldıza çevirir ve ${d}s çeker.`,
      ru: `Превращает еду рядом в звёзды и притягивает их ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 4.2,
    badgeColor: '#fde047',
  },
  sticky_trap: {
    id: 'sticky_trap',
    name: { en: 'Crimson Web', az: 'Tor Tələsi', tr: 'Ağ Tuzağı', ru: 'Алая Паутина' },
    desc: (d) => ({
      en: `Drops a paralyzing web zone for ${d}s locking enemy boost.`,
      az: `${d} saniyə rəqiblərin sürətini kilidləyən tor qurur.`,
      tr: `${d} saniye rakiplerin hızını kilitleyen ağ kurar.`,
      ru: `Ставит ловушку на ${d} сек, блокирующую рывок врагов.`,
    }),
    baseCd: 12.5,
    baseDur: 4.8,
    badgeColor: '#dc2626',
  },
  thorn_reflect: {
    id: 'thorn_reflect',
    name: { en: 'Aegis Repulse', az: 'Əks-Zərbə Qalxanı', tr: 'Yansıtma Kalkanı', ru: 'Щит Отражения' },
    desc: (d) => ({
      en: `Grants ${d}s armor shield and blasts nearby hunters away.`,
      az: `${d} saniyə qalxan açır və yaxındakı ovçuları geri çırpır.`,
      tr: `${d} saniye kalkan açar ve yakındaki avcıları geri savurur.`,
      ru: `Даёт щит на ${d} сек и отбрасывает ближайших врагов.`,
    }),
    baseCd: 13,
    baseDur: 3.5,
    badgeColor: '#f97316',
  },

  // ---- Legendary ----
  sunflare_nova: {
    id: 'sunflare_nova',
    name: { en: 'Solar Nova', az: 'Günəş Partlayışı', tr: 'Güneş Patlaması', ru: 'Солнечная Нова' },
    desc: (d) => ({
      en: `Scorches nearby rivals into golden stars + ${d}s hyper-dash.`,
      az: `Yaxın rəqiblərdən qızıl ulduz qoparır və ${d}s sürət verir.`,
      tr: `Yakın rakiplerden altın yıldız koparır ve ${d}s hız verir.`,
      ru: `Выбивает золотые звёзды из врагов и ускоряет на ${d} сек.`,
    }),
    baseCd: 13,
    baseDur: 3.8,
    badgeColor: '#fbbf24',
  },
  abyssal_whirlpool: {
    id: 'abyssal_whirlpool',
    name: { en: 'Abyss Shroud', az: 'Dərinlik Kölgəsi', tr: 'Derinlik Gölgesi', ru: 'Покров Бездны' },
    desc: (d) => ({
      en: `Stealth + slow aura + deep orb magnet for ${d}s.`,
      az: `${d} saniyə görünməzlik, yavaşlatma aurası və maqnit açır.`,
      tr: `${d} saniye görünmezlik, yavaşlatma aurası ve mıknatıs açar.`,
      ru: `Невидимость, замедление врагов и магнит на ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 4.4,
    badgeColor: '#0ea5e9',
  },
  valkyrie_charge: {
    id: 'valkyrie_charge',
    name: { en: 'Valkyrie Rush', az: 'Valkiriya Hücumu', tr: 'Valkür Hücumu', ru: 'Натиск Валькирии' },
    desc: (d) => ({
      en: `Shielded hyper-charge for ${d}s knocking aside all rivals.`,
      az: `${d} saniyə qalxanlı hücumla yolundakı rəqibləri kənara atır.`,
      tr: `${d} saniye kalkanlı hücumla rakipleri yana savurur.`,
      ru: `Таран со щитом на ${d} сек, расталкивающий врагов.`,
    }),
    baseCd: 13,
    baseDur: 3.8,
    badgeColor: '#facc15',
  },
  crimson_eclipse: {
    id: 'crimson_eclipse',
    name: { en: 'Blood Eclipse', az: 'Qanlı Tutulma', tr: 'Kan Tutulması', ru: 'Кровавое Затмение' },
    desc: (d) => ({
      en: `Drains nearby rivals continuously + 2x food score for ${d}s.`,
      az: `${d} saniyə rəqiblərdən xal sorur və 2x xal qazandırır.`,
      tr: `${d} saniye rakiplerden skor emer ve 2x skor kazandırır.`,
      ru: `Поглощает очки врагов и даёт 2x за еду на ${d} сек.`,
    }),
    baseCd: 13.5,
    baseDur: 4.8,
    badgeColor: '#ef4444',
  },
  twin_mirage: {
    id: 'twin_mirage',
    name: { en: 'Twin Phantoms', az: 'Əkiz İllüziya', tr: 'İkiz Serap', ru: 'Двойной Мираж' },
    desc: (d) => ({
      en: `Cloaks in stealth and spawns 2 flanking clones for ${d}s.`,
      az: `Görünməz olur və 2 tərəfdən əkiz klon buraxır (${d}s).`,
      tr: `Görünmez olur ve 2 yandan ikiz klon salar (${d}s).`,
      ru: `Невидимость и запуск 2 клонов по флангам на ${d} сек.`,
    }),
    baseCd: 14,
    baseDur: 4.2,
    badgeColor: '#c084fc',
  },
  chain_lightning: {
    id: 'chain_lightning',
    name: { en: 'Storm Arc', az: 'İldırım Zənciri', tr: 'Zincirleme Yıldırım', ru: 'Цепная Молния' },
    desc: () => ({
      en: 'Strikes up to 5 nearby snakes, stunning & dropping loot.',
      az: '5 rəqibə ildırım çaxaraq yavaşladır və xallarını tökür.',
      tr: '5 rakibe yıldırım çarparak yavaşlatır ve skor düşürür.',
      ru: 'Бьёт молнией до 5 змей рядом, выбивая очки.',
    }),
    baseCd: 12,
    baseDur: 2.6,
    badgeColor: '#38bdf8',
  },

  // ---- Mythic ----
  aurora_wake: {
    id: 'aurora_wake',
    name: { en: 'Aurora Surge', az: 'Qütb Axını', tr: 'Kutup Akışı', ru: 'Поток Авроры' },
    desc: (d) => ({
      en: `Hyper-glide for ${d}s leaving freezing aurora pools behind.`,
      az: `${d} saniyə ultra-sürət və arxada dondurucu qütb izi buraxır.`,
      tr: `${d} saniye ultra hız ve arkada dondurucu kutup izi bırakır.`,
      ru: `Гипер-скорость на ${d} сек с морозным шлейфом.`,
    }),
    baseCd: 12,
    baseDur: 4.6,
    badgeColor: '#2dd4bf',
  },
  dragon_flight: {
    id: 'dragon_flight',
    name: { en: 'Dragon Soar', az: 'Əjdaha Uçuşu', tr: 'Ejderha Uçuşu', ru: 'Полёт Дракона' },
    desc: (d) => ({
      en: `Ghost phase + free hyper-speed + wide magnet for ${d}s.`,
      az: `${d} saniyə ruh keçidi, pulsuz sürət və güclü maqnit verir.`,
      tr: `${d} saniye hayalet geçişi, hız ve güçlü mıknatıs verir.`,
      ru: `Призрачный полёт + рывок + магнит на ${d} сек.`,
    }),
    baseCd: 12.5,
    baseDur: 4.5,
    badgeColor: '#f43f5e',
  },
  chronos_stop: {
    id: 'chronos_stop',
    name: { en: 'Chronos Field', az: 'Xronos Sahəsi', tr: 'Kronos Alanı', ru: 'Поле Хроноса' },
    desc: (d) => ({
      en: `Freezes rival speed around you + 2x score & razor turns (${d}s).`,
      az: `Ətrafda zamanı yavaşladır, 2x xal və kəskin manevr verir (${d}s).`,
      tr: `Çevrede zamanı yavaşlatır, 2x skor ve keskin dönüş verir (${d}s).`,
      ru: `Замедляет время для врагов + 2x очки на ${d} сек.`,
    }),
    baseCd: 12.5,
    baseDur: 4.8,
    badgeColor: '#a855f7',
  },
  soul_scythe: {
    id: 'soul_scythe',
    name: { en: 'Twin Scythes', az: 'Ruh Orağı', tr: 'Ruh Tırpanı', ru: 'Коса Душ' },
    desc: (d) => ({
      en: `Launches dual plasma scythes + ${d}s vacuum magnet.`,
      az: `Qoşa plazma orağı atır və ${d} saniyə vakuum maqnit açır.`,
      tr: `Çifte plazma tırpanı atar ve ${d}s vakum mıknatıs açar.`,
      ru: `Выпускает двойные серпы и включает супер-магнит на ${d} сек.`,
    }),
    baseCd: 11.5,
    baseDur: 4.4,
    badgeColor: '#e879f9',
  },
  phoenix_rebirth: {
    id: 'phoenix_rebirth',
    name: { en: 'Phoenix Flare', az: 'Simurq Alovu', tr: 'Anka Alevi', ru: 'Пламя Феникса' },
    desc: (d) => ({
      en: `Nova blast + turns 18 orbs to stars + ${d}s invulnerable shield.`,
      az: `Partlayışla 18 yemi ulduza çevirir və ${d}s toxunulmaz qalxan açır.`,
      tr: `Patlamayla 18 yemi yıldıza çevirir ve ${d}s kalkan açar.`,
      ru: `Взрыв феникса, 18 звёзд и неуязвимый щит на ${d} сек.`,
    }),
    baseCd: 12,
    baseDur: 4.5,
    badgeColor: '#fb923c',
  },

  // ---- Divine & Cosmic Apex (#89 - #100) ----
  supernova_collapse: {
    id: 'supernova_collapse',
    name: { en: 'Supernova Burst', az: 'Supernova Partlayışı', tr: 'Süpernova Patlaması', ru: 'Взрыв Сверхновой' },
    desc: (d) => ({
      en: `Massive shockwave + super magnet + 2x score for ${d}s.`,
      az: `Nəhəng şok dalğası, super maqnit və ${d}s 2x xal verir.`,
      tr: `Dev şok dalgası, süper mıknatıs ve ${d}s 2x skor verir.`,
      ru: `Мощный взрыв, супер-магнит и 2x очки на ${d} сек.`,
    }),
    baseCd: 11.5,
    baseDur: 5.0,
    badgeColor: '#fbbf24',
  },
  seraph_grace: {
    id: 'seraph_grace',
    name: { en: 'Ascendant Grace', az: 'İlahi Yüksəliş', tr: 'İlahi Yükseliş', ru: 'Вознесение' },
    desc: (d) => ({
      en: `Eagle view + ghost phase + super magnet + hyper-speed (${d}s).`,
      az: `Geniş kamera, ruh keçidi, super maqnit və sürəti birləşdirir (${d}s).`,
      tr: `Geniş görüş, hayalet geçişi, mıknatıs ve hızı birleştirir (${d}s).`,
      ru: `Широкий обзор, призрак, магнит и рывок на ${d} сек.`,
    }),
    baseCd: 11,
    baseDur: 5.2,
    badgeColor: '#f472b6',
  },
  chimera_barrage: {
    id: 'chimera_barrage',
    name: { en: 'Trinity Slash', az: 'Üçlü Kəsik', tr: 'Üçlü Kesik', ru: 'Тройной Залп' },
    desc: (d) => ({
      en: `Fires 3 slicing waves + ${d}s shielded hyper-dash.`,
      az: `İrəli 3 kəsici dalğa atır və ${d}s qalxanlı sürət açır.`,
      tr: `İleri 3 kesici dalga fırlatır ve ${d}s kalkanlı hız açar.`,
      ru: `3 режущие волны веером + рывок со щитом на ${d} сек.`,
    }),
    baseCd: 10.5,
    baseDur: 4.5,
    badgeColor: '#ef4444',
  },
  void_singularity: {
    id: 'void_singularity',
    name: { en: 'Void Singularity', az: 'Qara Dəlik', tr: 'Kara Delik', ru: 'Сингулярность' },
    desc: (d) => ({
      en: `650px vacuum magnet + ghost phase + drains nearby rivals (${d}s).`,
      az: `650px nəhəng vakuum maqnit, ruh keçidi və rəqib xal sorumu (${d}s).`,
      tr: `650px dev vakum mıknatıs, hayalet geçişi ve skor emişi (${d}s).`,
      ru: `Гигантский вакуум, фаза призрака и кража очков (${d} сек).`,
    }),
    baseCd: 10,
    baseDur: 5.4,
    badgeColor: '#a855f7',
  },
  plasma_storm: {
    id: 'plasma_storm',
    name: { en: '5-Way Plasma Storm', az: 'Beşli Plazma Tufanı', tr: 'Beşli Plazma Fırtınası', ru: 'Плазменный Шторм' },
    desc: (d) => ({
      en: `Unleashes 5 radial plasma cutters + ${d}s shield & hyper-speed!`,
      az: `5 istiqamətə kəsici plazma atır + ${d}s qalxan və ildırım sürəti!`,
      tr: `5 yöne plazma kesici fırlatır + ${d}s kalkan ve yıldırım hızı!`,
      ru: `5 плазменных волн + неуязвимый рывок на ${d} сек!`,
    }),
    baseCd: 9.5,
    baseDur: 5.2,
    badgeColor: '#22d3ee',
  },
  leviathan_crush: {
    id: 'leviathan_crush',
    name: { en: 'Leviathan Cataclysm', az: 'Leviafan Zəlzələsi', tr: 'Leviathan Yıkımı', ru: 'Катаклизм Левиафана' },
    desc: (d) => ({
      en: `480px mega shockwave + 25 golden stars + ${d}s 2x score & shield!`,
      az: `480px meqa zərbə, 25 qızıl ulduz + ${d}s 2x xal və qalxan!`,
      tr: `480px mega şok dalgası, 25 altın yıldız + ${d}s 2x skor ve kalkan!`,
      ru: `Мега-волна, 25 золотых звёзд + щит и 2x очки (${d} сек)!`,
    }),
    baseCd: 9.5,
    baseDur: 5.5,
    badgeColor: '#10b981',
  },
  celestial_ascension: {
    id: 'celestial_ascension',
    name: { en: 'Celestial Godhood', az: 'Kosmik Tanrılıq', tr: 'Kozmik Yükseliş', ru: 'Небесный Абсолют' },
    desc: (d) => ({
      en: `Ghost phase + armor shield + eagle zoom + vacuum magnet + haste (${d}s)!`,
      az: `Ruh keçidi + qalxan + geniş baxış + vakuum maqnit + sürət (${d}s)!`,
      tr: `Hayalet + kalkan + geniş görüş + vakum mıknatıs + hız (${d}s)!`,
      ru: `Призрак + щит + обзор + вакуум + гипер-рывок (${d} сек)!`,
    }),
    baseCd: 9.0,
    baseDur: 5.8,
    badgeColor: '#fde047',
  },
  sovereign_dominion: {
    id: 'sovereign_dominion',
    name: { en: 'Sovereign Dominion', az: 'Mütləq Hökmranlıq', tr: 'Mutlak Hakimiyet', ru: 'Абсолютная Власть' },
    desc: (d) => ({
      en: `Shield + 2x Score + Super Magnet + Hyper-Speed + Storm Drain (${d}s)!`,
      az: `Qalxan, 2x Xal, Super Maqnit, Sürət və Xal Fırtınası (${d}s)!`,
      tr: `Kalkan, 2x Skor, Süper Mıknatıs, Hız ve Skor Fırtınası (${d}s)!`,
      ru: `Щит + 2x очки + супер-магнит + рывок + шторм (${d} сек)!`,
    }),
    baseCd: 9.0,
    baseDur: 6.0,
    badgeColor: '#eab308',
  },
  omega_apocalypse: {
    id: 'omega_apocalypse',
    name: { en: 'OMEGA APOCALYPSE', az: 'OMEQA QİYAMƏTİ', tr: 'OMEGA KIYAMETİ', ru: 'ОМЕГА АПОКАЛИПСИС' },
    desc: (d) => ({
      en: `ULTIMATE #100: 8-Way Laser Nova + 35 Golden Stars + ${d}s Invincible God Mode!`,
      az: `SONUNCU GÜC (#100): 8 Lazer Dalğası + 35 Qızıl Ulduz + ${d}s Tam Ölümsüzlük & Maqnit!`,
      tr: `MUTLAK GÜÇ (#100): 8 Lazer Dalgası + 35 Altın Yıldız + ${d}s Tam Ölümsüzlük & Mıknatıs!`,
      ru: `АБСОЛЮТ (#100): 8 лазерных волн + 35 звёзд + ${d} сек Режима Бога!`,
    }),
    baseCd: 8.5,
    baseDur: 6.5,
    badgeColor: '#f43f5e',
  },
};

type RawSnakeEntry = [
  id: string,
  name: string,
  subEn: string,
  subAz: string,
  subTr: string,
  subRu: string,
  primary: string,
  secondary: string,
  accent: string,
  trim: string,
  eye: string,
  abilityId: AbilityId
];

// Exact 100 progressively stronger snakes (#1 -> #100)
const RAW_100_SNAKES: RawSnakeEntry[] = [
  // ==================== 1 - 25: COMMON (ADİ) ====================
  ['swift-viper', 'Swift Viper', 'Agile Starter', 'Çevik Başlanğıc', 'Çevik Başlangıç', 'Быстрый Старт', '#3b82f6', '#1d4ed8', '#93c5fd', '#60a5fa', '#ffffff', 'quick_dash'],
  ['moss-fang', 'Moss Cobra', 'Toxic Tracker', 'Zəhər İzləyici', 'Zehir İzleyici', 'Лесная Кобра', '#22c55e', '#15803d', '#86efac', '#4ade80', '#ffffff', 'venom_trail'],
  ['coral-magnet', 'Coral Seeker', 'Pellet Gatherer', 'Yem Toplayan', 'Yem Toplayıcı', 'Собиратель', '#f43f5e', '#be123c', '#fda4af', '#fb7185', '#ffffff', 'food_magnet'],
  ['slate-guard', 'Iron Scale', 'Sturdy Defender', 'Zirehli Müdafiəçi', 'Zırhlı Savunmacı', 'Стальной Щит', '#64748b', '#334155', '#cbd5e1', '#94a3b8', '#ffffff', 'armor_shield'],
  ['amber-adder', 'Amber Adder', 'Bonus Harvester', 'Bərəkət İlanı', 'Bereket Yılanı', 'Янтарный Уж', '#f59e0b', '#b45309', '#fde68a', '#fbbf24', '#ffffff', 'score_boost_15'],
  ['frost-boa', 'Frost Boa', 'Cold Snap', 'Soyuq Nəfəs', 'Soğuk Nefes', 'Морозный Удав', '#06b6d4', '#0e7490', '#a5f3fc', '#22d3ee', '#ffffff', 'frost_chill'],
  ['sand-racer', 'Dune Racer', 'Desert Sprinter', 'Səhra Qaçan', 'Çöl Koşucusu', 'Песчаный Бегун', '#eab308', '#854d0e', '#fef08a', '#facc15', '#ffffff', 'quick_dash'],
  ['pine-stalker', 'Pine Stalker', 'Forest Hunter', 'Meşə Ovçusu', 'Orman Avcısı', 'Лесной Охотник', '#16a34a', '#14532d', '#bbf7d0', '#4ade80', '#ffffff', 'venom_trail'],
  ['ruby-worm', 'Ruby Glider', 'Crimson Collector', 'Yaqut Toplayıcı', 'Yakut Toplayıcı', 'Рубиновый Полоз', '#e11d48', '#881337', '#fecdd3', '#fb7185', '#ffffff', 'food_magnet'],
  ['pebble-python', 'Granite Python', 'Stone Skin', 'Qranit Dəri', 'Granit Deri', 'Гранитный Питон', '#78716c', '#44403c', '#d6d3d1', '#a8a29e', '#ffffff', 'armor_shield'],
  ['copper-asp', 'Copper Asp', 'Metallic Spark', 'Mis Qığılcım', 'Bakır Kıvılcım', 'Медный Аспид', '#d97706', '#78350f', '#fcd34d', '#f59e0b', '#ffffff', 'score_boost_15'],
  ['mint-whip', 'Mint Whipsnake', 'Breeze Runner', 'Meh Sürəti', 'Esinti Koşucusu', 'Мятный Хлыст', '#10b981', '#065f46', '#a7f3d0', '#34d399', '#ffffff', 'quick_dash'],
  ['sky-ribbon', 'Sky Ribbon', 'Cloud Drifter', 'Bulud Süzən', 'Bulut Süzüleni', 'Небесная Лента', '#0ea5e9', '#0369a1', '#bae6fd', '#38bdf8', '#ffffff', 'frost_chill'],
  ['violet-mamba', 'Lilac Mamba', 'Dusk Prowler', 'Alatoran İlanı', 'Alacakaranlık', 'Лиловая Мамба', '#8b5cf6', '#5b21b6', '#ddd6fe', '#a78bfa', '#ffffff', 'venom_trail'],
  ['peach-seeker', 'Sunset Boa', 'Warm Magnet', 'Qürub Maqniti', 'Gün Batımı', 'Закатный Удав', '#fb7185', '#9f1239', '#ffe4e6', '#fda4af', '#ffffff', 'food_magnet'],
  ['steel-viper', 'Cobalt Guard', 'Hardened Scales', 'Kobalt Zireh', 'Kobalt Zırh', 'Кобальтовый Щит', '#475569', '#1e293b', '#e2e8f0', '#94a3b8', '#ffffff', 'armor_shield'],
  ['lime-dart', 'Acid Dart', 'Sharp Sprinter', 'Turşu Oxu', 'Asit Oku', 'Кислотный Дротик', '#84cc16', '#3f6212', '#d9f99d', '#a3e635', '#ffffff', 'quick_dash'],
  ['honey-python', 'Nectar Python', 'Sweet Harvest', 'Qızıl Nektar', 'Altın Nektar', 'Нектарный Питон', '#facc15', '#a16207', '#fef9c3', '#fde047', '#ffffff', 'score_boost_15'],
  ['glacier-eel', 'Tundra Eel', 'Ice Skater', 'Tundra Buzlağı', 'Tundra Buzu', 'Тундровый Угорь', '#22d3ee', '#155e75', '#cffafe', '#67e8f9', '#ffffff', 'frost_chill'],
  ['berry-fang', 'Plum Fang', 'Venomous Bite', 'Gavalı Dişi', 'Erik Dişi', 'Сливовый Клык', '#a855f7', '#6b21a8', '#f3e8ff', '#c084fc', '#ffffff', 'venom_trail'],
  ['bronze-lance', 'Bronze Lance', 'Arena Scout', 'Bürünc Nizə', 'Bronz Mızrak', 'Бронзовое Копьё', '#b45309', '#451a03', '#fde68a', '#d97706', '#ffffff', 'armor_shield'],
  ['teal-current', 'Reef Current', 'Tidal Swimmer', 'Mərcan Axını', 'Mercan Akıntısı', 'Рифовый Поток', '#14b8a6', '#115e59', '#99f6e4', '#2dd4bf', '#ffffff', 'food_magnet'],
  ['indigo-scout', 'Indigo Scout', 'Night Runner', 'Gecə Kəşfiyyatçısı', 'Gece İzci', 'Индиго Разведчик', '#6366f1', '#3730a3', '#c7d2fe', '#818cf8', '#ffffff', 'quick_dash'],
  ['crimson-adder', 'Scarlet Adder', 'Fierce Striker', 'Al-Qırmızı Hücum', 'Kızıl Saldırı', 'Алая Гадюка', '#ef4444', '#991b1b', '#fecaca', '#f87171', '#ffffff', 'score_boost_15'],
  ['arctic-viper', 'Polar Viper', 'Subzero Coil', 'Qütb Halqası', 'Kutup Halkası', 'Полярная Гадюка', '#38bdf8', '#075985', '#e0f2fe', '#7dd3fc', '#ffffff', 'frost_chill'],

  // ==================== 26 - 50: RARE (NADİR) ====================
  ['phantom-wisp', 'Phantom Wisp', 'Ghostly Walker', 'Kabus Yolçusu', 'Hayalet Yolcu', 'Призрачный Дух', '#38bdf8', '#1e3a8a', '#e0f2fe', '#7dd3fc', '#e0f2fe', 'ghost_phase'],
  ['cinder-drake', 'Cinder Wyrm', 'Molten Tail', 'Köz Quyruq', 'Kor Kuyruk', 'Пепельный Змей', '#ea580c', '#7c2d12', '#fed7aa', '#fb923c', '#fef08a', 'ember_trail'],
  ['chrono-cobra', 'Pulse Cobra', 'Time Bender', 'Zaman Bükən', 'Zaman Büken', 'Хроно-Кобра', '#818cf8', '#312e81', '#e0e7ff', '#a5b4fc', '#ffffff', 'time_shift'],
  ['neon-blink', 'Blink Stalker', 'Phase Jumper', 'Məkan Sıçrayan', 'Mekan Sıçrayan', 'Фазовый Прыгун', '#a855f7', '#4c1d95', '#f3e8ff', '#c084fc', '#fae8ff', 'forward_blink'],
  ['leech-serpent', 'Crimson Leech', 'Energy Drainer', 'Enerji Soran', 'Enerji Sömüren', 'Алый Вампир', '#ec4899', '#831843', '#fbcfe8', '#f472b6', '#ffffff', 'score_drain'],
  ['thunder-eel', 'Volt Eel', 'Static Repulsor', 'Elektrik Dalğası', 'Elektrik Dalgası', 'Вольт-Угорь', '#06b6d4', '#164e63', '#cffafe', '#22d3ee', '#fef9c3', 'shock_push'],
  ['hawk-python', 'Falcon Boa', 'Sky Watcher', 'Şahin Gözlü', 'Şahin Gözlü', 'Соколиный Удав', '#f59e0b', '#78350f', '#fef3c7', '#fbbf24', '#ffffff', 'eagle_vision'],
  ['mist-specter', 'Mist Specter', 'Fog Diver', 'Duman Ruhani', 'Sis Hayaleti', 'Туманный Призрак', '#60a5fa', '#1e40af', '#dbeafe', '#93c5fd', '#ffffff', 'ghost_phase'],
  ['magma-fang', 'Magma Hound', 'Lava Spitter', 'Lava Püskürən', 'Lav Püskürten', 'Магмовый Клык', '#f97316', '#9a3412', '#ffedd5', '#fdba74', '#fde047', 'ember_trail'],
  ['quartz-viper', 'Quartz Viper', 'Crystal Reflex', 'Kristal Refleks', 'Kristal Refleks', 'Кварцевый Уж', '#c084fc', '#581c87', '#fae8ff', '#e879f9', '#ffffff', 'time_shift'],
  ['warp-lancer', 'Rift Lancer', 'Portal Striker', 'Portal Nizəsi', 'Portal Mızrağı', 'Портальный Улан', '#6366f1', '#1e1b4b', '#e0e7ff', '#818cf8', '#a5f3fc', 'forward_blink'],
  ['orchid-siphon', 'Orchid Siphon', 'Velvet Thief', 'Məxmər Ovçu', 'Kadife Avcı', 'Бархатный Сифон', '#f43f5e', '#881337', '#ffe4e6', '#fb7185', '#ffffff', 'score_drain'],
  ['tempest-boa', 'Tempest Boa', 'Gale Force', 'Qasırğa Gücü', 'Kasırga Gücü', 'Штормовой Удав', '#0284c7', '#0c4a6e', '#bae6fd', '#38bdf8', '#fde047', 'shock_push'],
  ['solar-scout', 'Horizon Seeker', 'Far Sighted', 'Üfüq İzləyən', 'Ufuk İzleyen', 'Страж Горизонта', '#eab308', '#713f12', '#fef08a', '#facc15', '#ffffff', 'eagle_vision'],
  ['jade-phantom', 'Jade Wraith', 'Emerald Spirit', 'Zümrüd Kölgə', 'Zümrüt Gölge', 'Нефритовый Дух', '#10b981', '#064e3b', '#d1fae5', '#34d399', '#ecfdf5', 'ghost_phase'],
  ['pyro-anaconda', 'Pyro Boa', 'Blazing Spine', 'Alovlu Onurğa', 'Alevli Omurga', 'Пиро-Анаконда', '#ef4444', '#7f1d1d', '#fee2e2', '#f87171', '#fde047', 'ember_trail'],
  ['cyber-pulse', 'Cyber Pulse', 'Matrix Runner', 'Matriks Qaçan', 'Matris Koşucusu', 'Кибер-Импульс', '#2dd4bf', '#134e4a', '#ccfbf1', '#5eead4', '#ffffff', 'time_shift'],
  ['astral-jumper', 'Star Jumper', 'Cosmic Leap', 'Ulduz Sıçrayışı', 'Yıldız Sıçrayışı', 'Звёздный Скакун', '#8b5cf6', '#3b0764', '#ede9fe', '#a78bfa', '#fde047', 'forward_blink'],
  ['crimson-vamp', 'Night Siphon', 'Dusk Leech', 'Gecə Sorucusu', 'Gece Sömürücüsü', 'Ночной Вампир', '#db2777', '#500724', '#fce7f3', '#f472b6', '#ffffff', 'score_drain'],
  ['sonic-viper', 'Sonic Viper', 'Boom Wave', 'Səs Dalğası', 'Ses Dalgası', 'Звуковая Гадюка', '#3b82f6', '#172554', '#dbeafe', '#60a5fa', '#fef08a', 'shock_push'],
  ['golden-lynx', 'Golden Eagle', 'Keen Hunter', 'İti Baxış', 'Keskin Bakış', 'Золотой Сокол', '#d97706', '#451a03', '#fef3c7', '#fbbf24', '#ffffff', 'eagle_vision'],
  ['ether-cobra', 'Ether Cobra', 'Void Glider', 'Efir İlanı', 'Eter Yılanı', 'Эфирная Кобра', '#67e8f9', '#164e63', '#ecfeff', '#a5f3fc', '#ffffff', 'ghost_phase'],
  ['hellfire-asp', 'Scorch Asp', 'Volcanic Trail', 'Vulkan İzi', 'Volkan İzi', 'Вулканический Уж', '#fb923c', '#7c2d12', '#ffedd5', '#fdba74', '#fef08a', 'ember_trail'],
  ['nexus-shift', 'Nexus Shifter', 'Hyper Reflex', 'Hiper Refleks', 'Hiper Refleks', 'Нексус-Сдвиг', '#a78bfa', '#2e1065', '#f5f3ff', '#c4b5fd', '#22d3ee', 'time_shift'],
  ['storm-flash', 'Flash Striker', 'Lightning Step', 'İldırım Addımı', 'Yıldırım Adımı', 'Молниеносный', '#22d3ee', '#083344', '#cffafe', '#67e8f9', '#fde047', 'forward_blink'],

  // ==================== 51 - 72: EPIC / MYSTIC (GİZƏMLİ) ====================
  ['shadow-mirage', 'Shadow Mirage', 'Illusionist', 'Kölgə Ustası', 'Gölge Ustası', 'Мастер Иллюзий', '#9333ea', '#3b0764', '#f3e8ff', '#c084fc', '#e9d5ff', 'decoy_clone'],
  ['void-vortex', 'Nebula Vortex', 'Gravity Weaver', 'Qravitasiya Ustası', 'Çekim Ustası', 'Ткач Гравитации', '#7c3aed', '#1e1b4b', '#ede9fe', '#a78bfa', '#38bdf8', 'gravity_vortex'],
  ['emerald-blade', 'Jade Katana', 'Razor Cutter', 'Ülgüc Dalğası', 'Jilet Dalgası', 'Нефритовый Клинок', '#10b981', '#022c22', '#a7f3d0', '#34d399', '#fef08a', 'slice_wave'],
  ['bio-hydra', 'Bio Hydra', 'Living Reactor', 'Canlı Reaktor', 'Canlı Reaktör', 'Био-Гидра', '#22c55e', '#052e16', '#bbf7d0', '#4ade80', '#ffffff', 'bio_regen'],
  ['celestial-alchemist', 'Star Alchemist', 'Gold Transmuter', 'Ulduz Kimyaçısı', 'Yıldız Simyacısı', 'Звёздный Алхимик', '#eab308', '#422006', '#fef9c3', '#fde047', '#ffffff', 'star_harvest'],
  ['widow-fang', 'Black Widow', 'Silk Trapper', 'Qara Dul Tələsi', 'Karadul Tuzağı', 'Чёрная Вдова', '#dc2626', '#18181b', '#fca5a5', '#ef4444', '#fde047', 'sticky_trap'],
  ['iron-juggernaut', 'Aegis Titan', 'Spiked Fortress', 'Tikanlı Qala', 'Dikenli Kale', 'Шипастый Титан', '#f97316', '#27272a', '#fed7aa', '#fb923c', '#ffffff', 'thorn_reflect'],
  ['specter-ninja', 'Shinobi Phantom', 'Smoke Clone', 'Tüstü Klonu', 'Duman Klonu', 'Шиноби-Фантом', '#6366f1', '#0f172a', '#c7d2fe', '#818cf8', '#38bdf8', 'decoy_clone'],
  ['pulsar-core', 'Pulsar Python', 'Magnetic Core', 'Pulsar Nüvəsi', 'Pulsar Çekirdeği', 'Пульсарный Питон', '#c026d3', '#4a044e', '#fae8ff', '#e879f9', '#fde047', 'gravity_vortex'],
  ['cyber-scythe', 'Neon Ronin', 'Laser Crescent', 'Lazer Qılıncı', 'Lazer Kılıcı', 'Неоновый Ронин', '#06b6d4', '#082f49', '#a5f3fc', '#22d3ee', '#f43f5e', 'slice_wave'],
  ['verdant-spirit', 'Gaia Serpent', 'Nature Surge', 'Təbiət Gücü', 'Doğa Gücü', 'Дух Природы', '#4ade80', '#064e3b', '#dcfce7', '#86efac', '#fef08a', 'bio_regen'],
  ['midas-coil', 'Midas Royal', 'Golden Touch', 'Midas Toxunuşu', 'Midas Dokunuşu', 'Золото Мидаса', '#f59e0b', '#1c1917', '#fef08a', '#facc15', '#ffffff', 'star_harvest'],
  ['venom-weaver', 'Arachne Viper', 'Web Spinner', 'Hörümçək Toru', 'Örümcek Ağı', 'Арахна', '#e11d48', '#27272a', '#fda4af', '#fb7185', '#a3e635', 'sticky_trap'],
  ['obsidian-ram', 'Obsidian Ram', 'Reflective Armor', 'Obsidian Qalxan', 'Obsidyen Kalkan', 'Обсидиановый Таран', '#fb7185', '#09090b', '#ffe4e6', '#f43f5e', '#fde047', 'thorn_reflect'],
  ['eclipse-trickster', 'Loki Mirage', 'Mystic Trickster', 'Gizəmli İllüziya', 'Gizemli İllüzyon', 'Мистик-Локи', '#14b8a6', '#1e1b4b', '#99f6e4', '#2dd4bf', '#fde047', 'decoy_clone'],
  ['dark-matter', 'Dark Matter', 'Abyssal Pull', 'Qaranlıq Maddə', 'Karanlık Madde', 'Тёмная Материя', '#8b5cf6', '#09090b', '#ddd6fe', '#a78bfa', '#22d3ee', 'gravity_vortex'],
  ['crimson-katana', 'Blood Samurai', 'Scarlet Slash', 'Qırmızı Kəsik', 'Kızıl Kesik', 'Кровавый Самурай', '#ef4444', '#1f2937', '#fecaca', '#f87171', '#fde047', 'slice_wave'],
  ['emerald-overdrive', 'Reactor Cobra', 'Atomic Growth', 'Atom Böyüməsi', 'Atomik Büyüme', 'Атомная Кобра', '#84cc16', '#14532d', '#ecfccb', '#a3e635', '#ffffff', 'bio_regen'],
  ['astral-mint', 'Comet Harvester', 'Stardust Collector', 'Ulduz Tozu', 'Yıldız Tozu', 'Ловец Комет', '#38bdf8', '#1e1b4b', '#fde047', '#60a5fa', '#fde047', 'star_harvest'],
  ['scarlet-snare', 'Scorpion King', 'Paralyzing Sting', 'Əqrəb İynəsi', 'Akrep İğnesi', 'Король Скорпионов', '#f43f5e', '#31102f', '#fecdd3', '#fb7185', '#fef08a', 'sticky_trap'],
  ['titanium-bastion', ' Bastion Wyrm', 'Unbreakable', 'Sarsılmaz Qala', 'Yıkılmaz Kale', 'Несокрушимый', '#94a3b8', '#0f172a', '#f8fafc', '#38bdf8', '#38bdf8', 'thorn_reflect'],
  ['arcane-blade', 'Arcane Warlock', 'Runic Cutter', 'Runik Dalğa', 'Rünik Dalga', 'Рунный Чернокнижник', '#d946ef', '#2e1065', '#fae8ff', '#f0abfc', '#22d3ee', 'slice_wave'],

  // ==================== 73 - 88: LEGENDARY (ƏFSANƏVİ) ====================
  ['helios-emperor', 'Helios Flare', 'Sun Lord', 'Günəş Hökmdarı', 'Güneş Hükümdarı', 'Владыка Солнца', '#facc15', '#7c2d12', '#fef9c3', '#fb923c', '#ffffff', 'sunflare_nova'],
  ['kraken-lord', 'Abyssal Kraken', 'Ocean Terror', 'Okean Kabusu', 'Okyanus Kabusu', 'Кракен Бездны', '#0ea5e9', '#082f49', '#bae6fd', '#2dd4bf', '#fde047', 'abyssal_whirlpool'],
  ['valkyrie-spear', 'Golden Valkyrie', 'Radiant Lancer', 'Qızıl Valkiriya', 'Altın Valkür', 'Золотая Валькирия', '#fde047', '#1e293b', '#ffffff', '#f59e0b', '#38bdf8', 'valkyrie_charge'],
  ['blood-monarch', 'Crimson Count', 'Vampire Lord', 'Qanlı Monarx', 'Kanlı Hükümdar', 'Кровавый Монарх', '#dc2626', '#09090b', '#fca5a5', '#f43f5e', '#fde047', 'crimson_eclipse'],
  ['gemini-phantom', 'Twin Gemini', 'Dual Illusion', 'Qoşa Kölgə', 'Çifte Serap', 'Двойной Фантом', '#c084fc', '#1e1b4b', '#f5d0fe', '#e879f9', '#22d3ee', 'twin_mirage'],
  ['zeus-thunder', 'Zeus Bolt', 'Thunder God', 'İldırım Tanrısı', 'Yıldırım Tanrısı', 'Гром Зевса', '#38bdf8', '#172554', '#fef08a', '#facc15', '#fde047', 'chain_lightning'],
  ['hyperion-sun', 'Hyperion Titan', 'Blazing Corona', 'Alovlu Tac', 'Alevli Taç', 'Титан Гиперион', '#fb923c', '#451a03', '#fef08a', '#facc15', '#ffffff', 'sunflare_nova'],
  ['poseidon-trident', 'Poseidon Fury', 'Deep Maelstrom', 'Poseydon Qəzəbi', 'Poseidon Öfkesi', 'Гнев Посейдона', '#2dd4bf', '#042f2e', '#99f6e4', '#38bdf8', '#fde047', 'abyssal_whirlpool'],
  ['paladin-champion', 'Royal Paladin', 'Templar Shield', 'Kral Cəngavəri', 'Kral Şövalyesi', 'Королевский Паладин', '#f8fafc', '#1e3a8a', '#fde047', '#eab308', '#38bdf8', 'valkyrie_charge'],
  ['nosferatu-king', 'Night Overlord', 'Dark Eclipse', 'Zülmət Hökmdarı', 'Karanlık Lord', 'Повелитель Ночи', '#e11d48', '#18181b', '#fda4af', '#fb7185', '#fde047', 'crimson_eclipse'],
  ['prism-illusion', 'Prism Trickster', 'Mirror Master', 'Güzgü Ustası', 'Ayna Ustası', 'Зеркальный Маг', '#ec4899', '#312e81', '#a5f3fc', '#22d3ee', '#ffffff', 'twin_mirage'],
  ['thor-mjolnir', 'Stormbringer', 'Tempest Hammer', 'Fırtına Çəkici', 'Fırtına Çekici', 'Буревестник', '#60a5fa', '#0f172a', '#fde047', '#38bdf8', '#fef08a', 'chain_lightning'],
  ['solaris-rex', 'Solaris Rex', 'Star Forged', 'Ulduzdan Doğan', 'Yıldızdan Doğan', 'Солярис Рекс', '#f59e0b', '#450a0a', '#fef9c3', '#fde047', '#ffffff', 'sunflare_nova'],
  ['palace-leviathan', 'Tidal Sovereign', 'Sunken Crown', 'Batmış Tac', 'Batık Taç', 'Владыка Приливов', '#06b6d4', '#022c22', '#a7f3d0', '#34d399', '#fde047', 'abyssal_whirlpool'],
  ['aegis-conqueror', 'Ares Warlord', 'Unstoppable Ram', 'Müharibə Tanrısı', 'Savaş Lordu', 'Бог Войны Арес', '#ef4444', '#1c1917', '#fde047', '#f59e0b', '#fde047', 'valkyrie_charge'],
  ['volt-archon', 'Tesla Archon', 'High Voltage', 'Yüksək Gərginlik', 'Yüksek Gerilim', 'Архонт Молний', '#22d3ee', '#1e1b4b', '#fef08a', '#e879f9', '#fde047', 'chain_lightning'],

  // ==================== 89 - 96: MYTHIC (MİFİK — ÇOX GÜCLÜ!) ====================
  ['aurora-serpent', 'Aurora Borealis', 'Prismatic Myth', 'Qütb Parıltısı', 'Kutup Işıltısı', 'Северное Сияние', '#2dd4bf', '#1e1b4b', '#f472b6', '#a7f3fc', '#fde047', 'aurora_wake'],
  ['celestial-dragon', 'Azure Dragon', 'Sky Emperor', 'Göy Əjdahası', 'Gök Ejderhası', 'Лазурный Дракон', '#38bdf8', '#172554', '#fde047', '#f43f5e', '#fde047', 'dragon_flight'],
  ['chronos-emperor', 'Chronos Prime', 'Master of Time', 'Zaman Tanrısı', 'Zaman Tanrısı', 'Владыка Времени', '#a855f7', '#09090b', '#fde047', '#e879f9', '#22d3ee', 'chronos_stop'],
  ['reaper-archon', 'Soul Reaper', 'Phantom Scythe', 'Ruh Ovçusu', 'Ruh Avcısı', 'Жнец Душ', '#f43f5e', '#18181b', '#c084fc', '#e879f9', '#fde047', 'soul_scythe'],
  ['eternal-phoenix', 'Immortal Phoenix', 'Reborn in Flame', 'Ölümsüz Simurq', 'Ölümsüz Anka', 'Бессмертный Феникс', '#fb923c', '#450a0a', '#fef08a', '#facc15', '#ffffff', 'phoenix_rebirth'],
  ['quasar-titan', 'Quasar Singularity', 'Black Hole Lord', 'Qara Dəlik Tanrısı', 'Kara Delik Lordu', 'Повелитель Квазара', '#8b5cf6', '#030712', '#22d3ee', '#f472b6', '#fde047', 'void_singularity'],
  ['supernova-king', 'Supernova Monarch', 'Galactic Core', 'Qalaktika Nüvəsi', 'Galaksi Çekirdeği', 'Король Сверхновой', '#facc15', '#1e1b4b', '#fb7185', '#ffffff', '#fde047', 'supernova_collapse'],
  ['bahamut-prime', 'Bahamut Prime', 'World Breaker', 'Dünya Dağıdan', 'Dünya Yıkan', 'Бахамут Прайм', '#10b981', '#09090b', '#fde047', '#2dd4bf', '#fde047', 'leviathan_crush'],

  // ==================== 97 - 100: DIVINE APEX (İLAHİ — MAKSİMUM GÜC!) ====================
  ['galaxy-seraph', 'Astral Seraphim', 'Celestial Archon', 'Qalaktika Mələyi', 'Galaksi Meleği', 'Астральный Серафим', '#f8fafc', '#312e81', '#f472b6', '#fde047', '#fde047', 'celestial_ascension'],
  ['chaos-chimera', 'Imperial Chimera', '5-Star Destroyer', 'İmperial Ximera', 'İmparatorluk Kimerası', 'Имперская Химера', '#22d3ee', '#09090b', '#f43f5e', '#fde047', '#fde047', 'plasma_storm'],
  ['omega-sovereign', 'Cosmic Sovereign', 'Universe Ruler', 'Kainat Hökmdarı', 'Evren Hükümdarı', 'Владыка Вселенной', '#111827', '#eab308', '#f43f5e', '#ffffff', '#fde047', 'sovereign_dominion'],
  ['apex-omega-100', 'OMEGA APOCALYPSE', 'Supreme #100 God', 'Mütləq Zirvə #100', 'Mutlak Zirve #100', 'Абсолют Омега #100', '#ef4444', '#fde047', '#22d3ee', '#ffffff', '#ffffff', 'omega_apocalypse'],
];

function getRarityForIndex(idx: number): RarityTier {
  if (idx <= 25) return 'common';
  if (idx <= 50) return 'rare';
  if (idx <= 72) return 'epic';
  if (idx <= 88) return 'legendary';
  if (idx <= 96) return 'mythic';
  return 'divine';
}

export const SNAKE_TYPES: SnakeTypeSpec[] = RAW_100_SNAKES.map((row, arrayIdx) => {
  const index = arrayIdx + 1; // 1 .. 100
  const rarity = getRarityForIndex(index);
  const progress = (index - 1) / 99; // 0.0 -> 1.0
  const curve = Math.pow(progress, 1.35);

  const [
    id,
    name,
    subEn,
    subAz,
    subTr,
    subRu,
    primaryColor,
    secondaryColor,
    accentColor,
    trimColor,
    eyeColor,
    abilityId,
  ] = row;

  // Escalating power from Snake #1 to Snake #100 (especially 90-100!)
  const lateBoost = index >= 90 ? (index - 89) * 0.055 : 0;
  const powerRating =
    index === 100
      ? 1000
      : Math.round(12 + curve * 860 + (index >= 89 ? (index - 88) * 10 : 0));

  const scoreMultiplier =
    index === 100
      ? 3.2
      : Number((1.0 + curve * 1.65 + lateBoost).toFixed(2));

  const passiveMagnetBonus =
    index === 100
      ? 96
      : Math.round(progress * 68 + (index >= 89 ? (index - 88) * 2.2 : 0));

  const boostEfficiency =
    index === 100
      ? 0.9
      : Number(Math.min(0.88, progress * 0.78 + (index >= 89 ? 0.08 : 0)).toFixed(2));

  const speedStat = Math.min(28, Math.round(7 + progress * 17 + (index >= 95 ? (index - 94) * 0.8 : 0)));
  const turnStat = Math.min(20, Math.round(7 + progress * 11 + (index >= 95 ? 2 : 0)));
  const controlStat = Math.min(20, Math.round(7 + progress * 11 + (index >= 95 ? 2 : 0)));

  const tpl = ABILITY_TEMPLATES[abilityId];
  // Higher index snakes get faster cooldowns and longer ability durations!
  const cdScale = 1 - progress * 0.22;
  const durScale = 1 + progress * 0.32;
  const cooldownSec =
    index >= 97
      ? tpl.baseCd
      : Number(Math.max(7.5, tpl.baseCd * cdScale).toFixed(1));
  const durationSec =
    index >= 97
      ? tpl.baseDur
      : Number((tpl.baseDur * durScale).toFixed(1));

  const ability: SnakeAbilitySpec = {
    id: tpl.id,
    name: tpl.name,
    description: tpl.desc(durationSec),
    cooldownSec,
    durationSec,
    badgeColor: tpl.badgeColor,
  };

  return {
    id,
    index,
    requiredLevel: index,
    rarity,
    name,
    subtitle: {
      en: subEn,
      az: subAz,
      tr: subTr,
      ru: subRu,
    },
    primaryColor,
    secondaryColor,
    accentColor,
    trimColor,
    eyeColor,
    speedStat,
    turnStat,
    controlStat,
    powerRating,
    scoreMultiplier,
    passiveMagnetBonus,
    boostEfficiency,
    ability,
  };
});

export const SNAKE_MAP_BY_ID: Record<string, SnakeTypeSpec> = Object.fromEntries(
  SNAKE_TYPES.map((s) => [s.id, s])
);

export function getSnakeSpec(id: string): SnakeTypeSpec {
  return SNAKE_MAP_BY_ID[id] || SNAKE_TYPES[0];
}
