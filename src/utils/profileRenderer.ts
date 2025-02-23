import sharp from 'sharp';
import { Achievement } from './achievements';
import { shiftColor } from './colorUtils';

// If you want to rely on system fonts (no custom font registration needed)
const FONTS = {
  REGULAR: 'Arial',
  BOLD: 'Arial Bold'
};

interface ProfileData {
  user: any;
  stats: any;
  topArtists: any[];
  achievements: {
    level: {
      level: number;
      currentXP: number;
      nextLevelXP: number;
      title: string;
    };
    recent: Achievement[];
  };
  profile: {
    accent_color: string;
    background_color?: string;
  };
}

export async function renderProfile(data: ProfileData): Promise<Buffer> {
  const safeData = ensureSafeData(data);

  // Fallback if accent color not provided
  const accentColor = safeData.profile.accent_color || '#FF0080';
  // Shift the accent color slightly for gradient variation
  const accentColorShifted = shiftColor(accentColor, 20);

  // Pink/Purple background gradient
  const svg = `
    <svg width="1100" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Main Background Gradient (Pink/Purple) -->
        <linearGradient id="backgroundGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#350035;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#150016;stop-opacity:1" />
        </linearGradient>
        
        <!-- Card Gradient -->
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.15" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.05" />
        </linearGradient>
        
        <!-- Accent Gradient (Pink) -->
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColorShifted};stop-opacity:1" />
        </linearGradient>
        
        <!-- Glow Filter -->
        <filter id="glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feColorMatrix in="blur" type="saturate" values="2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Main Background -->
      <rect width="1100" height="400" fill="url(#backgroundGrad)" />
      
      <!-- Main Card Container -->
      <rect 
        x="20" y="20" 
        width="1060" height="360" 
        rx="15" 
        fill="url(#cardGrad)" 
        stroke="${accentColor}" 
        stroke-opacity="0.4" 
        stroke-width="2" 
      />

      <!-- User Info Section -->
      ${renderUserSection(safeData)}

      <!-- Stats Section -->
      ${renderStatsSection(safeData)}

      <!-- Achievements Section -->
      ${renderAchievementsSection(safeData)}

      <!-- Artists Section -->
      ${renderArtistsSection(safeData)}
    </svg>
  `;

  // Fetch and process avatar (circular crop)
  const avatar = await fetchAndProcessAvatar(
    safeData.user.displayAvatarURL({ format: 'png', size: 256 })
  );

  // Composite the avatar onto the SVG
  return await sharp(Buffer.from(svg))
    .composite([
      {
        input: await sharp(avatar).resize(100, 100).toBuffer(),
        top: 40,
        left: 40,
      }
    ])
    .png()
    .toBuffer();
}

async function fetchAndProcessAvatar(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await sharp(Buffer.from(arrayBuffer))
    .resize(140, 140)
    .composite([
      {
        input: Buffer.from(`
          <svg>
            <circle cx="70" cy="70" r="70" fill="white"/>
          </svg>
        `),
        blend: 'dest-in'
      }
    ])
    .toBuffer();
}

function renderUserSection(data: ProfileData): string {
  const { username } = data.user;
  const { level, title, currentXP, nextLevelXP } = data.achievements.level;

  return `
    <g transform="translate(160, 50)">
      <!-- Username and Level -->
      <g filter="url(#glow)">
        <text 
          x="0" 
          y="30" 
          fill="white" 
          style="font-size: 32px; font-weight: bold; font-family: Arial, sans-serif;">
          ${username}
        </text>
      </g>
      
      <!-- Level Badge -->
      <g transform="translate(0, 45)">
        <rect width="200" height="30" rx="15" fill="url(#accentGrad)" />
        <text 
          x="100" 
          y="20" 
          text-anchor="middle" 
          fill="white" 
          style="font-size: 14px; font-family: Arial, sans-serif;">
          LEVEL ${level} • ${title}
        </text>
      </g>
      
      <!-- XP Bar -->
      <g transform="translate(0, 85)">
        <rect width="200" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect 
          width="${(currentXP / nextLevelXP) * 200}" 
          height="6" 
          rx="3" 
          fill="url(#accentGrad)">
          <animate 
            attributeName="opacity" 
            values="0.6;1;0.6" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        </rect>
        <text 
          x="0" 
          y="20" 
          fill="#cccccc" 
          style="font-size: 12px; font-family: Arial, sans-serif;">
          ${currentXP}/${nextLevelXP} XP
        </text>
      </g>
    </g>
  `;
}

