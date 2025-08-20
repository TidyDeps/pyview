// WebSocket Service for Real-time Progress Updates
import type { ProgressUpdate } from '@/types/api'

type ProgressCallback = (update: ProgressUpdate) => void
type ErrorCallback = (error: string) => void

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private callbacks: Set<ProgressCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()

  constructor(private analysisId: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:8000/ws/progress/${this.analysisId}`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const update: ProgressUpdate = JSON.parse(event.data)
          this.callbacks.forEach(callback => callback(update))
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.errorCallbacks.forEach(callback => callback('WebSocket connection error'))
        reject(error)
      }
    })
  }

  private reconnect(): void {
    this.reconnectAttempts++
    console.log(`Reconnecting... attempt ${this.reconnectAttempts}`)
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  onProgress(callback: ProgressCallback): void {
    this.callbacks.add(callback)
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.add(callback)
  }

  removeProgressCallback(callback: ProgressCallback): void {
    this.callbacks.delete(callback)
  }

  removeErrorCallback(callback: ErrorCallback): void {
    this.errorCallbacks.delete(callback)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }
    this.callbacks.clear()
    this.errorCallbacks.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export default WebSocketService