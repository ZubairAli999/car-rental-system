'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validate req[source] against a Zod schema. On success, the parsed/coerced
 * value replaces the raw input so controllers get clean, typed data.
 *   router.post('/', validate(schema), handler)      // defaults to body
 *   router.get('/', validate(schema, 'query'), handler)
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  req[source] = result.data;
  next();
};

module.exports = { validate };
