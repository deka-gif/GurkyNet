import assert from 'node:assert/strict';
import { buildRecentProductsFromTransactions } from './recentProducts.ts';
import { routeForProductCategory } from './catalogRoutes.ts';
import type { Transaction } from '../types/index.ts';

assert.equal(routeForProductCategory('Pulsa Telkomsel'), '/dashboard/pulsa');
assert.equal(routeForProductCategory('Token PLN'), '/dashboard/token-pln');

const txs = [
  {
    id: '1',
    transactionCode: 'T1',
    serviceName: 'Pulsa',
    productName: 'Telkomsel 10.000',
    targetNo: '0812',
    amount: 10500,
    date: '2026-08-07T10:00:00Z',
    status: 'success',
  },
  {
    id: '2',
    transactionCode: 'T2',
    serviceName: 'Pulsa',
    productName: 'Telkomsel 10.000',
    targetNo: '0813',
    amount: 10500,
    date: '2026-08-06T10:00:00Z',
    status: 'success',
  },
  {
    id: '3',
    transactionCode: 'T3',
    serviceName: 'Token PLN',
    productName: 'PLN 20.000',
    targetNo: '14',
    amount: 20500,
    date: '2026-08-07T12:00:00Z',
    status: 'success',
  },
] as Transaction[];

const recent = buildRecentProductsFromTransactions(txs, 5);
assert.equal(recent.length, 2);
assert.equal(recent[0].productName, 'PLN 20.000');
assert.equal(recent[1].productName, 'Telkomsel 10.000');
assert.equal(buildRecentProductsFromTransactions([]).length, 0);

console.log('recentProducts tests passed');
