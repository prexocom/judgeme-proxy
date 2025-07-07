// 1. Import dependencies
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

// 2. Constants
const SHOP_DOMAIN = process.env.SHOP_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PROXY_BASE_URL = process.env.PROXY_BASE_URL;
const CACHE_PATH = path.join(__dirname, "../cache/review-summary-cache.json");

// 3. Utility functions
function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
}

function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), "utf-8");
    console.log("✅ Cache written to file successfully.");
  } catch (err) {
    console.error("❌ Failed to write cache to file:", err.message);
  }
}

async function fetchAllProducts() {
  const res = await axios.get(`https://${SHOP_DOMAIN}/admin/api/2024-04/products.json?limit=250`, {
    headers: { "X-Shopify-Access-Token": ADMIN_TOKEN }
  });
  return res.data.products.map(p => ({
    id: p.id,
    handle: p.handle,
  }));
}

async function fetchLatestReviewTimestamp(productHandle) {
  try {
    const productRes = await axios.get(`https://${SHOP_DOMAIN}/products/${productHandle}.json`);
    const productId = productRes.data.product.id;

    const res = await axios.get(`${PROXY_BASE_URL}/judgeme-reviews`, {
      params: { product_id: productId },
    });

    const reviews = res.data.reviews || [];
    const fiveStar = reviews
      .filter(r => r.rating >= 5)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return fiveStar[0]?.created_at || null;
  } catch (err) {
    console.error(`❌ Error fetching reviews for ${productHandle}:`, err.message);
    return null;
  }
}

async function generateSummary(productHandle) {
  try {
    const res = await axios.get(`${PROXY_BASE_URL}/review-summary`, {
      params: { product_handle: productHandle },
    });

    const summary = res.data.summary || [];

    return Array.isArray(summary) ? summary.join(" ") : summary;
  } catch (err) {
    console.error(`❌ Error generating summary for ${productHandle}:`, err.message);
    return null;
  }
}

// 4. Main script logic
async function main() {
  const cache = loadCache();
  const products = await fetchAllProducts();
  console.log(`📦 Found ${products.length} products`);

  for (const product of products) {
    const { handle } = product;
    const cached = cache[handle];
    const cachedTimestamp = cached?.lastReviewedAt;

    console.log(`🔍 Checking ${handle}...`);

    const latestReviewAt = await fetchLatestReviewTimestamp(handle);
    if (!latestReviewAt) {
      console.log(`⏩ No recent 5-star reviews for ${handle}, skipping.`);
      continue;
    }

    const isNew = !cachedTimestamp || new Date(latestReviewAt) > new Date(cachedTimestamp);

    if (isNew) {
      console.log(`✨ New review detected. Generating summary for ${handle}...`);
      const summary = await generateSummary(handle);

      if (summary) {
        cache[handle] = {
          lastReviewedAt: latestReviewAt,
          summary,
        };
        console.log(`✅ Updated summary for ${handle}`);
      } else {
        console.log(`⚠️ Failed to generate summary for ${handle}`);
      }
    } else {
      console.log(`✅ No new reviews for ${handle}`);
    }
  }

  saveCache(cache);
  console.log("📝 Cache updated.");
}

// 5. Run it
main();
