import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubtotal,
  isCouponUsable,
  calculateCouponDiscount,
  calculateTotal,
} from '../src/services/pricing.js';

test('calculateSubtotal cong don gia * so luong cho tung dong', () => {
  const items = [
    { unitPrice: 350000, quantity: 2 },
    { unitPrice: 120000, quantity: 1 },
  ];
  assert.equal(calculateSubtotal(items), 820000);
});

test('calculateSubtotal tra ve 0 voi gio hang rong', () => {
  assert.equal(calculateSubtotal([]), 0);
});

test('isCouponUsable false khi coupon khong active', () => {
  const coupon = { is_active: false, min_order_amount: 0 };
  assert.equal(isCouponUsable({ subtotal: 100000, coupon }), false);
});

test('isCouponUsable false khi chua dat min_order_amount', () => {
  const coupon = { is_active: true, min_order_amount: 500000 };
  assert.equal(isCouponUsable({ subtotal: 100000, coupon }), false);
});

test('isCouponUsable false khi da het luot su dung', () => {
  const coupon = { is_active: true, min_order_amount: 0, usage_limit: 5, used_count: 5 };
  assert.equal(isCouponUsable({ subtotal: 100000, coupon }), false);
});

test('isCouponUsable false khi ngoai khoang thoi gian hieu luc', () => {
  const now = new Date('2026-07-30T00:00:00Z');
  const expired = { is_active: true, min_order_amount: 0, expires_at: '2026-01-01T00:00:00Z' };
  const notStarted = { is_active: true, min_order_amount: 0, starts_at: '2026-12-01T00:00:00Z' };
  assert.equal(isCouponUsable({ subtotal: 100000, coupon: expired, now }), false);
  assert.equal(isCouponUsable({ subtotal: 100000, coupon: notStarted, now }), false);
});

test('calculateCouponDiscount tinh dung phan tram', () => {
  const coupon = { is_active: true, min_order_amount: 0, discount_type: 'percentage', discount_value: 10 };
  assert.equal(calculateCouponDiscount({ subtotal: 1000000, coupon }), 100000);
});

test('calculateCouponDiscount gioi han boi max_discount_amount', () => {
  const coupon = {
    is_active: true,
    min_order_amount: 0,
    discount_type: 'percentage',
    discount_value: 50,
    max_discount_amount: 50000,
  };
  assert.equal(calculateCouponDiscount({ subtotal: 1000000, coupon }), 50000);
});

test('calculateCouponDiscount fixed khong vuot qua subtotal', () => {
  const coupon = { is_active: true, min_order_amount: 0, discount_type: 'fixed', discount_value: 300000 };
  assert.equal(calculateCouponDiscount({ subtotal: 100000, coupon }), 100000);
});

test('calculateCouponDiscount tra ve 0 khi coupon khong hop le', () => {
  const coupon = { is_active: false, min_order_amount: 0, discount_type: 'fixed', discount_value: 50000 };
  assert.equal(calculateCouponDiscount({ subtotal: 100000, coupon }), 0);
});

test('calculateTotal = subtotal - discount + shipping', () => {
  assert.equal(calculateTotal({ subtotal: 500000, discountAmount: 50000, shippingFee: 20000 }), 470000);
});
