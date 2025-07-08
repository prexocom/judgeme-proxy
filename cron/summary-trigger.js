const path = require("path");
const { exec } = require("child_process");

const cronPath = path.join(__dirname, "smart-poll-local-cache.js");

async function runSummaryCron() {
  return new Promise((resolve, reject) => {
    exec(`node ${cronPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Cron error: ${stderr}`);
        return reject(error);
      }
      console.log(`Cron output:\n${stdout}`);
      resolve();
    });
  });
}

module.exports = { runSummaryCron };
