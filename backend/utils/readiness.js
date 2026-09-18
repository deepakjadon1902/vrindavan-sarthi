const mongoose = require('mongoose');
const { getQueueConfig } = require('../config/redis');

const getReadinessSnapshot = ({
  mongoReadyState = mongoose.connection.readyState,
  queueConfig = getQueueConfig(),
  redisRequired = false,
} = {}) => {
  const mongoReady = mongoReadyState === 1;
  const redisReady = !redisRequired || Boolean(queueConfig.configured);
  return {
    ready: mongoReady && redisReady,
    checks: {
      mongo: mongoReady ? 'ready' : 'not_ready',
      redis: redisRequired ? (queueConfig.configured ? 'configured' : 'missing') : 'optional',
      queue: {
        provider: 'bullmq',
        configured: Boolean(queueConfig.configured),
      },
    },
  };
};

module.exports = { getReadinessSnapshot };
