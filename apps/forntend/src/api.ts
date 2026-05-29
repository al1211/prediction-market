import axios from "axios";

const API_BASE = "http://localhost:3000";

export const api = {
  // Public endpoints
  getMarkets: async () => {
    const response = await axios.get(`${API_BASE}/markets`);
    return response.data;
  },

  getMarket: async (marketId: string) => {
    const response = await axios.get(`${API_BASE}/market`, {
      params: { marketId }
    });
    return response.data;
  },

  // Protected endpoints (require auth token)
  placeOrder: async (token: string, orderData: {
    marketId: string;
    side: "yes" | "no";
    type: "buy" | "sell";
    price: number;
    qty: number;
  }) => {
    const response = await axios.post(`${API_BASE}/order`, orderData, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  getBalance: async (token: string) => {
    const response = await axios.get(`${API_BASE}/balance`, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  getPositions: async (token: string) => {
    const response = await axios.get(`${API_BASE}/positions`, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  getOrderHistory: async (token: string) => {
    const response = await axios.post(`${API_BASE}/history`, {}, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  splitPosition: async (token: string, data: {
    marketId: string;
    amount: number;
  }) => {
    const response = await axios.post(`${API_BASE}/split`, data, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  mergePosition: async (token: string, data: {
    marketId: string;
    amount: number;
  }) => {
    const response = await axios.post(`${API_BASE}/merge`, data, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  onramp: async (token: string, amount: number) => {
    const response = await axios.post(`${API_BASE}/onramp`, { amount }, {
      headers: { Authorization: token }
    });
    return response.data;
  },

  offramp: async (token: string, amount: number) => {
    const response = await axios.post(`${API_BASE}/offramp`, { amount }, {
      headers: { Authorization: token }
    });
    return response.data;
  },
};