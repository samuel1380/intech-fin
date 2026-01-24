declare namespace NodeJS {
    interface ProcessEnv {
        readonly AI_BASE_URL: string;
        readonly AI_MODEL: string;
        readonly OPENAI_API_KEY: string;
        readonly VITE_SUPABASE_URL: string;
        readonly VITE_SUPABASE_ANON_KEY: string;
    }
}

declare var process: {
    env: NodeJS.ProcessEnv;
};
