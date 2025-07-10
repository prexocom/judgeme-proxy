const express = require("express");
const axios = require("axios");

const router = express.Router();

// Get from .env
const BIN_ID = process.env.JSONBIN_BIN_ID;
const BIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// GET /cached-summary?product_handle=xyz
router.get("/cached-summary", async (req, res) => {
  const handle = req.query.product_handle;

  if (!handle) {
    return res.status(400).json({ error: "Missing product_handle" });
  }

  try {
    // 🔁 Load JSONBin
    const response = await axios.get(JSONBIN_URL, {
      headers: {
        "X-Master-Key": BIN_API_KEY
      }
    });

    const cache = response.data.record || {};

    if (!cache[handle]) {
      return res.status(404).json({ error: "No summary found for this product." });
    }

    const { summary, lastReviewedAt } = cache[handle];

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ summary, lastReviewedAt });

  } catch (err) {
    console.error("❌ Error reading from JSONBin:", err.message);
    res.status(500).json({ error: "Failed to read review summary from cache." });
  }
});

module.exports = router;
