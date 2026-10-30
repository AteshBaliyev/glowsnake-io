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
    offlineHalfSize: 6400, // Spacious 12,800 x 12,800 for 80-150 snakes
    onlineHalfSize: 4500,  // Spacious 9,000 x 9,000 for 50-60 snakes
    bgColor: '#12151e',
    gridColor: 'rgba(255, 255, 255, 0.038)',
    borderColor: '#475569',
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
    offlineHalfSize: 6600,
    onlineHalfSize: 4600,
    bgColor: '#0d101b',
    gridColor: 'rgba(148, 163, 184, 0.04)',
    borderColor: '#6366f1',
    orbPalette: ['#818cf8', '#38bdf8', '#fde047', '#f472b6', '#c084fc'],
  },
  {
    id: 'dark-forest',
    name: {
      en: 'Emerald Woods',
      az: 'Zümrüd Meşə',
      tr: 'Zümrüt Orman',
      ru: 'Изумрудный Лес',
    },
    offlineHalfSize: 6400,
    onlineHalfSize: 4500,
    bgColor: '#0f1a14',
    gridColor: 'rgba(134, 239, 172, 0.038)',
    borderColor: '#22c55e',
    orbPalette: ['#4ade80', '#2dd4bf', '#a3e635', '#facc15', '#34d399'],
  },
  {
    id: 'lava-arena',
    name: {
      en: 'Crimson Ember',
      az: 'Vulkan Torpağı',
      tr: 'Kızıl Volkan',
      ru: 'Багровый Вулкан',
    },
    offlineHalfSize: 6200,
    onlineHalfSize: 4400,
    bgColor: '#1a1210',
    gridColor: 'rgba(253, 186, 116, 0.038)',
    borderColor: '#ea580c',
    orbPalette: ['#fb923c', '#facc15', '#f87171', '#fdba74', '#ef4444'],
  },
  {
    id: 'cryo-matrix',
    name: {
      en: 'Nordic Frost',
      az: 'Şimal Buzlağı',
      tr: 'Kuzey Buzulu',
      ru: 'Северный Лёд',
    },
    offlineHalfSize: 6400,
    onlineHalfSize: 4500,
    bgColor: '#0f1822',
    gridColor: 'rgba(186, 230, 253, 0.04)',
    borderColor: '#38bdf8',
    orbPalette: ['#7dd3fc', '#38bdf8', '#cbd5e1', '#93c5fd', '#2dd4bf'],
  },
];

export const MAP_BY_ID: Record<MapId, ArenaMapSpec> = Object.fromEntries(
  ARENA_MAPS.map((m) => [m.id, m])
) as Record<MapId, ArenaMapSpec>;

export function getMapSpec(id: MapId): ArenaMapSpec {
  return MAP_BY_ID[id] || ARENA_MAPS[0];
}
