import { z } from 'zod';

// Helper transforms for common patterns
const stringToBoolean = (val: string): boolean => val.toLowerCase() === 'true';
const stringToArray = (val: string): string[] => {
    return val
        ? val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : [];
};

const configSchema = z.object({
    // Required bot token
    BOT_TOKEN: z.string().min(1, 'Oi mate, the BOT_TOKEN environment variable is missing!'),

    // Environment (defaults to development)
    NODE_ENV: z.enum(['development', 'production']).default('development'),

    // Discord support server invite link
    DISCORD_SUPPORT: z.string().optional(),

    // Optional comma-separated guild IDs (undefined = global, string[] = guild-specific)
    GUILDS: z
        .string()
        .optional()
        .transform((val) => (val ? stringToArray(val) : undefined)),

    // Logging settings
    ENABLE_LOGGING: z.string().optional().default('false').transform(stringToBoolean),
    LOGGING_CHANNEL: z.string().optional(),
    COMMAND_LOGGING_CHANNEL: z.string().optional(),

    // Valhalla API settings
    VALHALLA_API_URI: z
        .string()
        .min(1, 'Oi mate, the VALHALLA_API_URI environment variable is missing!'),
    VALHALLA_API_KEY: z
        .string()
        .min(1, 'Oi mate, the VALHALLA_API_KEY environment variable is missing!'),

    // Trello integration settings
    TRELLO_API_KEY: z.string().optional(),
    TRELLO_TOKEN: z.string().optional(),
    TRELLO_SUGGESTION_LIST: z.string().optional(),
    TRELLO_SUGGESTION_TEMPLATE: z.string().optional(),
    TRELLO_ISSUE_LIST: z.string().optional(),
    TRELLO_ISSUE_TEMPLATE: z.string().optional(),
    TRELLO_CHANNEL: z.string().optional(),

    // Reddit integration settings with OAuth
    REDDIT_POST: z.string().optional().default('false').transform(stringToBoolean),
    DISCORD_CHANNEL_ID: z.string().optional(),
    REDDIT_SUBREDDIT_NAME: z.string().optional(),
    REDDIT_FLAIR: z.string().optional(),
    REDDIT_CLIENT_ID: z.string().optional(),
    REDDIT_CLIENT_SECRET: z.string().optional(),
    
    // OAuth settings
    REDDIT_REDIRECT_URI: z.string().optional(),
    REDDIT_OAUTH_ACCESS_TOKEN: z.string().optional(),
    REDDIT_OAUTH_REFRESH_TOKEN: z.string().optional(),
    
    // Discord OAuth settings for Reddit integration
    DISCORD_OAUTH_CLIENT_ID: z.string().optional(),
    DISCORD_OAUTH_CLIENT_SECRET: z.string().optional(),
    DISCORD_OAUTH_REDIRECT_URI: z.string().optional(),
    
    // OAuth server settings
    OAUTH_SERVER_PORT: z.string().optional().default('3000'),
    OAUTH_SERVER_HOST: z.string().optional().default('localhost'),
});

// Parse config with error handling
let config: z.infer<typeof configSchema>;
try {
    config = configSchema.parse(process.env);

    // Validate logging channels required when logging is enabled
    if (config.ENABLE_LOGGING && !config.LOGGING_CHANNEL && !config.COMMAND_LOGGING_CHANNEL) {
        console.warn(
            "⚠️  Oi, if you're setting logging to true, make sure to pass both LOGGING_CHANNEL and COMMAND_LOGGING_CHANNEL along with it, mate! Logging will be disabled!"
        );
        config.ENABLE_LOGGING = false;
    }

    // Reddit configuration validation
    if (config.REDDIT_POST) {
        const requiredRedditVars = [
            'DISCORD_CHANNEL_ID',
            'REDDIT_SUBREDDIT_NAME',
            'REDDIT_CLIENT_ID',
            'REDDIT_CLIENT_SECRET',
            'REDDIT_REDIRECT_URI',
            'REDDIT_OAUTH_ACCESS_TOKEN',
            'REDDIT_OAUTH_REFRESH_TOKEN',
            'DISCORD_OAUTH_CLIENT_ID',
            'DISCORD_OAUTH_CLIENT_SECRET',
            'DISCORD_OAUTH_REDIRECT_URI',
        ];

        for (const varName of requiredRedditVars) {
            const value = config[varName as keyof typeof config];
            if (!value) {
                throw new Error(`Oi mate, when REDDIT_POST is true, ${varName} is required!`);
            }
        }
    }
} catch (error) {
    if (error instanceof z.ZodError) {
        const missingVars = error.issues
            .filter((issue) => issue.code === 'too_small' || issue.code === 'invalid_type')
            .map((issue) => issue.path[0])
            .join(', ');

        throw new Error(`Missing required environment variables: ${missingVars}`);
    }
    throw error;
}

export { config };
export const isDev = config.NODE_ENV === 'development';
