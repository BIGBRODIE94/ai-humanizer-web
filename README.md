# Advanced AI Humanizer Web App

![AI Humanizer Banner](https://img.shields.io/badge/AI_Humanizer-v1.0-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-green?style=for-the-badge&logo=openai)

An advanced web application built to detect AI-generated text and rewrite it using an adversarial multi-pass feedback loop to achieve a 100% human-written score. 

## 📖 Summary

With the rise of AI detectors (like GPTZero, Originality.ai, and Turnitin), generated text is often easily flagged due to low "burstiness" and predictable vocabulary. The **Advanced AI Humanizer** solves this by offering two core features:
1. **AI Detector:** An ultra-accurate text analyzer that scores the probability of text being AI or Human generated, while explaining its reasoning.
2. **AI Humanizer:** A recursive, adversarial rewriting engine. It takes AI text, rewrites it, runs it through the internal detector, and if it doesn't score 100% human, it feeds the critique back into the AI to try again until perfection is achieved.

## 🏗 Detailed Design & Architecture

This application is built using a modern React/Next.js stack, ensuring high performance, secure API handling, and a beautiful user interface.

### Tech Stack
- **Frontend Framework:** Next.js 15 (App Router)
- **UI & Styling:** React, Tailwind CSS
- **Backend API:** Next.js Serverless Route Handlers
- **AI Provider:** OpenAI API (GPT-4o)

### How the Humanizer Engine Works
The true power of this app lies in `lib/ai.ts`, specifically the `humanizeTextAdversarial` function. 
Instead of a simple one-shot prompt, the app utilizes an adversarial loop:
1. **Generation:** The Ghostwriter prompt rewrites the text, deliberately injecting high burstiness (varying sentence lengths), high perplexity (uncommon vocabulary), and authentic human flaws (contractions, slight colloquialisms).
2. **Evaluation:** The text is immediately sent to the Detector prompt, which acts as a strict AI-detection judge.
3. **Feedback Loop:** If the Detector scores the text below 99% Human, it generates feedback (e.g., "Too formal, still uses generic transitions"). This feedback is injected back into the Ghostwriter prompt, and the cycle repeats up to 3-5 times until a 100% Human rating is locked in.

## 🚀 How-To Guide

### Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BIGBRODIE94/ai-humanizer-web.git
   cd ai-humanizer-web
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root of the project and add your OpenAI API Key:
   ```env
   OPENAI_API_KEY=sk-proj-your-api-key-here
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Deployment (Vercel)
The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

1. Push your code to your GitHub repository.
2. Log into Vercel and click **Import Project**.
3. Select your repository.
4. Go to **Environment Variables** in the setup screen and add `OPENAI_API_KEY`.
5. Click **Deploy**. Your app will be live globally in under 2 minutes!

*(Note: The adversarial loop can take up to 10-20 seconds. If you are on Vercel's free hobby tier, serverless functions timeout at 10s. For the full multi-pass loop to work without timing out on Vercel, you may need a Pro account or you can lower the `maxAttempts` in `lib/ai.ts`).*

## 💻 Commands

Here are the standard commands you can use while developing:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local development server on port 3000. |
| `npm run build` | Compiles and builds the Next.js application for production. |
| `npm start` | Runs the compiled production build locally. |
| `npm run lint` | Runs ESLint to catch and fix code issues. |

## 🧠 Core System Prompts

For developers interested in the prompt engineering behind the tool:
- **The Ghostwriter (Humanizer):** Instructed to avoid words like "delve", "tapestry", and "furthermore". Forced to break conventional pacing and use unpredictable phrasing.
- **The Judge (Detector):** Instructed to look for low burstiness, overly balanced tones, and generic AI transition words to flag text as artificial.