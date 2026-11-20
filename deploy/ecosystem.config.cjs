module.exports = {
  apps: [
    {
      name: 'rf-link-planner-api',
      script: 'apps/api/dist/index.js',
      cwd: '/opt/apps/rf-link-planner',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3003',
        ELEVATION_DB_PATH: '/opt/apps/rf-link-planner/apps/api/data/elevation-cache.db',
      },
    },
  ],
};
