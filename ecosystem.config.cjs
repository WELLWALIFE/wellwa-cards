// pm2 process map for the VPS (/opt/neuraledge/app) — mirrors what is running live (2026-09-17).
// Recreate everything after a reboot/rebuild with: pm2 start ecosystem.config.cjs && pm2 save
const cwd = "/opt/neuraledge/app";
const cron = (name, script, cron_restart, args) => ({ name, script: `${cwd}/bridge/${script}`, cwd, args, cron_restart, autorestart: false, interpreter: "/usr/bin/node" });
module.exports = {
  apps: [
    { name: "neuraledge-app", script: "/usr/bin/npm", args: "start -- -p 3001", cwd, autorestart: true },
    { name: "neuraledge-bridge", script: `${cwd}/bridge/manager.mjs`, cwd, autorestart: true, interpreter: "/usr/bin/node" },
    // media worker: Node heap capped so sharp/ffmpeg children keep their share of the 3.6 GB box
    { name: "neuraledge-media", script: `${cwd}/bridge/media-worker.mjs`, cwd, autorestart: true, interpreter: "/usr/bin/node", node_args: "--max-old-space-size=700", max_memory_restart: "900M", kill_timeout: 10000 },
    cron("neuraledge-banner", "banner-daily.mjs", "30 23 * * *"),
    // neuraledge-poster (poster-engine.mjs at 04:30 IST) was removed on 29 Sep 2026: it painted an AI base art every day
    // whether or not anyone used it. Posters take a stock photo first and paint only on demand (ensureBaseArt).
    // One-time on the server: pm2 delete neuraledge-poster && pm2 save
    cron("neuraledge-report", "monthly-report.mjs", "0 3 1 * *"),
    cron("neuraledge-autoreply", "social-autoreply.mjs", "*/30 * * * *"),
    cron("neuraledge-crm", "crm-reminders.mjs", "*/15 * * * *"),
    cron("neuraledge-webhooks", "crm-webhooks.mjs", "* * * * *"),
    cron("neuraledge-broadcast", "wa-broadcast.mjs", "* * * * *"),
    cron("neuraledge-autopost", "social-autopost.mjs", "30 22 * * *"),            // 4:00 AM IST
    cron("neuraledge-prerender", "social-autopost.mjs", "30 6 * * *", "--prerender"), // 12 noon IST
  ],
};
