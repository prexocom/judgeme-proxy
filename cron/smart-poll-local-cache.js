const axios = require("axios");
require("dotenv").config();

const BIN_ID = process.env.JSONBIN_BIN_ID;
const BIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const SHOP_DOMAIN = process.env.SHOP_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PROXY_BASE_URL = process.env.PROXY_BASE_URL;

async function loadCache() {
  try {
    const res = await axios.get(JSONBIN_URL, {
      headers: { "X-Master-Key": BIN_API_KEY }
    });
    return res.data.record || {};
  } catch (err) {
    console.error("❌ Error loading cache from JSONBin:", err.message);
    return {};
  }
}

async function saveCache(data) {
  try {
    await axios.put(`${JSONBIN_URL}`, data, {
      headers: {
        "X-Master-Key": process.env.JSONBIN_API_KEY,
        "X-Access-Key": process.env.JSONBIN_ACCESS_KEY, // ⬅️ new
        "Content-Type": "application/json"
      }
    });
    console.log("✅ Cache written to JSONBin successfully.");
  } catch (err) {
    console.error("❌ Failed to write cache to JSONBin:", err.response?.data || err.message);
  }
}


async function fetchAllProducts() {
  const res = await axios.get(`https://${SHOP_DOMAIN}/admin/api/2024-04/products.json?limit=250`, {
    headers: { "X-Shopify-Access-Token": ADMIN_TOKEN }
  });
  return res.data.products.map(p => ({ id: p.id, handle: p.handle }));
}

async function fetchLatestReviewTimestamp(productHandle) {
  try {
    const productRes = await axios.get(`https://${SHOP_DOMAIN}/products/${productHandle}.json`);
    const productId = productRes.data.product.id;

    const res = await axios.get(`${PROXY_BASE_URL}/judgeme-reviews`, {
      params: { product_id: productId }
    });

    const reviews = res.data.reviews || [];
    const sorted = reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted[0]?.created_at || null;
  } catch (err) {
    console.error(`❌ Error fetching reviews for ${productHandle}:`, err.message);
    return null;
  }
}

async function generateSummary(productHandle) {
  try {
    const res = await axios.get(`${PROXY_BASE_URL}/review-summary`, {
      params: { product_handle: productHandle }
    });
    return res.data.summary || null;
  } catch (err) {
    console.error(`❌ Error generating summary for ${productHandle}:`, err.message);
    return null;
  }
}

async function main() {
  const cache = await loadCache();
  const products = await fetchAllProducts();
  console.log(`📦 Found ${products.length} products`);

  for (const { handle } of products) {
    const cached = cache[handle];
    const cachedTimestamp = cached?.lastReviewedAt;

    console.log(`🔍 Checking ${handle}...`);
    const latestReviewAt = await fetchLatestReviewTimestamp(handle);
    if (!latestReviewAt) {
      console.log(`⏩ No reviews for ${handle}, skipping.`);
      continue;
    }

    const isNew = !cachedTimestamp || new Date(latestReviewAt) > new Date(cachedTimestamp);
    if (isNew) {
      console.log(`✨ New review detected for ${handle}, generating summary...`);
      const summary = await generateSummary(handle);
      if (summary) {
        cache[handle] = { lastReviewedAt: latestReviewAt, summary };
        console.log(`✅ Updated summary for ${handle}`);
      } else {
        console.log(`⚠️ Failed to generate summary for ${handle}`);
      }
    } else {
      console.log(`✅ No new reviews for ${handle}`);
    }
  }

  await saveCache(cache);
  console.log("📦 All summaries updated.");
}

main();
