/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState } from 'react'
import './App.css'
import useDidMountEffect from './hooks/useDidMountEffect'
import ManagedWebSocket from './websocket'

let ws: ManagedWebSocket

function App() {
  const [messages, setMessages] = useState<{left: boolean, msg: string}[]>([])
  const [input, setInput] = useState('')



  useDidMountEffect(() => {
    console.log('useDidMountEffect')

    // check if support web socket
    if (!window.WebSocket) {
      alert('WebSocket is not supported in this browser.')
      return
    }

    const userId = window.location.search.split('=')[1]
    // url on browser will be like this: http://localhost:5173/?userId=1
    // ws = new ManagedWebSocket(`wss://1zcm21r0p4.execute-api.ap-northeast-1.amazonaws.com/development/?userId=${userId}`)
    // ws = new ManagedWebSocket(`ws://192.168.50.25:3000/?userId=${userId}`)
    ws = new ManagedWebSocket(`ws://localhost:3000/?userId=${userId}`)

    ws.connect().then(() => {
      console.log('============ws connected===========')
      ws.on('chat/sendSuccess', (event) => {
        console.log("🚀 ~ ws.on ~ event:", event)
        const data = JSON.parse(event.data)
        console.log("🚀 ~ ws.onSendSuccess ~ data:", data)

        setMessages((prevMessages) => [...prevMessages, {
          left: false,
          msg: data.data.message.data
        }])
        // scroll to bottom
        const chatScreen = document.querySelector('.messages')
        if (chatScreen) {
          setTimeout(() => {
            chatScreen.scrollTop = chatScreen.scrollHeight
          }, 100)
        }

      })

      ws.on('chat/receive', (event) => {
        console.log("🚀 ~ ws.onReceive ~ event:", event)
        const data = JSON.parse(event.data)
        console.log("🚀 ~ ws.on ~ data:", data)

        setMessages((prevMessages) => [...prevMessages, {
          left: true,
          msg: data.data.message.data
        }])
        // scroll to bottom
        const chatScreen = document.querySelector('.messages')
        if (chatScreen) {
          setTimeout(() => {
            chatScreen.scrollTop = chatScreen.scrollHeight
          }, 100)
        }
        // setMessages((prevMessages) => [...prevMessages, data.data.message])
      })

      ws.on('chat/sendFailed', (event) => {
        console.log("🚀 ~ ws.onSendFailed ~ event:", event)
        alert('send failed')
        // setMessages((prevMessages) => [...prevMessages, data.data.message])
      })
    })

    // @ts-expect-error
    window.ws = ws

    return () => {
      console.log('unmounting')
      ws.close()
    }
  }, [])


  const sendMessage = () => {
    if (input.trim()) {
      ws.send('chat-send', {
        chatId: 1 ,
        message: { type: 'text', data: input }
      })
      setInput('')
    }
  }

  return (
    <>
      <div className="chat-screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh', width: '80vw', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Roboto', fontSize: '24px', fontWeight: 'bold' }}>Chat</h2>
        <div className="bubble-chat" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', overflowY: 'auto' }}>
          <div className="messages" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px', marginBottom: '20px' }}>
            {messages.map((msg, index) => (
              <div key={index} className="message" style={{
                padding: '10px',
                backgroundColor: msg.left ? '#fff' : '#0084FF',
                borderRadius: '10px',
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                maxWidth: '70%',
                marginRight: msg.left ? 'auto' : '0',
                marginLeft: msg.left ? '0' : 'auto',
                minWidth: '100px',
              }}>
                <span style={{ fontFamily: 'Roboto', fontSize: '16px', color: msg.left ? '#000' : '#fff'}}>{msg.msg}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px', borderTop: '1px solid #ddd', position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'row', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              style={{ padding: '10px', width: '100%', height: '40px', border: 'none', borderRadius: '10px', boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)', fontFamily: 'Roboto', fontSize: '16px', color: '#000', backgroundColor: 'white' }}
            />
            <button onClick={sendMessage} style={{ padding: '10px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Roboto', fontSize: '16px' }}>Send</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
