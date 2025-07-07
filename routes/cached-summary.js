const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const CACHE_PATH = path.join(__dirname, "../cache/review-summary-cache.json");

// GET /cached-summary?product_handle=xyz
router.get("/cached-summary", (req, res) => {
  const handle = req.query.product_handle;

  if (!handle) {
    return res.status(400).json({ error: "Missing product_handle" });
  }

  if (!fs.existsSync(CACHE_PATH)) {
    return res.status(500).json({ error: "Cache file not found." });
  }

  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));

  if (!cache[handle]) {
    return res.status(404).json({ error: "No summary found for this product." });
  }

  const { summary, lastReviewedAt } = cache[handle];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ summary, lastReviewedAt });
});

module.exports = router;
