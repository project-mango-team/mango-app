import api from './api';

export const transactionService = {
  // Get all transactions with filters
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/transactions?${params}`);
    return response.data;
  },

  // Get single transaction
  getById: async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  // Create transactions (bulk)
  create: async (transactions) => {
    const response = await api.post('/transactions', { transactions });
    return response.data;
  },

  // Update transaction
  update: async (id, data) => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
  },

  // Delete transaction
  delete: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },

  // Delete multiple transactions
  bulkDelete: async (ids) => {
    const response = await api.post('/transactions/bulk-delete', { ids });
    return response.data;
  }
};

export const statsService = {
  // Get general stats
  getStats: async (year = null) => {
    const params = year && year !== 'all' ? `?year=${year}` : '';
    const response = await api.get(`/stats${params}`);
    return response.data;
  },

  // Get expenses by category
  getByCategory: async (year = null) => {
    const params = year && year !== 'all' ? `?year=${year}` : '';
    const response = await api.get(`/stats/categorias${params}`);
    return response.data;
  },

  // Get monthly summary
  getMonthlySummary: async (year = null) => {
    const params = year && year !== 'all' ? `?year=${year}` : '';
    const response = await api.get(`/stats/monthly${params}`);
    return response.data;
  },

  // Get available years
  getYears: async () => {
    const response = await api.get('/stats/years');
    return response.data;
  }
};

export const uploadService = {
  // Detect available cards in a Santander file
  detectCards: async (file, cardType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cardType', cardType);

    const response = await api.post('/upload/detect-cards', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Preview file for parsing (returns transactions without saving)
  previewFile: async (file, tipo, valorDolar, cardType = null, selectedCards = null, tipoResumen = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    formData.append('valorDolar', valorDolar);
    if (cardType) formData.append('cardType', cardType);
    if (selectedCards) formData.append('selectedCards', JSON.stringify(selectedCards));
    if (tipoResumen) formData.append('tipoResumen', tipoResumen);

    const response = await api.post('/upload/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Upload file for parsing and saving
  uploadFile: async (file, tipo, valorDolar, cardType = null, selectedCards = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    formData.append('valorDolar', valorDolar);
    if (cardType) formData.append('cardType', cardType);
    if (selectedCards) formData.append('selectedCards', JSON.stringify(selectedCards));

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Save edited transactions (after preview and editing)
  saveTransactions: async (transactions, tipo, filename, cardType = null, selectedCards = null, tipoResumen = null) => {
    const formData = new FormData();
    formData.append('transactions', JSON.stringify(transactions));
    formData.append('tipo', tipo);
    formData.append('filename', filename);
    if (cardType) formData.append('cardType', cardType);
    if (selectedCards) formData.append('selectedCards', JSON.stringify(selectedCards));
    if (tipoResumen) formData.append('tipoResumen', tipoResumen);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get import history
  getHistory: async () => {
    const response = await api.get('/upload/history');
    return response.data;
  },

  // Rollback an import
  rollback: async (batchId) => {
    const response = await api.delete(`/upload/rollback/${batchId}`);
    return response.data;
  }
};

export const migrateService = {
  // Get preview of Excel file before migration
  preview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/migrate/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Perform full migration
  migrate: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/migrate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get migration history
  getHistory: async () => {
    const response = await api.get('/migrate/history');
    return response.data;
  },

  // Rollback a migration
  rollback: async (migrationId) => {
    const response = await api.delete(`/migrate/${migrationId}`);
    return response.data;
  }
};

export const operationsService = {
  // Get all operations
  getAll: async (type = null, status = null, limit = 50) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit);
    
    const response = await api.get(`/operations?${params.toString()}`);
    return response.data;
  },

  // Get single operation details
  getById: async (operationId) => {
    const response = await api.get(`/operations/${operationId}`);
    return response.data;
  },

  // Rollback an operation
  rollback: async (operationId) => {
    const response = await api.post(`/operations/${operationId}/rollback`);
    return response.data;
  },

  // Get operations summary stats
  getSummary: async () => {
    const response = await api.get('/operations/stats/summary');
    return response.data;
  }
};

export const categoryService = {
  // Get user's categories
  getAll: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Add a new category
  create: async (name) => {
    const response = await api.post('/categories', { name });
    return response.data;
  },

  // Update category name
  update: async (oldName, newName) => {
    const response = await api.put(`/categories/${encodeURIComponent(oldName)}`, { newName });
    return response.data;
  },

  // Delete category
  delete: async (name) => {
    const response = await api.delete(`/categories/${encodeURIComponent(name)}`);
    return response.data;
  }
};
