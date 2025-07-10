const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');

const app = express();
dotenv.config();

const cronTriggerRoute = require("./routes/cron-trigger");
app.use("/", cronTriggerRoute);

const cache = new NodeCache({ stdTTL: 600 }); // 10 min cache

const reviewSummaryRoutes = require('./routes/review-summary');

app.get('/', (req, res) => {
  res.send('Judge.me proxy is live!');
});

app.get('/judgeme-reviews', async (req, res) => {
  const productId = req.query.product_id;

  if (!productId) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  const cacheKey = `reviews_${productId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Serving cached reviews for product ${productId}`);
    return res.setHeader('Access-Control-Allow-Origin', '*').json({ reviews: cached });
  }

  try {
    let page = 1;
    const allReviews = [];

    while (true) {
      const response = await axios.get('https://judge.me/api/v1/reviews', {
        params: {
          api_token: process.env.JUDGEME_API_TOKEN,
          shop_domain: process.env.SHOP_DOMAIN,
          page,
        }
      });

      const reviews = response.data.reviews;
      if (!reviews || reviews.length === 0) break;

      allReviews.push(...reviews);
      if (reviews.length < 10) break;
      page++;
    }

    const filtered = allReviews
      .filter(r => r.product_external_id.toString() === productId)
      .filter(r => r.rating >= 5)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        reviewer: r.reviewer.name,
        created_at: r.created_at,
        pictures: r.pictures.map(p => p.urls.original),
        product_title: r.product_title,
        product_handle: r.product_handle
      }));

    console.log(`Total reviews fetched: ${allReviews.length}, filtered: ${filtered.length}`);
    cache.set(cacheKey, filtered);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ reviews: filtered });
  } catch (err) {
    console.error('API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Register the review summary route
app.use(reviewSummaryRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
