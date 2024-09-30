/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CHECK_MASTER_ALIVE,
  MASTER_ALIVE,
  MASTER_CLOSED,
  WEBSOCKET_MANAGEMENT_CHANNEL,
  PING,
  PONG,
  PING_INTERVAL,
  PONG_TIMEOUT,
  RECONNECTION_DELAY,
  MAX_RECONNECTION_ATTEMPTS,
  WEBSOCKET_EVENTS,
  CONNECTION_STATUS,
  TAB_VISIBLE_EVT,
} from './const'
import { postMessageWSChannel } from './localStorageEvents'

type WebSocketEvent = {
  type:
    | typeof CHECK_MASTER_ALIVE
    | typeof MASTER_ALIVE
    | typeof MASTER_CLOSED
    | typeof TAB_VISIBLE_EVT
    | (typeof WEBSOCKET_EVENTS)[keyof typeof WEBSOCKET_EVENTS]
  action?: string
  data?: any
}

type TWSOptions = {
  onConnect: () => void
  onDisconnect: () => void
  onError: (error: Error) => void
  onConnectError: (error: Error) => void
}

type TTimeout = ReturnType<typeof setTimeout>
type TInterval = ReturnType<typeof setInterval>

class ManagedWebSocket {
  private static instance: ManagedWebSocket | null = null
  private id: string = Math.random().toString(36).substring(2, 15)
  private socket: WebSocket | null = null
  private isMaster: boolean = false
  private connectionCheckInterval: TTimeout | null = null
  private eventListeners: Map<string, {
    socketListener: (event: MessageEvent) => void
    storageListener: (event: StorageEvent) => void
  }[]> =
    new Map()
  private pingInterval: TInterval | null = null
  private pongTimeout: TTimeout | null = null
  private url!: string
  private reconnectionAttempts: number = 0
  private reconnectionTimeout: TTimeout | null = null
  private options!: TWSOptions
  private connectionStatus: CONNECTION_STATUS = CONNECTION_STATUS.DISCONNECTED
  private inactiveTimeout: TTimeout | null = null

  constructor(url: string, options: TWSOptions = {} as TWSOptions) { // Made options optional with default empty object
    this.url = url
    this.options = {
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || ((error: Error) => {
        console.error('WebSocket error:', error)
      }),
      onConnectError: options.onConnectError || ((error: Error) => {
        console.error('WebSocket connection failed:', error)
      }),
    }
    this.setupListeners()
    ManagedWebSocket.instance = this
  }

  // private static async acquireLock(
  //   lockName: string,
  //   timeout: number,
  // ): Promise<boolean> {
  //   const lockKey = `websocket_lock_${lockName}`
  //   const currentTime = Date.now()
  //   const lockValue = localStorage.getItem(lockKey)

  //   if (lockValue) {
  //     const [_, expiresAt] = lockValue.split(':')
  //     if (currentTime < parseInt(expiresAt, 10)) {
  //       return false
  //     }
  //   }

  //   localStorage.setItem(
  //     lockKey,
  //     `${ManagedWebSocket.instance?.id}:${currentTime + timeout}`,
  //   )
  //   await new Promise((resolve) => setTimeout(resolve, 50)) // Small delay to allow other tabs to write

  //   const currentLock = localStorage.getItem(lockKey)
  //   return (
  //     currentLock ===
  //     `${ManagedWebSocket.instance?.id}:${currentTime + timeout}`
  //   )
  // }

  // private static releaseLock(lockName: string): void {
  //   const lockKey = `websocket_lock_${lockName}`
  //   localStorage.removeItem(lockKey)
  // }

  private setupListeners() {
    window.addEventListener('storage', this.handleStorageEvent.bind(this))

    window.addEventListener('beforeunload', () => {
      if (this.isMaster) {
        postMessageWSChannel({ type: MASTER_CLOSED })
      }
    })

    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
    window.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key !== WEBSOCKET_MANAGEMENT_CHANNEL) return

