import { Express, Request, Response } from 'express';
import querystring from 'querystring';

const oauthStates = new Map<string, string>(); // state: discordId

export function loginRoute(app: Express) {
  const client_id = process.env.SPOTIFY_CLIENT_ID!;
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI!;
  const scope = 'user-read-playback-state user-read-currently-playing';

  app.get('/login', (req: Request, res: Response) => {
    const discordId = req.query.discordId as string;
    if (!discordId) {
      res.status(400).send('Missing discordId parameter.');
      return;
    }
    const state = generateRandomString(16);
    oauthStates.set(state, discordId);

    const authQueryParameters = querystring.stringify({
      response_type: 'code',
      client_id,
      scope,
      redirect_uri,
      state
    });
    res.redirect(`https://accounts.spotify.com/authorize?${authQueryParameters}`);
  });
}

export function getDiscordIdFromState(state: string): string | undefined {
  return oauthStates.get(state);
}

export function removeState(state: string): void {
  oauthStates.delete(state);
}

function generateRandomString(length: number): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
