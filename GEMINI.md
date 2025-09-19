# Project Overview

This is an AI Fitness Coach application designed to help users track and improve their fitness. It connects to smart scales and HealthKit to monitor weight, includes a calorie tracker, and uses AI to provide holistic recommendations based on weight, eating habits, emotional state, and sleep.

**Key Technologies:**

*   **Framework:** Next.js
*   **Database and Auth:** Supabase
*   **Vector Storage:** Pinecone
*   **Background Processing:** Inngest
*   **Hosting:** Vercel
*   **UI:** Tailwind CSS, Shadcn UI
*   **AI:** Vercel AI SDK, OpenAI

**Architecture:**

The application is a full-stack Next.js application. The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API routes and serverless functions. Supabase is used for the PostgreSQL database and user authentication. Inngest is used for long-running API calls to LLMs and background processes.

# Building and Running

**1. Installation:**

```bash
npm install
```

**2. Environment Variables:**

Copy the `.env.example` file to `.env.local` and add your Supabase credentials and other required API keys.

```bash
cp env.example .env.local
```

**3. Running the Development Server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

**4. Building for Production:**

```bash
npm run build
```

**5. Running in Production:**

```bash
npm run start
```

**6. Linting:**

```bash
npm run lint
```

# Development Conventions

*   **Coding Style:** The project uses ESLint to enforce a consistent coding style. Run `npm run lint` to check for and fix linting errors.
*   **Testing:** The project uses Jest for testing. (TODO: Add instructions on how to run tests).
*   **Commits:** (TODO: Add commit message conventions if any).
*   **Database Migrations:** Database schema changes are managed through migration files in the `supabase/migrations` directory.
