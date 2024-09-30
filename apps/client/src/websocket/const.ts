export const CHECK_MASTER_ALIVE = 'CONNECTION_CHECK';
export const MASTER_ALIVE = 'MASTER_ALIVE';
export const MASTER_CLOSED = 'MASTER_CLOSED';
export const TAB_VISIBLE_EVT = 'TAB_VISIBLE_EVT';
export enum WEBSOCKET_EVENTS {
  SEND = 'WEBSOCKET_SEND',
  RECEIVE = 'WEBSOCKET_RECEIVE',
  CONNECT_ERROR = 'WEBSOCKET_CONNECT_ERROR',
  DISCONNECTED = 'WEBSOCKET_DISCONNECTED',
  RECONNECT = 'WEBSOCKET_RECONNECT',
}
export const WEBSOCKET_MANAGEMENT_CHANNEL = 'websocket_management';
export const PING = 'ping';
export const PONG = 'pong';
export const PING_INTERVAL = 60000; // 1 minute
export const PONG_TIMEOUT = 5000; // 5 seconds
export const RECONNECTION_DELAY = 5000; // 5 seconds
export const MAX_RECONNECTION_ATTEMPTS = 3;

export enum CONNECTION_STATUS {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}
