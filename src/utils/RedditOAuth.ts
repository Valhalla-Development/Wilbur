import axios from 'axios';
import { config } from '../config/Config.js';

export interface RedditOAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

export interface DiscordOAuthUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    verified: boolean;
    email: string | null;
}

export class RedditOAuthManager {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        // Initialize with stored tokens if available
        this.accessToken = config.REDDIT_OAUTH_ACCESS_TOKEN || null;
        this.refreshToken = config.REDDIT_OAUTH_REFRESH_TOKEN || null;
    }

    /**
     * Generate Reddit OAuth URL for user authorization
     * @param state - State parameter for CSRF protection
     * @returns Authorization URL
     */
    getRedditAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: config.REDDIT_CLIENT_ID!,
            response_type: 'code',
            state: state,
            redirect_uri: config.REDDIT_REDIRECT_URI!,
            duration: 'permanent',
            scope: 'submit,read,identity'
        });

        return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
    }

    /**
     * Generate Discord OAuth URL for user authorization
     * @param state - State parameter for CSRF protection
     * @returns Authorization URL
     */
    getDiscordAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: config.DISCORD_OAUTH_CLIENT_ID!,
            redirect_uri: config.DISCORD_OAUTH_REDIRECT_URI!,
            response_type: 'code',
            scope: 'identify email',
            state: state
        });

        return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Exchange Discord authorization code for access token
     * @param code - Authorization code from Discord
     * @returns Discord user information
     */
    async exchangeDiscordCode(code: string): Promise<DiscordOAuthUser> {
        try {
            // Exchange code for access token
            const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
                new URLSearchParams({
                    client_id: config.DISCORD_OAUTH_CLIENT_ID!,
                    client_secret: config.DISCORD_OAUTH_CLIENT_SECRET!,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: config.DISCORD_OAUTH_REDIRECT_URI!
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const { access_token } = tokenResponse.data;

            // Get user information
            const userResponse = await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${access_token}`
                }
            });

            return userResponse.data;
        } catch (error) {
            console.error('Error exchanging Discord code:', error);
            throw new Error('Failed to authenticate with Discord');
        }
    }

    /**
     * Exchange Reddit authorization code for access token
     * @param code - Authorization code from Reddit
     * @returns Token information
     */
    async exchangeRedditCode(code: string): Promise<RedditOAuthTokens> {
        try {
            const auth = Buffer.from(`${config.REDDIT_CLIENT_ID}:${config.REDDIT_CLIENT_SECRET}`).toString('base64');
            
            const response = await axios.post('https://www.reddit.com/api/v1/access_token',
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: config.REDDIT_REDIRECT_URI!
                }),
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'DiscordBot:Wilbur:v1.0.0 (by /u/your_reddit_username)'
                    }
                }
            );

            const tokens = response.data;
            
            // Store tokens
            this.accessToken = tokens.access_token;
            this.refreshToken = tokens.refresh_token;
            this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

            return tokens;
        } catch (error) {
            console.error('Error exchanging Reddit code:', error);
            throw new Error('Failed to authenticate with Reddit');
        }
    }

    /**
     * Refresh Reddit access token using refresh token
     * @returns New token information
     */
    async refreshAccessToken(): Promise<RedditOAuthTokens> {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const auth = Buffer.from(`${config.REDDIT_CLIENT_ID}:${config.REDDIT_CLIENT_SECRET}`).toString('base64');
            
            const response = await axios.post('https://www.reddit.com/api/v1/access_token',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken
                }),
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'DiscordBot:Wilbur:v1.0.0 (by /u/your_reddit_username)'
                    }
                }
            );

            const tokens = response.data;
            
            // Update stored tokens
            this.accessToken = tokens.access_token;
            this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

            return tokens;
        } catch (error) {
            console.error('Error refreshing Reddit token:', error);
            throw new Error('Failed to refresh Reddit access token');
        }
    }

    /**
     * Get valid access token (refresh if necessary)
     * @returns Valid access token
     */
    async getValidAccessToken(): Promise<string> {
        // Check if token is expired or will expire soon (5 minute buffer)
        if (!this.accessToken || Date.now() >= (this.tokenExpiry - 300000)) {
            await this.refreshAccessToken();
        }

        if (!this.accessToken) {
            throw new Error('No valid access token available');
        }

        return this.accessToken;
    }

    /**
     * Make authenticated request to Reddit API
     * @param endpoint - Reddit API endpoint
     * @param method - HTTP method
     * @param data - Request data
     * @returns API response
     */
    async makeRedditRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
        const accessToken = await this.getValidAccessToken();
        
        const config = {
            method,
            url: `https://oauth.reddit.com${endpoint}`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'DiscordBot:Wilbur:v1.0.0 (by /u/your_reddit_username)',
                'Content-Type': 'application/json'
            },
            data
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('Reddit API request failed:', error);
            throw error;
        }
    }

    /**
     * Submit a post to Reddit using OAuth
     * @param subreddit - Subreddit name
     * @param title - Post title
     * @param text - Post text (for self posts)
     * @param url - URL (for link posts)
     * @param flair - Post flair
     * @returns Post submission result
     */
    async submitPost(subreddit: string, title: string, text?: string, url?: string, flair?: string): Promise<any> {
        const postData: any = {
            sr: subreddit,
            title: title,
            kind: url ? 'link' : 'self'
        };

        if (url) {
            postData.url = url;
        } else if (text) {
            postData.text = text;
        }

        // Submit the post
        const result = await this.makeRedditRequest('/api/submit', 'POST', postData);

        // Apply flair if specified
        if (flair && result.json?.data?.name) {
            try {
                await this.makeRedditRequest('/api/selectflair', 'POST', {
                    link: result.json.data.name,
                    text: flair,
                    api_type: 'json'
                });
            } catch (error) {
                console.warn('Failed to apply flair:', error);
            }
        }

        return result;
    }
}

// Export singleton instance
export const redditOAuth = new RedditOAuthManager(); 