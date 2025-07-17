import dotenv from 'dotenv';
dotenv.config();

const ENVIRONMENTS = [
  'production',
  'staging',
  'development',
  'cli',
  'test',
] as const;

export type Environment = (typeof ENVIRONMENTS)[number];
export const NODE_ENV: Environment = ENVIRONMENTS.includes(
  process.env.NODE_ENV as Environment
)
  ? (process.env.NODE_ENV as Environment)
  : 'staging';

const requiredSettings = [
  'GCP_DEFAULT_REGION',
  'GCP_MISC_BUCKET',
];
const missingSettings = requiredSettings.filter((s) => !process.env[s]);
if (missingSettings.length > 0) {
  missingSettings.forEach((ms) =>
    console.error(`ENV settings ${ms} is missing.`)
  );
}

export default {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process,
  },
  authBaseUrlV2: process.env.SCREENAPP_AUTH_BASE_URL_V2 ?? 'http://localhost:8081/v2',
  // Unset MAX_RECORDING_DURATION_MINUTES to use default upper limit on duration
  maxRecordingDuration: process.env.MAX_RECORDING_DURATION_MINUTES ?
    Number(process.env.MAX_RECORDING_DURATION_MINUTES) :
    180, // There's an upper limit on meeting duration 3 hours
  chromeExecutablePath: '/usr/bin/google-chrome', // We use Google Chrome with Playwright for recording
  inactivityLimit: 0.5,
  activateInactivityDetectionAfter: 0.5,
  serviceKey: process.env.SCREENAPP_BACKEND_SERVICE_API_KEY,
  joinWaitTime: 10,
  // Audio streaming configuration for SecureScribe API
  audioStreaming: {
    enabled: process.env.ENABLE_AUDIO_STREAMING === 'true',
    wsEndpoint: process.env.AUDIO_STREAMING_WS_ENDPOINT || 'ws://localhost:8000/api/ws/audio',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '44100'),
    channels: parseInt(process.env.AUDIO_CHANNELS || '1'),
    format: process.env.AUDIO_FORMAT || 'wav',
    chunkDuration: parseInt(process.env.AUDIO_CHUNK_DURATION || '1000'), // 1 second chunks
  },
};
