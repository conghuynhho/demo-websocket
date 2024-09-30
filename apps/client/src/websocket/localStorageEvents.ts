import { WEBSOCKET_MANAGEMENT_CHANNEL } from "./const"

type TPayload = {
  type: string
  action?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

export const postMessageWSChannel = (data: TPayload) => {
  const payload = JSON.stringify(Object.assign({time: Date.now()}, data) || {})
  localStorage.setItem(WEBSOCKET_MANAGEMENT_CHANNEL, payload)
}