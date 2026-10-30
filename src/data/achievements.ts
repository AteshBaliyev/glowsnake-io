import { LocalizedText } from '@/types/game';

export interface AchievementDef {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_blood',
    icon: '⚔️',
    title: {
      en: 'First Takedown',
      az: 'İlk Ov',
      tr: 'İlk Av',
      ru: 'Первая Победа',
    },
    description: {
      en: 'Defeat your first rival snake in the arena.',
      az: 'Arenada ilk rəqib ilanı məhv et.',
      tr: 'Arenada ilk rakip yılanı alt et.',
      ru: 'Победите первую змею соперника на арене.',
    },
  },
  {
    id: 'score_300',
    icon: '🌱',
    title: {
      en: 'Rising Serpent',
      az: 'Böyüyən İlan',
      tr: 'Yükselen Yılan',
      ru: 'Растущий Змей',
    },
    description: {
      en: 'Collect 300 score in a single match.',
      az: 'Tək oyunda 300 xal topla.',
      tr: 'Tek maçta 300 skora ulaş.',
      ru: 'Наберите 300 очков за один матч.',
    },
  },
  {
    id: 'score_1000',
    icon: '🔥',
    title: {
      en: 'Thousand Club',
      az: 'Minlik Ustası',
      tr: 'Binler Kulübü',
      ru: 'Тысячник',
    },
    description: {
      en: 'Reach 1,000 score in a single match.',
      az: 'Tək oyunda 1,000 xala çat.',
      tr: 'Tek maçta 1.000 skora ulaş.',
      ru: 'Достигните 1 000 очков за один матч.',
    },
  },
  {
    id: 'score_3000',
    icon: '👑',
    title: {
      en: 'Arena Monarch',
      az: 'Arena Hökmdarı',
      tr: 'Arena Hükümdarı',
      ru: 'Монарх Арены',
    },
    description: {
      en: 'Reach 3,000 score in a single match.',
      az: 'Tək oyunda 3,000 xala çat.',
      tr: 'Tek maçta 3.000 skora ulaş.',
      ru: 'Достигните 3 000 очков за один матч.',
    },
  },
  {
    id: 'top_3',
    icon: '🥇',
    title: {
      en: 'Podium Finish',
      az: 'Liderlər Zirvəsi',
      tr: 'Zirve Yarışı',
      ru: 'Тройка Лидеров',
    },
    description: {
      en: 'Reach Top 3 rank in the arena.',
      az: 'Arenada ilk 3-lüyə yüksəl.',
      tr: 'Arenada ilk 3 sıraya yüksel.',
      ru: 'Войдите в топ-3 лучших на арене.',
    },
  },
  {
    id: 'rank_1',
    icon: '🏆',
    title: {
      en: 'Number One',
      az: 'Birinci!',
      tr: 'Bir Numara',
      ru: 'Номер Один',
    },
    description: {
      en: 'Become Rank #1 on the leaderboard.',
      az: 'Liderlər lövhəsində 1-ci sıraya çıx.',
      tr: 'Liderlik tablosunda 1. sıraya yerleş.',
      ru: 'Займите 1-е место в таблице лидеров.',
    },
  },
  {
    id: 'slayer_5',
    icon: '⚡',
    title: {
      en: 'Sharp Hunter',
      az: 'Kəskin Ovçu',
      tr: 'Keskin Avcı',
      ru: 'Опытный Охотник',
    },
    description: {
      en: 'Defeat 5 snakes in one match.',
      az: 'Bir oyunda 5 ilanı məhv et.',
      tr: 'Tek maçta 5 yılanı alt et.',
      ru: 'Победите 5 змей за один матч.',
    },
  },
  {
    id: 'slayer_15',
    icon: '💀',
    title: {
      en: 'Unstoppable',
      az: 'Dayanılmaz',
      tr: 'Durdurulamaz',
      ru: 'Неудержимый',
    },
    description: {
      en: 'Defeat 15 snakes in one match.',
      az: 'Bir oyunda 15 ilanı məhv et.',
      tr: 'Tek maçta 15 yılanı alt et.',
      ru: 'Победите 15 змей за один матч.',
    },
  },
  {
    id: 'survivor_3m',
    icon: '⏱️',
    title: {
      en: '3-Minute Survivor',
      az: '3 Dəqiqəlik Dözüm',
      tr: '3 Dakika Hayatta',
      ru: 'Выживший (3 мин)',
    },
    description: {
      en: 'Survive for at least 3 minutes in a single match.',
      az: 'Tək oyunda ən azı 3 dəqiqə sağ qal.',
      tr: 'Tek maçta en az 3 dakika hayatta kal.',
      ru: 'Продержитесь не менее 3 минут в одном матче.',
    },
  },
  {
    id: 'level_10',
    icon: '💎',
    title: {
      en: 'Rare Collector',
      az: 'Nadir Kolleksiyaçı',
      tr: 'Nadir Koleksiyoncu',
      ru: 'Коллекционер',
    },
    description: {
      en: 'Reach Level 10 and unlock Rare snakes.',
      az: '10-cu səviyyəyə çat və Nadir ilanları aç.',
      tr: '10. seviyeye ulaş ve Nadir yılanları aç.',
      ru: 'Достигните 10-го уровня.',
    },
  },
  {
    id: 'level_21',
    icon: '🌟',
    title: {
      en: 'Legendary Tier',
      az: 'Əfsanəvi Mərtəbə',
      tr: 'Efsanevi Seviye',
      ru: 'Легендарный Ранг',
    },
    description: {
      en: 'Reach Level 21 to unlock Legendary snakes.',
      az: '21-ci səviyyəyə çataraq Əfsanəvi ilanları aç.',
      tr: '21. seviyeye ulaşarak Efsanevi yılanları aç.',
      ru: 'Достигните 21-го уровня и откройте Легендарных змей.',
    },
  },
  {
    id: 'veteran_25_kills',
    icon: '🎖️',
    title: {
      en: 'Arena Veteran',
      az: 'Arena Veteranı',
      tr: 'Arena Gazisi',
      ru: 'Ветеран Арены',
    },
    description: {
      en: 'Defeat 25 snakes in total across your career.',
      az: 'Ümumilikdə 25 rəqib ilanı məhv et.',
      tr: 'Toplamda 25 rakip yılanı alt et.',
      ru: 'Победите в сумме 25 змей за карьеру.',
    },
  },
];

