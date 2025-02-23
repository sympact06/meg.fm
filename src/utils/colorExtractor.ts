type ColorScheme = {
  primary: string;
  secondary: string;
  text: string;
};

// Predefined color schemes that work well together
const colorSchemes: ColorScheme[] = [
  {
    primary: '#1DB954',    // Spotify green
    secondary: '#1ed760',
    text: '#FFFFFF'
  },
  {
    primary: '#FF6B6B',    // Coral
    secondary: '#FF8787',
    text: '#FFFFFF'
  },
  {
    primary: '#4A90E2',    // Blue
    secondary: '#5AA0F2',
    text: '#FFFFFF'
  },
  {
    primary: '#9B59B6',    // Purple
    secondary: '#AB69C6',
    text: '#FFFFFF'
  },
  {
    primary: '#F1C40F',    // Yellow
    secondary: '#F4D03F',
    text: '#000000'
  }
];

export function extractColors(imageUrl: string): ColorScheme {
  // Use a deterministic way to select colors based on the URL
  const hash = imageUrl.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const index = Math.abs(hash) % colorSchemes.length;
  return colorSchemes[index];
}
