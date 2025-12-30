// Game defaults
export const DEFAULT_STARTING_TIME_MS = 600000;  // 10 minutes
export const DEFAULT_NUM_ROUNDS = 10;
export const DEFAULT_MAX_PLAYERS = 8;
export const DEFAULT_GRACE_PERIOD_MS = 5000;     // 5 seconds

// Constraints
export const MIN_STARTING_TIME_SECONDS = 60;     // 1 minute
export const MAX_STARTING_TIME_SECONDS = 3600;   // 60 minutes
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 50;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const MIN_GRACE_PERIOD_SECONDS = 3;
export const MAX_GRACE_PERIOD_SECONDS = 10;

// Name constraints
export const MIN_TABLE_NAME_LENGTH = 1;
export const MAX_TABLE_NAME_LENGTH = 50;
export const MIN_PLAYER_NAME_LENGTH = 1;
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 50;

// Timing
export const PRE_ROUND_COUNTDOWN_MS = 3000;      // 3 seconds before round
export const ROUND_RESULTS_DISPLAY_MS = 5000;   // 5 seconds to show results
export const RECONNECT_WINDOW_MS = 30000;        // 30 seconds to reconnect
export const MAX_LATENCY_COMPENSATION_MS = 200;  // Max latency adjustment

// Tie threshold
export const TIE_THRESHOLD_MS = 100;             // Within 100ms = tie

// Rate limiting
export const MAX_BUTTON_EVENTS_PER_SECOND = 10;

// Table ID
export const TABLE_ID_LENGTH = 6;
export const TABLE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars
