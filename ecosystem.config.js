module.exports = {
  apps: [
    {
      name: 'glowsnake-io',
      script: 'node_modules/.bin/tsx',
      args: 'server.ts --prod',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_SERVER_URL: 'https://vps-2613da52.vps.rcld.dev',
      },
    },
  ],
};
