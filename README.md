# meg.fm

A self-hosted alternative to fmbot using Spotify integration for Discord music tracking and statistics.

## Features

- Track your Spotify listening history
- Compare music taste with other users
- View detailed listening statistics
- Achievement system
- Friend system
- Special effects and customization

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0.0)
- Node.js (>= 16.x)
- SQLite3
- A Discord Bot Token
- Spotify API credentials

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/meg.fm.git
cd meg.fm
```

2. Install dependencies:

```bash
bun install
```

3. Create a `.env` file in the root directory with the following variables:

```env
# Discord
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=your_callback_url

# Database
DATABASE_PATH=./data.sqlite
```

4. Build the project:

```bash
bun run build
```

## Usage

### Development

```bash
bun run dev
```

### Production

```bash
bun run start
```

### Code Quality

- Run linter: `bun run lint`
- Fix linting issues: `bun run lint:fix`
- Format code: `bun run format`
- Check formatting: `bun run format:check`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
