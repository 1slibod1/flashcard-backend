import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/*
========================================
  SIMPLE IN-MEMORY DATABASE
========================================
*/

const users = {};

/*
========================================
  HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
  res.json({ message: "Flashcard backend is running" });
});

/*
========================================
  REGISTER
========================================
*/

app.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  if (users[email]) {
    return res.status(400).json({ error: "User already exists" });
  }

  users[email] = {
    password,
    remaining: 10
  };

  res.json({
    token: email,
    remaining: 10
  });
});

/*
========================================
  LOGIN
========================================
*/

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users[email];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({
    token: email,
    remaining: user.remaining
  });
});

/*
========================================
  GENERATE FLASHCARDS (AI VERSION)
========================================
*/

app.post("/generate", async (req, res) => {
  try {
    const { text } = req.body;
    const token = req.headers.authorization;

    if (!token || !users[token]) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = users[token];

    if (user.remaining <= 0) {
      return res.status(403).json({ error: "Generation limit reached" });
    }

    if (!text) {
      return res.status(400).json({ error: "Text required" });
    }

    user.remaining -= 1;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a flashcard generator. Create 5 high quality study flashcards in JSON format."
        },
        {
          role: "user",
          content: `Create 5 flashcards from this text. Return ONLY valid JSON array like:
[
  {"question": "...", "answer": "..."}
]

Text:
${text}`
        }
      ],
      temperature: 0.7
    });

    const raw = completion.choices[0].message.content;

    const flashcards = JSON.parse(raw);

    res.json({
      flashcards,
      remaining: user.remaining
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

/*
========================================
  404 FALLBACK
========================================
*/

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
