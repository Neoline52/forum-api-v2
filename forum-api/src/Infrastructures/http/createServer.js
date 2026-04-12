const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');

const ClientError = require('../../Commons/exceptions/ClientError');
const DomainErrorTranslator = require('../../Commons/exceptions/DomainErrorTranslator');

const users = require('../../Interfaces/http/api/users');
const authentications = require('../../Interfaces/http/api/authentications');
const threads = require('../../Interfaces/http/api/threads');
const comments = require('../../Interfaces/http/api/comments');
const replies = require('../../Interfaces/http/api/replies');
const likes = require('../../Interfaces/http/api/likes');

const createServer = async (container) => {
  const server = Hapi.server({
    host: process.env.HOST,
    port: process.env.PORT,
  });

  // register JWT
  await server.register([
    {
      plugin: Jwt,
    },
  ]);

  // strategy auth JWT
  server.auth.strategy('forum_api_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
        username: artifacts.decoded.payload.username,
      },
    }),
  });

  // register routes
  await server.register([
    { plugin: users, options: { container } },
    { plugin: authentications, options: { container } },
    { plugin: threads, options: { container } },
    { plugin: comments, options: { container } },
    { plugin: replies, options: { container } },
    { plugin: likes, options: { container } },
  ]);

  // =========================
  // 🔥 RATE LIMIT (WAJIB)
  // =========================
  const rateLimitMap = new Map();

  server.ext('onRequest', (request, h) => {
    if (request.path.startsWith('/threads')) {
      const ip = request.info.remoteAddress;

      const now = Date.now();
      const windowTime = 60 * 1000;

      if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
      }

      const timestamps = rateLimitMap.get(ip).filter((ts) => now - ts < windowTime);

      timestamps.push(now);
      rateLimitMap.set(ip, timestamps);

      if (timestamps.length > 90) {
        return h
          .response({
            status: 'fail',
            message: 'Too many requests',
          })
          .code(429)
          .takeover();
      }
    }

    return h.continue;
  });

  // =========================
  // ERROR HANDLING
  // =========================
  server.ext('onPreResponse', (request, h) => {
    const { response } = request;

    if (response instanceof Error) {
      const translatedError = DomainErrorTranslator.translate(response);

      if (translatedError instanceof ClientError) {
        const newResponse = h.response({
          status: 'fail',
          message: translatedError.message,
        });
        newResponse.code(translatedError.statusCode);
        return newResponse;
      }

      if (!translatedError.isServer) {
        return h.continue;
      }

      const newResponse = h.response({
        status: 'error',
        message: 'terjadi kegagalan pada server kami',
      });
      newResponse.code(500);
      return newResponse;
    }

    return h.continue;
  });

  return server;
};

module.exports = createServer;