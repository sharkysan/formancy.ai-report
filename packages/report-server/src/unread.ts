/**
 * A request answered before its body is read (0046, 0049): the cross-origin
 * refusal, the one 401, a preflight that carries a body, a body of a media
 * type no parser reads. Node reads and discards what is left of a body once
 * the answer is sent, so that the connection can carry the next request;
 * for a body nobody asked to be read that is the server taking up to the
 * declared length, or a chunked body without end, for nothing. So where the
 * request carries a body, its connection is closed with the answer.
 */
import type { FastifyReply, FastifyRequest } from 'fastify'

/** Whether `request` carries a body: a length other than 0, or a transfer encoding. */
export function carriesBody(request: FastifyRequest): boolean {
  const length = request.headers['content-length']
  return request.headers['transfer-encoding'] !== undefined || (length !== undefined && length !== '0')
}

/** `reply`, set to close its connection where `request` carries a body that will not be read. */
export function closingUnread(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return carriesBody(request) ? reply.header('connection', 'close') : reply
}