    const data: WebSocketEvent = JSON.parse(event.newValue || '{}')
    switch (data.type) {
      case CHECK_MASTER_ALIVE:
        if (this.isMaster) {
          postMessageWSChannel({
            type: MASTER_ALIVE,
            data: {
              connectionStatus: this.connectionStatus,
            },
          })
        }
        break
      case MASTER_ALIVE:
        if (this.connectionCheckInterval) {
          clearTimeout(this.connectionCheckInterval)
        }
        break
      case WEBSOCKET_EVENTS.SEND:
        if (data.action && this.isMaster) {
          this.send(data.action, data.data)
        }
        break
      case MASTER_CLOSED:
        console.log('MASTER_CLOSED')
        this.connectionStatus = CONNECTION_STATUS.DISCONNECTED
        this.reconnectionAttempts = 0
        this.reconnect(0)
        break
      case WEBSOCKET_EVENTS.CONNECT_ERROR:
        this.connectionStatus = CONNECTION_STATUS.ERROR
        this.options.onConnectError(new Error('WebSocket connection failed'))
        break
      case WEBSOCKET_EVENTS.DISCONNECTED:
        this.connectionStatus = CONNECTION_STATUS.DISCONNECTED
        break
      case WEBSOCKET_EVENTS.RECONNECT:
        this.reconnect(data.data.timeout, false)
        break
      case TAB_VISIBLE_EVT:
        console.log('I_AM_ACTIVE clear timeout')

        if (this.inactiveTimeout && data.data === true) {
          clearTimeout(this.inactiveTimeout)
          this.inactiveTimeout = null;
        }
        if(this.isMaster && data.data === false) {
          this.resetInactiveTimeout()
        }

        break
    }
  }

  private handleOnline() {
    this.reconnectionAttempts = 0
    this.reconnect(0);
  }

  private handleOffline() {
    if (this.isMaster) {
      this.stopPingPong()
      this.socket?.close()
      this.isMaster = false
    }
  }

  private resetInactiveTimeout() {
    if (this.isMaster) {
      console.log('this.isMaster master hidden')
      // if (this.inactiveTimeout) {
      //   clearTimeout(this.inactiveTimeout)
      // }

    this.inactiveTimeout = setTimeout(() => {
      console.log("Tab inactive for 15 minutes, disconnecting WebSocket");
      this.socket?.close();
      }, 5 * 1000); // 15 minutes
    }
  }


  private handleVisibilityChange() {
    console.log('handleVisibilityChange document.hidden', document.hidden)
    if (document.hidden) {
      // if master is not active for 15 minutes, disconnect the websocket
      if (this.isMaster) {
        this.resetInactiveTimeout()
      } else {
        postMessageWSChannel({ type: TAB_VISIBLE_EVT, data: false });
      }
    } else {
      // if one of the tab is active, clear the timeout
      if (this.isMaster) {
        if (this.inactiveTimeout) {
          clearTimeout(this.inactiveTimeout);
          this.inactiveTimeout = null;
        }
      } else {
        console.log('slave visible')
        postMessageWSChannel({ type: TAB_VISIBLE_EVT, data: true });
      }
      // if one of the tab is active again, reconnect the websocket
      if (this.connectionStatus === CONNECTION_STATUS.DISCONNECTED) {
        console.log("Tab is active again, reconnecting WebSocket");
        this.reconnectionAttempts = 0
        this.reconnect(0);
        // TODO: need to refresh data for pages maybe every tab.
      }
    }
  }

  private async waitForConnection(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkConnection = (event: StorageEvent) => {
        if (event.key !== WEBSOCKET_MANAGEMENT_CHANNEL) return
        const data: WebSocketEvent = JSON.parse(event.newValue || '{}')
        if (
          data.type === MASTER_ALIVE &&
          data.data.connectionStatus === CONNECTION_STATUS.CONNECTED
        ) {
          this.connectionStatus = CONNECTION_STATUS.CONNECTED
          window.removeEventListener('storage', checkConnection)
          resolve()
        }
      }

      window.addEventListener('storage', checkConnection)
      postMessageWSChannel({ type: CHECK_MASTER_ALIVE })

      setTimeout(() => {
        window.removeEventListener('storage', checkConnection)
        this.connectionStatus = CONNECTION_STATUS.ERROR
        postMessageWSChannel({ type: WEBSOCKET_EVENTS.CONNECT_ERROR })
        reject(new Error('Wait connection timeout'))
      }, timeout)
    })
  }

  public async connect(): Promise<void> {
    console.log('connect')
    if ((this.socket && this.socket.readyState === WebSocket.OPEN) || this.connectionStatus === CONNECTION_STATUS.CONNECTED) {
      console.log('Already connected')
      this.connectionStatus = CONNECTION_STATUS.CONNECTED
      this.reAssignListeners()
      return Promise.resolve()
    }

    // const lockAcquired = await ManagedWebSocket.acquireLock('connect', 3000)
    // console.log("🚀 ~ ManagedWebSocket ~ connect ~ lockAcquired:", lockAcquired)
    this.connectionStatus = CONNECTION_STATUS.CONNECTING

    // if (!lockAcquired) {
    //   return this.waitForConnection(3000)
    // }

    try {
      postMessageWSChannel({ type: CHECK_MASTER_ALIVE })

      let timerRace: TTimeout | null = null
      const connectionPromise = new Promise<void>((resolve) => {
        const handleResolve = () => {
          // reset the timeout check visibility if the tab is visible
          if (!document.hidden) {
            postMessageWSChannel({ type: TAB_VISIBLE_EVT, data: true });
            if (this.inactiveTimeout && this.isMaster) {
              clearTimeout(this.inactiveTimeout)
              this.inactiveTimeout = null;
            }
          }

          // re-assign listeners for the websocket or storage
          this.reAssignListeners()

          // remove and clear
          if (timerRace) {
            clearTimeout(timerRace)
          }
          window.removeEventListener('storage', checkConnection)
          resolve()
        }

        const checkConnection = (event: StorageEvent) => {
          if (event.key !== WEBSOCKET_MANAGEMENT_CHANNEL) return
          const data: WebSocketEvent = JSON.parse(event.newValue || '{}')
          if (
            data.type === MASTER_ALIVE &&
            data.data.connectionStatus === CONNECTION_STATUS.CONNECTED
          ) {
            console.log('connected')
            this.connectionStatus = CONNECTION_STATUS.CONNECTED
            handleResolve()
          }
        }

        window.addEventListener('storage', checkConnection)

        this.connectionCheckInterval = setTimeout(() => {
          console.log('connectionCheckInterval')
          this.isMaster = true
          this.createWebSocket()
          const openListener = () => {
            this.connectionStatus = CONNECTION_STATUS.CONNECTED
            postMessageWSChannel({
              type: MASTER_ALIVE,
              data: {
                connectionStatus: this.connectionStatus,
              },
            })
            handleResolve()
            this.socket?.removeEventListener('open', openListener)
          }
          this.socket?.addEventListener('open', openListener)
        }, 1000)
      })

      const timeoutPromise = new Promise<void>((_, reject) => {
        timerRace = setTimeout(() => {
          this.connectionStatus = CONNECTION_STATUS.ERROR
          postMessageWSChannel({ type: WEBSOCKET_EVENTS.CONNECT_ERROR })
          reject(new Error('Connection timeout'))
        }, 15000)
      })

      await Promise.race([connectionPromise, timeoutPromise])

    } catch (error) {
      console.log('Failed to establish connection:', error)
      this.connectionStatus = CONNECTION_STATUS.ERROR
      postMessageWSChannel({ type: WEBSOCKET_EVENTS.CONNECT_ERROR })

      if (this.isMaster) {
        this.reconnect()
      }
      throw error
    } finally {
      // ManagedWebSocket.releaseLock('connect')
    }
  }

  private createWebSocket() {
    return new Promise<void>((resolve, reject) => {
      this.socket = new WebSocket(this.url)
      this.setupSocketListeners()

      const handleOpen = () => {
        resolve()
        this.socket?.removeEventListener('open', handleOpen)
      }
      this.socket.addEventListener('open', handleOpen)

      const handleError = () => {
        reject(new Error('WebSocket connection failed'))
        this.socket?.removeEventListener('error', handleError)
      }
      this.socket.addEventListener('error', handleError)
    })
  }

  private reAssignListeners() {
    // remove all old listeners have been assigned to the socket and storage
    // this will help when the tab is change from isMaster to not master and vice versa
    const eventListeners = Array.from(this.eventListeners.values())
    console.log('reAssignListeners', eventListeners)


    eventListeners.forEach((listeners) => {
      listeners.forEach((listener) => {
        this.socket?.removeEventListener('message', listener.socketListener)
        window.removeEventListener('storage', listener.storageListener)

        if (this.socket) {
          this.socket.addEventListener('message', listener.socketListener)
        } else {
          window.addEventListener('storage', listener.storageListener)
        }
      })
    })
  }
  private setupSocketListeners() {
    if (!this.socket) return

    this.socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.action === PONG) {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout)
        }
      } else {
        postMessageWSChannel({
          type: WEBSOCKET_EVENTS.RECEIVE,
          action: data.action,
          data: data.data,
        })
      }
    }

    // re-assign listeners for the websocket or storage
    this.reAssignListeners()

    this.socket.onopen = () => {
      this.reconnectionAttempts = 0
      this.startPingPong()
      this.connectionStatus = CONNECTION_STATUS.CONNECTED
      this.options.onConnect()
    }

    this.socket.onclose = () => {
      this.stopPingPong()
      this.connectionStatus = CONNECTION_STATUS.DISCONNECTED
      postMessageWSChannel({ type: WEBSOCKET_EVENTS.DISCONNECTED })
      this.options.onDisconnect()
      if (this.isMaster && !document.hidden) {
        console.log('WebSocket disconnected, reconnecting...')
        this.reconnect()
      }
    }

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.connectionStatus = CONNECTION_STATUS.ERROR
      postMessageWSChannel({ type: WEBSOCKET_EVENTS.CONNECT_ERROR })
      this.options.onError(new Error('WebSocket error'))
      this.socket?.close()
    }
  }

  private startPingPong() {
    if (!this.isMaster) return

    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: PING }))
        this.pongTimeout = setTimeout(() => {
          console.error('Pong not received, connection might be lost.')
          this.socket?.close()
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }

  private stopPingPong() {
    if (!this.isMaster) return
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
    }
  }

  private reconnect(timeout?: number, recursive: boolean = true) {
    if (this.connectionStatus === CONNECTION_STATUS.CONNECTING) {
      console.log('Already reconnecting')
      return
    }
    if (this.reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
      console.error('Max reconnection attempts reached')
      this.connectionStatus = CONNECTION_STATUS.ERROR
      this.options.onConnectError(
        new Error('Max reconnection attempts reached'),
      )
      return
    }


    this.connectionStatus = CONNECTION_STATUS.CONNECTING
    this.reconnectionAttempts++
    this.reconnectionTimeout = setTimeout(() => {
      console.log('RECONNECTING......', this.reconnectionAttempts)
      if (recursive) {
        postMessageWSChannel({ type: WEBSOCKET_EVENTS.RECONNECT, data: { timeout: timeout ?? RECONNECTION_DELAY } });
      }
      this.connect()
    }, timeout ?? RECONNECTION_DELAY)
  }

  public send(action: string, data?: unknown, metadata?: unknown) {
    if (this.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      console.error('Cannot send message, WebSocket is not connected, sending', action, data)
      this.reconnectionAttempts = 0
      this.reconnect(0)

      // TODO: retry to send after reconnect
      return
    }

    if (
      this.isMaster &&
      this.socket &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      this.socket.send(JSON.stringify({ action: action, data, ...(metadata || {}) }))
    } else {
      postMessageWSChannel({
        type: WEBSOCKET_EVENTS.SEND,
        action,
        data,
      })
    }
  }

  public on(action: string, callback: (event: MessageEvent) => void) {
    if (!this.eventListeners.has(action)) {
      this.eventListeners.set(action, [])
    }
    // this.eventListeners.get(action)!.push(callback)


    const socketListener = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.action === action) {
        callback(event);
      }
    };

    const storageListener = (event: StorageEvent) => {
      if (event.key !== WEBSOCKET_MANAGEMENT_CHANNEL) return
      const data: WebSocketEvent = JSON.parse(event.newValue || '{}')
      if (data.type === WEBSOCKET_EVENTS.RECEIVE && data.action === action) {
        callback(new MessageEvent('message', { data: JSON.stringify(data) }))
      }
    }


      this.eventListeners.get(action)!.push({
        socketListener,
        storageListener
      })

    if (this.isMaster && this.socket) {
      this.socket.addEventListener('message', socketListener as (event: Event) => void)
      // return addListener(this.socket, 'message', socketListener as (event: Event) => void)
    } else {
      window.addEventListener('storage', storageListener as (event: Event) => void)
      // return addListener(window, 'storage', storageListener as (event: Event) => void)
    }
  }

  public close() {
    this.stopPingPong()
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout)
    }
    this.socket?.close()
    this.isMaster = false
    this.eventListeners.clear()
    this.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    window.removeEventListener('storage', this.handleStorageEvent)
    window.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }
}

export default ManagedWebSocket



// TODO:
// check if localStorage is not available, do not use localStorage to manage the websocket connection
// every tab will try to connect to the websocket server
// - reconnect websocket: make sure only one tab connect to the websocket
// - return send error to let the consumer know that the message is not sent
// - refresh data after reconnect
// - call API validate auth when receive the the error when connect failed
// - monitor by sentry or slack

// SUPPORT options passing for external usage
// - onConnect
// - onDisconnect
// - onError
// - onConnectError
