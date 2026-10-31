import { describe, expect, test } from 'vitest'
import { answerClientError } from './client-errors.js'

/**
 * What the server writes to a connection whose request Node's parser could
 * not read (client-errors.ts). The 400 and the 431 are taken over a socket
 * in app.test.ts; the 408 waits on Node's header timeout, a minute and the
 * half-minute it checks in, so it is taken here, on a socket that records
 * what is written to it.
 */
function socket(state: { destroyed?: boolean; writable?: boolean } = {}) {
  const written: string[] = []
  let destroyed = state.destroyed ?? false
  return {
    written,
    get destroyed() {
      return destroyed
    },
    writable: state.writable ?? true,
    write: (text: string) => void written.push(text),
    destroy: () => void (destroyed = true),
  }
}

const error = (code: string) =>
  Object.assign(new Error('a parser error, whose rawPacket would hold what the client sent'), {
    code,
    rawPacket: Buffer.from('Authorization: Bearer a-pasted-secret'),
  })

describe('answerClientError', () => {
  // Headers sent too slowly are Node's 408, which Fastify answered with its
  // own body and no Cache-Control: the fixed refusal, no-store, closed.
  test('answers a request whose headers came too slowly 408, with the fixed refusal', () => {
    const connection = socket()
    answerClientError(error('ERR_HTTP_REQUEST_TIMEOUT'), connection as never)
    expect(connection.written).toHaveLength(1)
    const [answer = ''] = connection.written
    expect(answer.startsWith('HTTP/1.1 408 Request Timeout\r\n')).toBe(true)
    expect(answer).toContain('\r\nCache-Control: no-store\r\n')
    expect(answer).toContain('\r\nConnection: close\r\n')
    expect(answer.endsWith('\r\n\r\n{"code":"bad-request","message":"The request could not be read."}')).toBe(true)
    expect(answer).not.toContain('a-pasted-secret')
    expect(connection.destroyed).toBe(true)
  })

  // The Content-Length is the body's, so a client reads the answer whole
  // and nothing after it.
  test('says the body’s length in bytes', () => {
    const connection = socket()
    answerClientError(error('HPE_INVALID_HEADER_TOKEN'), connection as never)
    const [answer = ''] = connection.written
    const body = answer.slice(answer.indexOf('\r\n\r\n') + 4)
    expect(answer).toContain(`\r\nContent-Length: ${String(Buffer.byteLength(body))}\r\n`)
    expect(answer.startsWith('HTTP/1.1 400 Bad Request\r\n')).toBe(true)
  })

  // A connection the client reset, or one already gone, has nobody to
  // answer; writing to it would throw into the server.
  test('writes nothing to a connection that is reset, gone or not writable, and closes one that is not', () => {
    const reset = socket()
    answerClientError(error('ECONNRESET'), reset as never)
    const gone = socket({ destroyed: true })
    answerClientError(error('HPE_INVALID_METHOD'), gone as never)
    const closing = socket({ writable: false })
    answerClientError(error('HPE_INVALID_METHOD'), closing as never)
    expect([reset.written, gone.written, closing.written]).toEqual([[], [], []])
    expect(closing.destroyed).toBe(true)
  })
})
