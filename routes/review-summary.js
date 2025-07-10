const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/review-summary", async (req, res) => {
  const { product_handle } = req.query;

  if (!product_handle) {
    return res.status(400).json({ error: "Missing product_handle" });
  }

  try {
    // Step 1: Get product ID
    const productRes = await axios.get(`https://${process.env.SHOP_DOMAIN}/products/${product_handle}.json`);
    const productId = productRes.data.product.id;

    // Step 2: Get filtered reviews from your proxy
    const reviewsRes = await axios.get(`${process.env.PROXY_BASE_URL}/judgeme-reviews`, {
      params: { product_id: productId }
    });

    const reviews = reviewsRes.data.reviews || [];

    // ⛔ Skip if less than 3 reviews
    if (reviews.length < 3) {
      return res.json({ summary: "Not enough reviews to summarize yet." });
    }

    // Step 3: Prepare review text
    const combinedText = reviews.map(r => r.body).join("\n\n");

    console.log("📝 Review sample:", combinedText.slice(0, 300));

    // Step 4: Ask Groq to summarize in a short, clean tone
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [
          {
            role: "user",
            content: `Summarize these customer reviews in 2-3 concise sentences max 40 words.

            Capture what customers like most, mention any mixed or varied feedback briefly, and note overall impressions or typical uses. Write in a clear, neutral, and helpful style similar to Amazon review summaries, avoiding hype or vague praise.

            Return only the summary—no intros, conclusions, or extra text.

            ${combinedText}`

          }
        ],
        temperature: 0.5,
        max_tokens: 70
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const summaryText = response.data.choices[0].message.content.trim();
    res.json({ summary: summaryText });

  } catch (err) {
    console.error("❌ Error generating summary:");
    if (err.response?.data) {
      console.error("Groq response:", err.response.data);
    } else {
      console.error(err.message);
    }
    res.status(500).json({ error: "Failed to generate review summary" });
  }
});

module.exports = router;