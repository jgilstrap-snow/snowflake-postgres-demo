const { faker } = require('@faker-js/faker');
const productsData = require('./data/electronics-products.json');

const CUSTOMER_POOL_SIZE = 500;
const VIP_CUSTOMER_COUNT = 25;
const VIP_ORDER_WEIGHT = 0.40;

let customerPool = [];
let vipCustomerIds = [];

function generateCustomer() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName, provider: faker.helpers.arrayElement(['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com']) });
  
  return {
    email: email.toLowerCase(),
    first_name: firstName,
    last_name: lastName
  };
}

function generateCustomerPool(size = CUSTOMER_POOL_SIZE) {
  customerPool = [];
  for (let i = 0; i < size; i++) {
    customerPool.push(generateCustomer());
  }
  return customerPool;
}

function getRandomCustomerFromPool() {
  if (customerPool.length === 0) {
    generateCustomerPool();
  }
  return customerPool[Math.floor(Math.random() * customerPool.length)];
}

function setVipCustomers(customerIds) {
  vipCustomerIds = customerIds.slice(0, VIP_CUSTOMER_COUNT);
}

function selectCustomerIdWithVipBias(allCustomerIds) {
  if (vipCustomerIds.length === 0 || allCustomerIds.length === 0) {
    return allCustomerIds[Math.floor(Math.random() * allCustomerIds.length)];
  }
  
  if (Math.random() < VIP_ORDER_WEIGHT && vipCustomerIds.length > 0) {
    return vipCustomerIds[Math.floor(Math.random() * vipCustomerIds.length)];
  }
  
  return allCustomerIds[Math.floor(Math.random() * allCustomerIds.length)];
}

function selectProductWithCategoryBias() {
  const categories = productsData.categories;
  const products = productsData.products;
  
  const rand = Math.random();
  let cumulative = 0;
  let selectedCategory = 'audio';
  
  for (const [category, config] of Object.entries(categories)) {
    cumulative += config.weight;
    if (rand < cumulative) {
      selectedCategory = category;
      break;
    }
  }
  
  const categoryProducts = products.filter(p => p.category === selectedCategory);
  return categoryProducts[Math.floor(Math.random() * categoryProducts.length)];
}

function generateProduct() {
  const product = selectProductWithCategoryBias();
  const inventoryCount = Math.floor(Math.random() * 150) + 10;
  
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    inventory_count: inventoryCount,
    category: product.category
  };
}

function getAllProducts() {
  return productsData.products.map(p => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    price: p.price,
    inventory_count: Math.floor(Math.random() * 150) + 10,
    category: p.category
  }));
}

function getOrderStatus() {
  const rand = Math.random();
  if (rand < 0.70) return 'completed';
  if (rand < 0.90) return 'pending';
  return 'cancelled';
}

function getWeekendMultiplier(date) {
  const day = date.getDay();
  return (day === 0 || day === 6) ? 3 : 1;
}

function getPeakHourMultiplier(date) {
  const hour = date.getHours();
  const peakHours = [10, 14, 20];
  return peakHours.includes(hour) ? 2 : 1;
}

function shouldGenerateOrder(date) {
  const weekendMult = getWeekendMultiplier(date);
  const peakMult = getPeakHourMultiplier(date);
  const baseProb = 0.3;
  const adjustedProb = Math.min(baseProb * weekendMult * peakMult, 1);
  return Math.random() < adjustedProb;
}

function generateHistoricalDate(daysAgo, hoursOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hoursOffset, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return date;
}

function calculateOrdersPerDay(dayIndex, totalDays) {
  const baseOrders = 50;
  const growthRate = 0.02;
  const weeksElapsed = (totalDays - dayIndex) / 7;
  const growthMultiplier = Math.pow(1 + growthRate, weeksElapsed);
  return Math.floor(baseOrders * growthMultiplier);
}

function generateHistoricalOrderTimestamp(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  const day = date.getDay();
  const isWeekend = (day === 0 || day === 6);
  
  let hour;
  if (Math.random() < 0.4) {
    const peakHours = [10, 14, 20];
    hour = peakHours[Math.floor(Math.random() * peakHours.length)];
    hour += Math.floor(Math.random() * 2);
  } else {
    hour = 8 + Math.floor(Math.random() * 14);
  }
  
  date.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return { date, isWeekend };
}

module.exports = {
  generateCustomer,
  generateCustomerPool,
  getRandomCustomerFromPool,
  setVipCustomers,
  selectCustomerIdWithVipBias,
  selectProductWithCategoryBias,
  generateProduct,
  getAllProducts,
  getOrderStatus,
  getWeekendMultiplier,
  getPeakHourMultiplier,
  shouldGenerateOrder,
  generateHistoricalDate,
  calculateOrdersPerDay,
  generateHistoricalOrderTimestamp,
  CUSTOMER_POOL_SIZE,
  VIP_CUSTOMER_COUNT,
  VIP_ORDER_WEIGHT,
  productsData
};
