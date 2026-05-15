import Groq from "groq-sdk";

// Singleton Groq client — server-side only
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
