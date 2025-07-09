const express = require("express");
const { runSummaryCron } = require("../cron/summary-trigger");

const router = express.Router();

router.get("/trigger-review-summary-update", async (req, res) => {
  const token = req.query.token;

  if (token !== process.env.SUMMARY_TRIGGER_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    await runSummaryCron();
    res.json({ status: "✅ Summary update triggered successfully." });
  } catch (err) {
    console.error("❌ Cron trigger failed:", err.message);
    res.status(500).json({ error: "Failed to trigger summary update." });
  }
});


module.exports = router;
