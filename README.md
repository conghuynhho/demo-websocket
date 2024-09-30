# WebSocket Manager

This project provides a WebSocket manager that allows multiple tabs to share a single WebSocket connection. It uses `localStorage` to synchronize the connection state across tabs.

## Features

- **Connection Sharing**: Multiple tabs can share a single WebSocket connection.
- **Automatic Connection**: The manager automatically connects to the WebSocket server and reconnects if the connection is lost.
- **Message Broadcasting**: The manager broadcasts messages to all connected tabs.


## Explaination how it works

1. **Master Tab Connection**:
   - The first tab to connect to the WebSocket server becomes the master.
   - This tab will handle the WebSocket connection and manage the connection state.
   - Other tabs will be notified of the connection state via `storage` events and will not need to establish a new connection.

2. **Connection State Management**:
   - The master tab stores the WebSocket connection in `localStorage`.
   - Other tabs retrieve this connection from `localStorage` when they connect.

3. **Reconnection**:
   - If the connection is lost, the master tab will attempt to reconnect.
   - Other tabs will also attempt to reconnect, using the stored connection information.

4. **Message Broadcasting**:
   - The master tab broadcasts messages to all connected tabs using the stored WebSocket connection.


## Usage

