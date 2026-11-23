import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.devagupt.fit30',
  appName: 'Fit30',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_fit30',
      iconColor: '#B995AF',
    },
  },
};

export default config;
