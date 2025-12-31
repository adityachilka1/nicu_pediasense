/**
 * Pagination utilities for API endpoints
 * Implements offset-based pagination with configurable limits
 */

// Default pagination settings
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

/**
 * Parse pagination parameters from URL search params
 * @param {URLSearchParams} searchParams - URL search parameters
 * @param {Object} options - Custom options
 * @param {number} options.defaultLimit - Default items per page
 * @param {number} options.maxLimit - Maximum allowed items per page
 * @returns {{ limit: number, offset: number, page: number }}
 */
export function parsePaginationParams(searchParams, options = {}) {
  const { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = options;

  // Support both 'limit/offset' and 'page/pageSize' patterns
  let limit = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || defaultLimit, 10);
  let offset = parseInt(searchParams.get('offset') || '0', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);

  // If page is provided but not offset, calculate offset from page
  if (searchParams.get('page') && !searchParams.get('offset')) {
    offset = (page - 1) * limit;
  }

  // Validate and constrain values
  limit = Math.max(1, Math.min(limit, maxLimit));
  offset = Math.max(0, offset);

  return {
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
  };
}

/**
 * Create pagination metadata for API response
 * @param {Object} params
 * @param {number} params.total - Total number of items
 * @param {number} params.limit - Items per page
 * @param {number} params.offset - Current offset
 * @param {string} params.baseUrl - Base URL for building links (optional)
 * @returns {Object} Pagination metadata
 */
export function createPaginationMeta({ total, limit, offset, baseUrl = null }) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = offset + limit < total;
  const hasPrevPage = offset > 0;

  const meta = {
    total,
    limit,
    offset,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };

  // Add navigation links if baseUrl is provided
  if (baseUrl) {
    const links = {
      self: buildPaginatedUrl(baseUrl, limit, offset),
      first: buildPaginatedUrl(baseUrl, limit, 0),
      last: buildPaginatedUrl(baseUrl, limit, Math.max(0, (totalPages - 1) * limit)),
    };

    if (hasNextPage) {
      links.next = buildPaginatedUrl(baseUrl, limit, offset + limit);
    }

    if (hasPrevPage) {
      links.prev = buildPaginatedUrl(baseUrl, limit, Math.max(0, offset - limit));
    }

    meta.links = links;
  }

  return meta;
}

/**
 * Build a paginated URL with query parameters
 * @param {string} baseUrl - Base URL
 * @param {number} limit - Items per page
 * @param {number} offset - Offset
 * @returns {string} URL with pagination params
 */
function buildPaginatedUrl(baseUrl, limit, offset) {
  const url = new URL(baseUrl);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('offset', offset.toString());
  return url.toString();
}

/**
 * Paginate a Prisma query
 * @param {Object} prismaModel - Prisma model to query
 * @param {Object} options
 * @param {Object} options.where - Prisma where clause
 * @param {Object} options.include - Prisma include clause
 * @param {Object} options.orderBy - Prisma orderBy clause
 * @param {Object} options.select - Prisma select clause
 * @param {number} options.limit - Items per page
 * @param {number} options.offset - Offset
 * @returns {Promise<{ data: Array, total: number }>}
 */
export async function paginatedQuery(prismaModel, options) {
  const {
    where = {},
    include,
    orderBy,
    select,
    limit,
    offset,
  } = options;

  // Execute data query and count query in parallel for better performance
  const [data, total] = await Promise.all([
    prismaModel.findMany({
      where,
      ...(include && { include }),
      ...(select && { select }),
      ...(orderBy && { orderBy }),
      skip: offset,
      take: limit,
    }),
    prismaModel.count({ where }),
  ]);

  return { data, total };
}

/**
 * Create a standard paginated API response
 * @param {Object} params
 * @param {Array} params.data - Data items
 * @param {number} params.total - Total count
 * @param {number} params.limit - Items per page
 * @param {number} params.offset - Current offset
 * @param {Object} params.additionalMeta - Additional metadata to include
 * @returns {Object} Standard API response object
 */
export function createPaginatedResponse({ data, total, limit, offset, additionalMeta = {} }) {
  return {
    data,
    meta: {
      ...createPaginationMeta({ total, limit, offset }),
      ...additionalMeta,
      timestamp: new Date().toISOString(),
    },
  };
}
