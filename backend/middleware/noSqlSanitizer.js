const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const findUnsafeMongoKey = (value, path = []) => {
  if (!value || typeof value !== 'object') return null;
  if (value instanceof Date || Buffer.isBuffer(value)) return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findUnsafeMongoKey(value[i], path.concat(String(i)));
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) return path.concat(key).join('.');
    const found = findUnsafeMongoKey(child, path.concat(key));
    if (found) return found;
  }
  return null;
};

const rejectUnsafeMongoKeys = (req, res, next) => {
  const unsafeBody = findUnsafeMongoKey(req.body);
  const unsafeQuery = findUnsafeMongoKey(req.query);
  if (unsafeBody || unsafeQuery) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request payload',
    });
  }
  return next();
};

module.exports = {
  findUnsafeMongoKey,
  rejectUnsafeMongoKeys,
};