function renderStatsSection(data: ProfileData): string {
  const stats = [
    {
      icon: '🎵',
      value: data.stats.total_tracks_played.toLocaleString(),
      label: 'Tracks'
    },
    {
      icon: '⏱️',
      value: Math.floor(data.stats.total_listening_time_ms / 3600000),
      label: 'Hours'
    },
    {
      icon: '🏆',
      value: data.achievements.recent.length,
      label: 'Achievements'
    }
  ];

  return `
    <g transform="translate(40, 160)">
      ${stats.map((stat, i) => `
        <g transform="translate(${i * 120}, 0)">
          <rect width="100" height="80" rx="10" fill="url(#cardGrad)" />
          <text 
            x="50" 
            y="30" 
            text-anchor="middle" 
            fill="white" 
            style="font-size: 24px; font-family: Arial, sans-serif;">
            ${stat.icon}
          </text>
          <text 
            x="50" 
            y="50" 
            text-anchor="middle" 
            fill="white" 
            style="font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">
            ${stat.value}
          </text>
          <text 
            x="50" 
            y="65" 
            text-anchor="middle" 
            fill="#cccccc" 
            style="font-size: 12px; font-family: Arial, sans-serif;">
            ${stat.label}
          </text>
        </g>
      `).join('')}
    </g>
  `;
}

function renderAchievementsSection(data: ProfileData): string {
  if (data.achievements.recent.length === 0) {
    return `
      <g transform="translate(600, 50)">
        <rect width="450" height="80" rx="10" fill="url(#cardGrad)" />
        <text 
          x="225" 
          y="45" 
          text-anchor="middle" 
          fill="#cccccc" 
          style="font-size: 16px; font-family: Arial, sans-serif;">
          No achievements yet
        </text>
      </g>
    `;
  }

  return `
    <g transform="translate(600, 50)">
      <text 
        x="0" 
        y="30" 
        fill="white" 
        style="font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">
        Recent Achievements
      </text>
      ${data.achievements.recent.slice(0, 3).map((ach, i) => `
        <g transform="translate(0, ${40 + i * 60})">
          <rect width="450" height="50" rx="10" fill="url(#cardGrad)" />
          <text 
            x="15" 
            y="32" 
            fill="white" 
            style="font-size: 18px; font-family: Arial, sans-serif;">
            ${ach.emoji} ${ach.name}
          </text>
          ${
            ach.progress
              ? `
                <g transform="translate(15, 38)">
                  <rect width="420" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
                  <rect 
                    width="${(ach.progress.current / ach.progress.target) * 420}" 
                    height="4" 
                    rx="2" 
                    fill="${getRarityColor(ach.rarity)}" 
                  />
                </g>
              `
              : ''
          }
        </g>
      `).join('')}
    </g>
  `;
}

function renderArtistsSection(data: ProfileData): string {
  const medals = ['🥇', '🥈', '🥉'];
  return `
    <g transform="translate(200, 280)">
      <text 
        x="0" 
        y="0" 
        fill="white" 
        style="font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">
        Top Artists
      </text>
      ${data.topArtists.slice(0, 3).map((artist, i) => `
        <g transform="translate(0, ${30 + i * 30})">
          <text 
            x="0" 
            y="0" 
            fill="white" 
            style="font-size: 18px; font-family: Arial, sans-serif;">
            ${medals[i]} ${artist.artistName}
          </text>
          <text 
            x="250" 
            y="0" 
            fill="#cccccc" 
            style="font-size: 16px; font-family: Arial, sans-serif;">
            ${artist.playCount} plays
          </text>
        </g>
      `).join('')}
    </g>
  `;
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    legendary: '#ffd700',
    epic: '#9370db',
    rare: '#4169e1',
    common: '#32cd32'
  };
  return colors[rarity] || '#ffffff';
}

function ensureSafeData(data: ProfileData): ProfileData {
  return {
    ...data,
    achievements: {
      level: data.achievements?.level || {
        level: 1,
        currentXP: 0,
        nextLevelXP: 100,
        title: 'Newbie Listener'
      },
      recent: data.achievements?.recent || []
    },
    stats: {
      total_tracks_played: data.stats?.total_tracks_played || 0,
      total_listening_time_ms: data.stats?.total_listening_time_ms || 0
    },
    profile: {
      accent_color: data.profile?.accent_color || '#FF0080',
      background_color: data.profile?.background_color || '#350035'
    }
  };
}
