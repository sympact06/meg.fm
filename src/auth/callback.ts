import { Express, Request, Response } from 'express';
import querystring from 'querystring';
import axios from 'axios';
import { URLSearchParams } from 'url';
import { getDiscordIdFromState, removeState } from './authorize';
import { setTokens } from '../db/database';

export function callbackRoute(app: Express) {
  app.get('/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!state) {
      res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
      return;
    }

    const discordId = getDiscordIdFromState(state);
    if (!discordId) {
      res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
      return;
    }

    try {
      const tokens = await exchangeCodeForToken(code);
      const expires_at = Math.floor(Date.now() / 1000) + tokens.expires_in;
      await setTokens(discordId, tokens.access_token, tokens.refresh_token, expires_at);
      removeState(state);
      res.send('Authorization successful! You can now return to Discord.');
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
    }
  });
}

async function exchangeCodeForToken(code: string): Promise<any> {
  const client_id = process.env.SPOTIFY_CLIENT_ID!;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirect_uri = process.env.REDIRECT_URI!;

  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri
    }).toString(),
    {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data;
}