// 160+ Natural Player Nicknames (No "[BOT]" tags so arenas feel 100% organic!)
export const PLAYER_LIKE_NAMES: string[] = [
  'ShadowViper', 'AlexPro', 'Kaan_TR', 'Qartal', 'StormX', 'Nika_7', 'GhostRider',
  'Maverick', 'Elnur99', 'Zeyneb', 'DarkKnight', 'blazex', 'Vortex', 'SniperWolf',
  'Rauf_AZ', 'EmreCan', 'SkyWalker', 'LunaStar', 'phoenix', 'TitanSlayer',
  'Orxan_01', 'Maximus', 'Drako', 'Neo_77', 'IceQueen', 'Samurai', 'Venomous',
  'TuralX', 'Kerem_34', 'Artemis', 'ZeroCool', 'FlashPoint', 'NightHawk', 'Caspian',
  'Araz_Baku', 'BozQurd', 'FalconEye', 'ruslan_k', 'Mirage', 'Zenith', 'KobraX',
  'denis_98', 'MuradPro', 'Burak_06', 'avalon', 'Hyperion', 'SilentKill', 'omen',
  'Kamran', 'Selin', 'BlackMamba', 'cypher', 'Striker', 'Valkyrie', 'odin_son',
  'Farid_AZ', 'MertX', 'eclipse', 'Solaris', 'Thunder', 'lucky_7', 'Aydan',
  'Spartan', 'kratos', 'SilverFox', 'alpha_wolf', 'Ramil', 'Tolga', 'nikita_ru',
  'Hydra', 'Leviathan', 'crimson', 'JadeDragon', 'cosmos', 'starlord', 'AcePilot',
  'Vusal_88', 'Hakan', 'dmitry', 'Scorpion', 'SubZero', 'raiden', 'Nocturne',
  'Ilkin', 'Arda_10', 'viktor', 'Nebula', 'PhantomX', 'raptor', 'ApexKing',
  'Nihad', 'Baris', 'maksim', 'Obsidian', 'GoldRush', 'emerald', 'Sapphire',
  'Cavidan', 'Onur_TR', 'sergey', 'Tempest', 'Blizzard', 'inferno_9', 'Magma',
  'Tamerlan', 'Yusuf', 'andrey', 'Ronin', 'Shogun', 'katana', 'Swift',
  'Rashad', 'Furkan', 'ivan_x', 'Horizon', 'Quantum', 'pulse', 'Vector',
  'Emin_AZ', 'Gokhan', 'alexey', 'Monarch', 'Sovereign', 'astral', 'MythicOne',
  'Zaur', 'Sinan', 'roman_7', 'HunterX', 'Predator', 'cobra_kai', 'ViperGT',
  'anar_baku', 'Cem_35', 'kirill', 'Outlaw', 'Bandit', 'rebel', 'Rogue',
  'Kenan', 'Umut', 'pavel', 'Crusher', 'Goliath', 'colossus', 'Atlas',
  'Elvin95', 'Oguz', 'timur', 'Tornado', 'Cyclone', 'typhoon', 'Tsunami',
  'Babek', 'Atilla', 'iskender', 'Legend27', 'ProGamer', 'king_slither', 'ozy',
];
