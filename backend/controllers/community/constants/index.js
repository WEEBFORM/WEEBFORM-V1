export const REACTION_TYPES = {
    LIKE: 'like',
    LOVE: 'love',
    LAUGH: 'laugh',
    WOW: 'wow',
    SAD: 'sad',
    POG: 'pog',
    PEPEGA: 'pepega',
    OMEGALUL: 'omegalul'
  };
  
  // User levels are typically defined by XP thresholds in gamificationService.js
  // This constant might be for roles or tiers if USER_LEVELS implies something different.
  // For now, keeping it simple. If it's about permissions, it's better handled by roles.
  export const USER_ROLES = {
    MEMBER: 'member',
    MODERATOR: 'moderator',
    ADMIN: 'admin',
    OWNER: 'owner',
  };
  
  export const ADMIN_ACTIONS = {
    SLOW_MODE: 'slow_mode', 
    MUTE: 'mute',         
    EXILE: 'exile',  
    REMOVE: 'remove',  
    KICK: 'kick',   
    BAN: 'ban',                
    WARN: 'warn',      
    VIEW_REPORTS: 'view_reports',
    MANAGE_ROLES: 'manage_roles', 
    EDIT_GROUP_SETTINGS: 'edit_group_settings'
  };
  
  export const GROUP_PERMISSIONS = {
    SEND_MESSAGE: 'sendMessage',
    SEND_REACTION: 'sendReaction',
    CREATE_THREAD: 'createThread',
    JOIN_VOICE: 'joinVoice',
    UPLOAD_MEDIA: 'uploadMedia',
    MANAGE_MESSAGES: 'manageMessages',
    MANAGE_MEMBERS: 'manageMembers',
  };
  
  // DEFAULT SETTINGS (to be revised)
  export const DEFAULT_VALUES = {
    SLOW_MODE_SECONDS: 5,
    MUTE_DURATION_MINUTES: 60,
    EXILE_DURATION_HOURS: 1,
  };