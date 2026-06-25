module.exports = {
  apps: [
    {
      name: "haajari-backend",
      script: "./dist/index.js",
      instances: "max", // Runs backend in cluster mode matching CPU core count
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
