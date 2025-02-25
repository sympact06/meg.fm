import { ColorResolvable } from 'discord.js';

type ColorScheme = {
  primary: ColorResolvable;
  secondary: ColorResolvable;
  text: ColorResolvable;
};

const colorSchemes: ColorScheme[] = [
  {
    primary: '#1DB954' as ColorResolvable, // Spotify green
    secondary: '#1ed760' as ColorResolvable,
    text: '#FFFFFF' as ColorResolvable,
  },
  {
    primary: '#FF6B6B' as ColorResolvable, // Coral
    secondary: '#FF8787' as ColorResolvable,
    text: '#FFFFFF' as ColorResolvable,
  },
  {
    primary: '#4A90E2' as ColorResolvable, // Blue
    secondary: '#5AA0F2' as ColorResolvable,
    text: '#FFFFFF' as ColorResolvable,
  },
  {
    primary: '#9B59B6' as ColorResolvable, // Purple
    secondary: '#AB69C6' as ColorResolvable,
    text: '#FFFFFF' as ColorResolvable,
  },
  {
    primary: '#F1C40F' as ColorResolvable, // Yellow
    secondary: '#F4D03F' as ColorResolvable,
    text: '#000000' as ColorResolvable,
  },
];

export function extractColors(imageUrl: string): ColorScheme {
  // Use a deterministic way to select colors based on the URL
  const hash = imageUrl.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const index = Math.abs(hash) % colorSchemes.length;
  return colorSchemes[index];
}
