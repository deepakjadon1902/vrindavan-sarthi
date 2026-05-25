const requestTiming = (options = {}) => {
  const slowMs = Number(options.slowMs || process.env.SLOW_REQUEST_MS || 1500);

  return function requestTimingMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      if (ms < slowMs) return;
      const status = res.statusCode;
      // Keep logs small but actionable.
      // eslint-disable-next-line no-console
      console.warn(`[SLOW ${ms.toFixed(0)}ms] ${status} ${req.method} ${req.originalUrl}`);
    });

    next();
  };
};

module.exports = { requestTiming };

