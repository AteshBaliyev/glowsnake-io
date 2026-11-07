import { ArenaMapSpec, MapId } from '@/types/game';

export const ARENA_MAPS: ArenaMapSpec[] = [
  {
    id: 'cyberpunk-city',
    name: {
      en: 'Classic Obsidian',
      az: 'Klassik Tünd',
      tr: 'Klasik Koyu',
      ru: 'Классическая Тёмная',
    },
    offlineHalfSize: 19200, // 3x Expanded (38,400 x 38,400) for ~300 snakes
    onlineHalfSize: 18600,
    bgColor: '#10141f',
    bgAccentColor: '#1e293b',
    gridColor: 'rgba(148, 163, 184, 0.09)',
    borderColor: '#64748b',
    patternStyle: 'grid',
    orbPalette: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa'],
  },
  {
    id: 'neon-space',
    name: {
      en: 'Deep Cosmos',
      az: 'Dərin Kosmos',
      tr: 'Derin Uzay',
      ru: 'Глубокий Космос',
    },
    offlineHalfSize: 19500,
    onlineHalfSize: 18800,
    bgColor: '#0c0a2a',
    bgAccentColor: '#2e1065',
    gridColor: 'rgba(167, 139, 250, 0.16)',
    borderColor: '#8b5cf6',
    patternStyle: 'stars',
    orbPalette: ['#818cf8', '#38bdf8', '#fde047', '#f472b6', '#c084fc'],
  },
  {
    id: 'dark-forest',
    name: {
      en: 'Emerald Honeycomb',
      az: 'Zümrüd Pətək',
      tr: 'Zümrüt Petek',
      ru: 'Изумрудные Соты',
    },
    offlineHalfSize: 19200,
    onlineHalfSize: 18600,
    bgColor: '#072418',
    bgAccentColor: '#064e3b',
    gridColor: 'rgba(52, 211, 153, 0.14)',
    borderColor: '#10b981',
    patternStyle: 'hex',
    orbPalette: ['#4ade80', '#2dd4bf', '#a3e635', '#facc15', '#34d399'],
  },
  {
    id: 'lava-arena',
    name: {
      en: 'Crimson Magma',
      az: 'Vulkan Maqması',
      tr: 'Kızıl Volkan',
      ru: 'Багровый Вулкан',
    },
    offlineHalfSize: 19000,
    onlineHalfSize: 18400,
    bgColor: '#2b0d09',
    bgAccentColor: '#7c2d12',
    gridColor: 'rgba(251, 146, 60, 0.15)',
    borderColor: '#f97316',
    patternStyle: 'diamond',
    orbPalette: ['#fb923c', '#facc15', '#f87171', '#fdba74', '#ef4444'],
  },
  {
    id: 'cryo-matrix',
    name: {
      en: 'Arctic Frost',
      az: 'Şimal Buzlağı',
      tr: 'Kuzey Buzulu',
      ru: 'Северный Лёд',
    },
    offlineHalfSize: 19200,
    onlineHalfSize: 18600,
    bgColor: '#082038',
    bgAccentColor: '#0c4a6e',
    gridColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
    patternStyle: 'hex',
    orbPalette: ['#7dd3fc', '#38bdf8', '#e2e8f0', '#93c5fd', '#2dd4bf'],
  },
  {
    id: 'royal-violet',
    name: {
      en: 'Cyber Synthwave',
      az: 'Neon Sintveyv',
      tr: 'Neon Synthwave',
      ru: 'Неоновый Синтвейв',
    },
    offlineHalfSize: 19400,
    onlineHalfSize: 18800,
    bgColor: '#220836',
    bgAccentColor: '#701a75',
    gridColor: 'rgba(232, 121, 249, 0.16)',
    borderColor: '#d946ef',
    patternStyle: 'grid',
    orbPalette: ['#e879f9', '#22d3ee', '#f43f5e', '#fde047', '#a855f7'],
  },
  {
    id: 'golden-desert',
    name: {
      en: 'Solar Temple',
      az: 'Qızıl Məbəd',
      tr: 'Altın Tapınak',
      ru: 'Золотой Храм',
    },
    offlineHalfSize: 19200,
    onlineHalfSize: 18600,
    bgColor: '#241a06',
    bgAccentColor: '#713f12',
    gridColor: 'rgba(250, 204, 21, 0.14)',
    borderColor: '#eab308',
    patternStyle: 'diamond',
    orbPalette: ['#facc15', '#fb923c', '#fde047', '#34d399', '#f59e0b'],
  },
  {
    id: 'abyss-ocean',
    name: {
      en: 'Mariana Abyss',
      az: 'Okean Dərinliyi',
      tr: 'Okyanus Derinliği',
      ru: 'Океанская Бездна',
    },
    offlineHalfSize: 19400,
    onlineHalfSize: 18800,
    bgColor: '#052229',
    bgAccentColor: '#134e4a',
    gridColor: 'rgba(45, 212, 191, 0.15)',
    borderColor: '#14b8a6',
    patternStyle: 'stars',
    orbPalette: ['#2dd4bf', '#38bdf8', '#a7f3d0', '#818cf8', '#fde047'],
  },
];

export const MAP_BY_ID: Record<MapId, ArenaMapSpec> = Object.fromEntries(
  ARENA_MAPS.map((m) => [m.id, m])
) as Record<MapId, ArenaMapSpec>;

export function getMapSpec(id: MapId): ArenaMapSpec {
  return MAP_BY_ID[id] || ARENA_MAPS[0];
}
