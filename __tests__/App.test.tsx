/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Mock services
jest.mock('../services/bill', () => ({
  getBillList: jest.fn(() => Promise.resolve({ code: 200, data: { list: [], totalExpense: 0, totalIncome: 0 } })),
  getBillStatistics: jest.fn(() => Promise.resolve({ code: 200, data: { total_expense: 0, total_income: 0 } })),
  addBill: jest.fn(),
  updateBill: jest.fn(),
  deleteBill: jest.fn(),
}));

// Mock request
jest.mock('../request', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ code: 200, data: { list: [] } })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

test('renders correctly', async () => {
  jest.useFakeTimers();
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    jest.runAllTimers();
  });
  jest.useRealTimers();
});
