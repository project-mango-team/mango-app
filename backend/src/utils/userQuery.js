/**
 * Helper function to get user-scoped query filter
 * @param {Object} req - Express request object
 * @returns {Object} MongoDB filter object with user_id
 */
export const getUserFilter = (req) => {
  if (!req.user || !req.user._id) {
    throw new Error('User not authenticated');
  }
  
  return { user_id: req.user._id };
};

/**
 * Helper function to merge user filter with additional query params
 * @param {Object} req - Express request object
 * @param {Object} additionalQuery - Additional query parameters
 * @returns {Object} Combined MongoDB filter object
 */
export const buildUserQuery = (req, additionalQuery = {}) => {
  const userFilter = getUserFilter(req);
  return { ...userFilter, ...additionalQuery };
};

/**
 * Helper function to add user_id to transaction data
 * @param {Object} req - Express request object
 * @param {Object|Array} data - Transaction data (single object or array)
 * @returns {Object|Array} Data with user_id added
 */
export const addUserToTransactionData = (req, data) => {
  const userId = req.user._id;
  
  if (Array.isArray(data)) {
    return data.map(item => ({ ...item, user_id: userId }));
  }
  
  return { ...data, user_id: userId };
};

/**
 * Helper function to add user_id to operation data
 * @param {Object} req - Express request object
 * @param {Object} operationData - Operation data
 * @returns {Object} Operation data with user_id added
 */
export const addUserToOperationData = (req, operationData) => {
  return { ...operationData, user_id: req.user._id };
};