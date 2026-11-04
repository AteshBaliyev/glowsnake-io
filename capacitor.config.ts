import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.baliyews.glowsnake',
  appName: 'GlowSnake.io',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#13161f',
  },
};

export default config;
