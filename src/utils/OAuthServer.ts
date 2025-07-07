import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { config } from '../config/Config.js';
import { redditOAuth } from './RedditOAuth.js';

interface OAuthState {
    discordUserId?: string;
    timestamp: number;
    step: 'discord' | 'reddit';
}

export class OAuthServer {
    private server: any;
    private isRunning = false;
    private pendingStates = new Map<string, OAuthState>();

    constructor() {
        this.server = createServer(this.handleRequest.bind(this));
    }

    /**
     * Start the OAuth server
     */
    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                resolve();
                return;
            }

            const port = parseInt(config.OAUTH_SERVER_PORT || '3000');
            const host = config.OAUTH_SERVER_HOST || 'localhost';

            this.server.listen(port, host, () => {
                console.log(`OAuth server running on http://${host}:${port}`);
                this.isRunning = true;
                resolve();
            });

            this.server.on('error', (error: Error) => {
                console.error('OAuth server error:', error);
                reject(error);
            });
        });
    }

    /**
     * Stop the OAuth server
     */
    stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isRunning) {
                resolve();
                return;
            }

            this.server.close(() => {
                console.log('OAuth server stopped');
                this.isRunning = false;
                resolve();
            });
        });
    }

    /**
     * Generate authentication URL for Discord OAuth
     * @param discordUserId - Discord user ID to associate with the auth flow
     * @returns Discord OAuth URL
     */
    generateAuthUrl(discordUserId: string): string {
        const state = this.generateState();
        
        // Store the state with user info
        this.pendingStates.set(state, {
            discordUserId,
            timestamp: Date.now(),
            step: 'discord'
        });

        // Clean up old states (older than 10 minutes)
        this.cleanupOldStates();

        return redditOAuth.getDiscordAuthUrl(state);
    }

    /**
     * Handle HTTP requests to the OAuth server
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        
        try {
            if (url.pathname === '/auth/discord/callback') {
                await this.handleDiscordCallback(url, res);
            } else if (url.pathname === '/auth/reddit/callback') {
                await this.handleRedditCallback(url, res);
            } else if (url.pathname === '/') {
                this.sendResponse(res, 200, 'text/html', this.getIndexPage());
            } else {
                this.sendResponse(res, 404, 'text/plain', 'Not Found');
            }
        } catch (error) {
            console.error('OAuth server request error:', error);
            this.sendResponse(res, 500, 'text/plain', 'Internal Server Error');
        }
    }

    /**
     * Handle Discord OAuth callback
     */
    private async handleDiscordCallback(url: URL, res: ServerResponse) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
            console.error('Discord OAuth error:', error);
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Discord authentication failed'));
            return;
        }

        if (!code || !state) {
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Missing code or state parameter'));
            return;
        }

        const stateData = this.pendingStates.get(state);
        if (!stateData || stateData.step !== 'discord') {
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Invalid or expired state'));
            return;
        }

        try {
            // Exchange Discord code for user info
            const discordUser = await redditOAuth.exchangeDiscordCode(code);
            
            // Update state for Reddit auth
            stateData.step = 'reddit';
            this.pendingStates.set(state, stateData);

            // Generate Reddit OAuth URL
            const redditAuthUrl = redditOAuth.getRedditAuthUrl(state);
            
            // Redirect to Reddit OAuth
            res.writeHead(302, { 'Location': redditAuthUrl });
            res.end();

        } catch (error) {
            console.error('Discord code exchange error:', error);
            this.sendResponse(res, 500, 'text/html', this.getErrorPage('Failed to authenticate with Discord'));
        }
    }

    /**
     * Handle Reddit OAuth callback
     */
    private async handleRedditCallback(url: URL, res: ServerResponse) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
            console.error('Reddit OAuth error:', error);
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Reddit authentication failed'));
            return;
        }

        if (!code || !state) {
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Missing code or state parameter'));
            return;
        }

        const stateData = this.pendingStates.get(state);
        if (!stateData || stateData.step !== 'reddit') {
            this.sendResponse(res, 400, 'text/html', this.getErrorPage('Invalid or expired state'));
            return;
        }

        try {
            // Exchange Reddit code for tokens
            const tokens = await redditOAuth.exchangeRedditCode(code);
            
            // Clean up state
            this.pendingStates.delete(state);

            // Send success response
            this.sendResponse(res, 200, 'text/html', this.getSuccessPage(tokens));

            console.log(`OAuth flow completed successfully for Discord user ${stateData.discordUserId}`);

        } catch (error) {
            console.error('Reddit code exchange error:', error);
            this.sendResponse(res, 500, 'text/html', this.getErrorPage('Failed to authenticate with Reddit'));
        }
    }

    /**
     * Generate a secure random state parameter
     */
    private generateState(): string {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15) + 
               Date.now().toString(36);
    }

    /**
     * Clean up expired states (older than 10 minutes)
     */
    private cleanupOldStates() {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        for (const [state, data] of this.pendingStates) {
            if (data.timestamp < tenMinutesAgo) {
                this.pendingStates.delete(state);
            }
        }
    }

    /**
     * Send HTTP response
     */
    private sendResponse(res: ServerResponse, statusCode: number, contentType: string, body: string) {
        res.writeHead(statusCode, {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(body)
        });
        res.end(body);
    }

    /**
     * Get index page HTML
     */
    private getIndexPage(): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Wilbur OAuth Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        p { line-height: 1.6; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Wilbur OAuth Server</h1>
        <p>This server handles OAuth authentication for Reddit integration with Discord.</p>
        <p>To start the authentication process, use the Discord bot command or contact your server administrator.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Get success page HTML
     */
    private getSuccessPage(tokens: any): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #28a745; text-align: center; }
        p { line-height: 1.6; color: #666; }
        .token-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; font-size: 12px; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Authentication Successful!</h1>
        <p>Your Discord account has been successfully linked to Reddit for automated posting.</p>
        <p>You can now close this window and return to Discord.</p>
        <div class="token-info">
            <strong>Note:</strong> Store these tokens securely in your environment variables:
            <br><br>
            REDDIT_OAUTH_ACCESS_TOKEN=${tokens.access_token}
            <br>
            REDDIT_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Get error page HTML
     */
    private getErrorPage(message: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #dc3545; text-align: center; }
        p { line-height: 1.6; color: #666; }
        .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Authentication Error</h1>
        <div class="error">${message}</div>
        <p>Please try again or contact your server administrator if the problem persists.</p>
    </div>
</body>
</html>`;
    }
}

// Export singleton instance
export const oauthServer = new OAuthServer(); 