<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchProductionBatches, fetchTraderOperationsReport, fetchTraderProducts, fetchTraderSalesOrders } from '../../services/api';

const activeFilter = ref('scanner');
const loading = ref(false);
const exporting = ref(false);
const feedback = ref('');
const salesOrders = ref([]);
const productionBatches = ref([]);
const traderProducts = ref([]);
const operationsReport = ref({ stock: {}, production: {}, prices: [], reservations: [] });
const selectedReportMonth = ref(new Date().toISOString().slice(0, 7));

const completedStatuses = new Set(['completed', 'delivered', 'fulfilled']);

const presentationProducts = [
  { id: 'demo-coconut', productName: 'Cocolumber', stockQuantity: 120, reservedQuantity: 18, lowStockThreshold: 50 },
];

const presentationOrders = [
  { id: 'demo-order-1', status: 'completed', createdAt: '2026-05-12T09:00:00', items: [{ productName: 'Cocolumber', size: 'large', quantity: 18, unitPrice: 45, lineTotal: 810 }] },
  { id: 'demo-order-2', status: 'completed', createdAt: '2026-06-15T09:00:00', items: [{ productName: 'Cocolumber', size: 'large', quantity: 22, unitPrice: 48, lineTotal: 1056 }] },
  { id: 'demo-order-3', status: 'completed', createdAt: '2026-07-18T09:00:00', items: [{ productName: 'Cocolumber', size: 'large', quantity: 20, unitPrice: 46, lineTotal: 920 }] },
  { id: 'demo-order-4', status: 'completed', createdAt: '2026-08-10T09:00:00', items: [{ productName: 'Cocolumber', size: 'large', quantity: 25, unitPrice: 50, lineTotal: 1250 }] },
];

const presentationPrices = [
  { productName: 'Cocolumber', effectiveMonth: '2026-01-01', unitPrice: 45, previousPrice: null, trend: 'new' },
  { productName: 'Cocolumber', effectiveMonth: '2026-02-01', unitPrice: 48, previousPrice: 45, trend: 'increased' },
  { productName: 'Cocolumber', effectiveMonth: '2026-03-01', unitPrice: 46, previousPrice: 48, trend: 'decreased' },
  { productName: 'Cocolumber', effectiveMonth: '2026-04-01', unitPrice: 46, previousPrice: 46, trend: 'unchanged' },
  { productName: 'Cocolumber', effectiveMonth: '2026-05-01', unitPrice: 50, previousPrice: 46, trend: 'increased' },
];

const presentationProductionBatches = [
  { id: 'demo-batch-1', tree_name: 'Cocolumber Tree A', total_units: 80, cut_units: 50, status: 'partially_cut' },
  { id: 'demo-batch-2', tree_name: 'Cocolumber Tree B', total_units: 60, cut_units: 35, status: 'partially_cut' },
];

function orderRevenue(order) {
  return (order.items || []).reduce((sum, item) => {
    const lineTotal = Number(item?.lineTotal);
    if (Number.isFinite(lineTotal) && lineTotal >= 0) {
      return sum + lineTotal;
    }

    const fallback = Number(item?.unitPrice || 0) * Number(item?.quantity || 0);
    return sum + (Number.isFinite(fallback) ? fallback : 0);
  }, 0);
}

function monthKey(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  return String(value || '').slice(0, 7);
}

const totalOrders = computed(() => salesOrders.value.length);

const completedOrdersCount = computed(() => {
  return salesOrders.value.filter((order) => completedStatuses.has(String(order.status || '').toLowerCase())).length;
});

const totalItemsSold = computed(() => {
  return salesOrders.value
    .filter((order) => completedStatuses.has(String(order.status || '').toLowerCase()))
    .reduce((sum, order) => {
      return sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
    }, 0);
});

const totalSalesRevenue = computed(() => {
  return Number(
    salesOrders.value
      .filter((order) => completedStatuses.has(String(order.status || '').toLowerCase()))
      .reduce((sum, order) => sum + orderRevenue(order), 0)
      .toFixed(2)
  );
});

const pendingDispatchCount = computed(() => {
  return salesOrders.value.filter((order) => {
    const status = String(order.status || '').toLowerCase();
    return !completedStatuses.has(status) && status !== 'cancelled';
  }).length;
});

const ratedOrders = computed(() => {
  return salesOrders.value.filter((order) => {
    const rating = Number(order.buyerRating);
    return Number.isFinite(rating) && rating >= 1 && rating <= 5;
  });
});

const ratedOrdersCount = computed(() => ratedOrders.value.length);

const averageRating = computed(() => {
  if (!ratedOrders.value.length) return 0;
  const ratingTotal = ratedOrders.value.reduce((sum, order) => sum + Number(order.buyerRating || 0), 0);
  return Number((ratingTotal / ratedOrders.value.length).toFixed(1));
});

const growthPercent = computed(() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return (
        completedStatuses.has(String(order.status || '').toLowerCase())
        && date.getFullYear() === currentYear
        && date.getMonth() === currentMonth
      );
    })
    .reduce((sum, order) => sum + (order.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), 0);

  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const previousMonthSold = salesOrders.value
    .filter((order) => {
      const date = new Date(order.createdAt);
      return (
        completedStatuses.has(String(order.status || '').toLowerCase())
        && date.getFullYear() === previousYear
        && date.getMonth() === previousMonth
      );
    })
    .reduce((sum, order) => sum + (order.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), 0);

  if (previousMonthSold === 0) {
    return currentMonthSold > 0 ? 100 : 0;
  }

  return Number((((currentMonthSold - previousMonthSold) / previousMonthSold) * 100).toFixed(1));
});

const topProducts = computed(() => {
  const map = new Map();

  for (const order of salesOrders.value) {
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

    const orderDate = new Date(order.createdAt);
    if (!Number.isFinite(orderDate.getTime())) continue;
    const orderMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
    if (orderMonth !== selectedReportMonth.value) continue;

    for (const item of order.items || []) {
      const key = `${item.productName || 'Product'}|${item.size || 'N/A'}`;
      map.set(key, (map.get(key) || 0) + Number(item.quantity || 0));
    }
  }

  return Array.from(map.entries())
    .map(([key, quantity]) => {
      const [productName, size] = key.split('|');
      return {
        productName,
        size,
        quantity,
      };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
});

const monthlyBreakdown = computed(() => {
  const rows = new Map();

  for (const order of salesOrders.value) {
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

    const date = new Date(order.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label,
        orders: 0,
        itemsSold: 0,
        revenue: 0,
        pricedUnits: 0,
        priceTotal: 0,
      });
    }

    const row = rows.get(key);
    row.orders += 1;
    row.itemsSold += (order.items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      if (quantity > 0 && unitPrice >= 0) {
        row.pricedUnits += quantity;
        row.priceTotal += quantity * unitPrice;
      }
      return sum + quantity;
    }, 0);
    row.revenue += orderRevenue(order);
  }

  const priceHistoryByMonth = new Map();
  for (const price of operationsReport.value.prices || []) {
    const key = monthKey(price.effectiveMonth);
    if (!priceHistoryByMonth.has(key)) priceHistoryByMonth.set(key, []);
    priceHistoryByMonth.get(key).push(Number(price.unitPrice || 0));
  }

  for (const [key, prices] of priceHistoryByMonth.entries()) {
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label: new Date(`${key}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
        orders: 0,
        itemsSold: 0,
        revenue: 0,
        pricedUnits: 0,
        priceTotal: 0,
      });
    }
    const row = rows.get(key);
    if (row.pricedUnits === 0) {
      row.priceTotal = prices.reduce((sum, price) => sum + price, 0);
      row.pricedUnits = prices.length;
    }
  }

  return Array.from(rows.values())
    .map((row) => ({ ...row, averagePrice: row.pricedUnits ? row.priceTotal / row.pricedUnits : 0 }))
    .sort((a, b) => b.key.localeCompare(a.key));
});

const reportMonthOptions = computed(() => {
  const options = new Map([[selectedReportMonth.value, new Date(`${selectedReportMonth.value}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' })]]);
  monthlyBreakdown.value.forEach((row) => options.set(row.key, row.label));
  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
});

const selectedMonthlyReport = computed(() => {
  return monthlyBreakdown.value.find((row) => row.key === selectedReportMonth.value) || {
    key: selectedReportMonth.value,
    label: new Date(`${selectedReportMonth.value}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    orders: 0,
    itemsSold: 0,
    revenue: 0,
  };
});

const previousMonthlyReport = computed(() => {
  const selectedDate = new Date(`${selectedReportMonth.value}-01T00:00:00`);
  selectedDate.setMonth(selectedDate.getMonth() - 1);
  const previousKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
  return monthlyBreakdown.value.find((row) => row.key === previousKey) || { itemsSold: 0 };
});

const yearlyBreakdown = computed(() => {
  const rows = new Map();

  for (const order of salesOrders.value) {
    if (!completedStatuses.has(String(order.status || '').toLowerCase())) {
      continue;
    }

    const year = String(new Date(order.createdAt).getFullYear());

    if (!rows.has(year)) {
      rows.set(year, {
        year,
        orders: 0,
        itemsSold: 0,
        revenue: 0,
      });
    }

    const row = rows.get(year);
    row.orders += 1;
    row.itemsSold += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    row.revenue += orderRevenue(order);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.year.localeCompare(a.year));
});

const reportCards = computed(() => {
  const selectedMonth = selectedMonthlyReport.value;
  const previousMonth = previousMonthlyReport.value;
  const selectedGrowth = previousMonth.itemsSold === 0
    ? (selectedMonth.itemsSold > 0 ? 100 : 0)
    : Number((((selectedMonth.itemsSold - previousMonth.itemsSold) / previousMonth.itemsSold) * 100).toFixed(1));

  return [
    {
      id: 'total-revenue',
      title: 'Total Sales Revenue',
      value: formatCurrency(selectedMonth.revenue),
      subtitle: `Completed sales in ${selectedMonth.label}`,
      footerLeft: `Orders: ${selectedMonth.orders}`,
      footerRight: `Units: ${selectedMonth.itemsSold}`,
      accent: 'teal',
      tag: 'live',
    },
    {
      id: 'completed-sales',
      title: 'Completed Sales',
      value: `${selectedMonth.orders} orders`,
      subtitle: 'Only completed orders are counted as sales',
      footerLeft: `Items Sold: ${selectedMonth.itemsSold}`,
      footerRight: `Rated: ${ratedOrdersCount.value}`,
      accent: 'green',
      tag: 'live',
    },
    {
      id: 'items-sold',
      title: 'Items Sold',
      value: `${selectedMonth.itemsSold} units`,
      subtitle: `Completed-order quantity in ${selectedMonth.label}`,
      footerLeft: `Top: ${topProducts.value[0]?.productName || '-'}`,
      footerRight: `${topProducts.value[0]?.quantity || 0} units`,
      accent: 'blue',
      tag: 'active',
    },
    {
      id: 'orders',
      title: 'Orders',
      value: `${totalOrders.value} orders`,
      subtitle: 'Total orders received',
      footerLeft: `Completed: ${completedOrdersCount.value}`,
      footerRight: `In Progress: ${pendingDispatchCount.value}`,
      accent: 'purple',
      tag: 'live',
    },
    {
      id: 'rating',
      title: 'Rating',
      value: ratedOrdersCount.value ? `${averageRating.value.toFixed(1)} ★` : 'N/A',
      subtitle: 'Average buyer rating from completed orders',
      footerLeft: `Rated Orders: ${ratedOrdersCount.value}`,
      footerRight: ratedOrdersCount.value ? 'Based on buyer feedback' : 'No ratings yet',
      accent: 'gold',
      tag: ratedOrdersCount.value ? averageRating.value.toFixed(1) : 'N/A',
    },
    {
      id: 'growth',
      title: 'Growth',
      value: `${selectedGrowth > 0 ? '+' : ''}${selectedGrowth}%`,
      subtitle: 'Month-over-month growth',
      footerLeft: `Previous: ${previousMonth.itemsSold || 0} units`,
      footerRight: `Selected: ${selectedMonth.itemsSold} units`,
      accent: selectedGrowth >= 0 ? 'teal' : 'red',
      tag: `${selectedGrowth > 0 ? '+' : ''}${selectedGrowth}%`,
    },
  ];
});

const summaryStats = computed(() => {
  return [
    { id: 'sum-revenue', label: `${selectedMonthlyReport.value.label} Revenue`, value: formatCurrency(selectedMonthlyReport.value.revenue) },
    { id: 'sum-sales', label: `${selectedMonthlyReport.value.label} Completed Sales`, value: String(selectedMonthlyReport.value.orders) },
    { id: 'sum-items', label: `${selectedMonthlyReport.value.label} Items Sold`, value: String(selectedMonthlyReport.value.itemsSold) },
    { id: 'sum-orders', label: 'All-time Orders', value: String(totalOrders.value) },
    {
      id: 'sum-rating',
      label: 'Average Rating',
      value: ratedOrdersCount.value ? `${averageRating.value.toFixed(1)}/5.0` : 'N/A',
    },
  ];
});

const reservationRecommendations = computed(() => {
  return (operationsReport.value.reservations || []).filter((reservation) => {
    const ownerName = String(reservation.owner_name || '').trim();
    const buyerName = String(reservation.buyer_name || '').trim();
    return ownerName && buyerName && ownerName.toLowerCase() !== buyerName.toLowerCase();
  });
});

const productionAnalysis = computed(() => {
  const batches = productionBatches.value
    .filter((batch) => String(batch.status || '').toLowerCase() !== 'cancelled')
    .map((batch) => {
      const madeUnits = Math.max(0, Number(batch.total_units || 0));
      const cutUnits = Math.min(madeUnits, Math.max(0, Number(batch.cut_units || 0)));
      return {
        ...batch,
        madeUnits,
        cutUnits,
        uncutUnits: Math.max(0, madeUnits - cutUnits),
      };
    });

  return {
    batches,
    madeUnits: batches.reduce((sum, batch) => sum + batch.madeUnits, 0),
    cutUnits: batches.reduce((sum, batch) => sum + batch.cutUnits, 0),
    uncutUnits: batches.reduce((sum, batch) => sum + batch.uncutUnits, 0),
  };
});

const stockAnalysis = computed(() => {
  const products = traderProducts.value.map((product) => {
    const stock = Math.max(0, Number(product.stockQuantity || 0));
    const reserved = Math.min(stock, Math.max(0, Number(product.reservedQuantity || 0)));
    const available = Math.max(0, stock - reserved);
    const threshold = Math.max(0, Number(product.lowStockThreshold || 0));
    return {
      ...product,
      stock,
      reserved,
      available,
      threshold,
      isLowStock: available <= threshold,
    };
  });

  return {
    products,
    totalStock: products.reduce((sum, product) => sum + product.stock, 0),
    reservedStock: products.reduce((sum, product) => sum + product.reserved, 0),
    availableStock: products.reduce((sum, product) => sum + product.available, 0),
    lowStockProducts: products.filter((product) => product.isLowStock).length,
  };
});

const statusClasses = {
  verified: 'ok',
  delivered: 'ok',
  approved: 'ok',
  pending: 'warn',
  scheduled: 'warn',
  loading: 'warn',
  to_ship: 'warn',
  cancelled: 'danger',
  rejected: 'danger',
};

const filterLabel = computed(() => {
  if (activeFilter.value === 'scanner') return 'Scanner';
  return 'Reports';
});

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function formatMonth(value) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: 'long' })
    : String(value || 'Unknown');
}

function classForStatus(status) {
  return statusClasses[status] || 'neutral';
}

function formatStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPriceChange(row) {
  if (row.previousPrice === null || row.previousPrice === undefined) return '—';
  const change = Number(row.unitPrice || 0) - Number(row.previousPrice || 0);
  if (change === 0) return formatCurrency(0);
  return `${change > 0 ? '+' : ''}${formatCurrency(change)}`;
}

function priceSystemIndication(trend) {
  if (trend === 'increased') return 'Increased';
  if (trend === 'decreased') return 'Decreased';
  if (trend === 'unchanged') return 'No change';
  return 'Starting price';
}

const excelCurrencyFormat = '[$₱-340A]#,##0.00';

function applySheetTitleStyle(cell) {
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF111827' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
}

function applyGeneratedStampStyle(cell) {
  cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFF3F4F6' } },
    left: { style: 'thin', color: { argb: 'FFF3F4F6' } },
    bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
    right: { style: 'thin', color: { argb: 'FFF3F4F6' } },
  };
}

function applySectionHeaderStyle(cell) {
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F2937' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
}

function applyTableHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111827' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
  row.height = 22;
}

function applyTableBodyStyle(row, isEven) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FAFB' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
  row.height = 20;
}

function addSpacerRow(worksheet, height = 8) {
  const spacer = worksheet.addRow([]);
  spacer.height = height;
}

function autoFitColumns(worksheet, { min = 12, max = 48, padding = 2 } = {}) {
  worksheet.columns.forEach((column) => {
    let longest = min;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      let length = 0;

      if (value == null) {
        length = 0;
      } else if (typeof value === 'string') {
        length = value.length;
      } else if (typeof value === 'number') {
        length = value.toString().length;
      } else if (typeof value === 'object' && value.richText) {
        length = value.richText.map((part) => part.text || '').join('').length;
      } else {
        length = String(value).length;
      }

      if (length > longest) {
        longest = length;
      }
    });

    column.width = Math.max(min, Math.min(max, longest + padding));
  });
}

async function exportReportsToExcel() {
  if (exporting.value) {
    return;
  }

  exporting.value = true;
  feedback.value = '';

  try {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cocolytics';
    workbook.created = new Date();

    const overview = workbook.addWorksheet('Operations Report', { views: [{ showGridLines: false }] });
    overview.columns = [
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    overview.mergeCells('A1:D1');
    overview.getCell('A1').value = 'Cocolytics Trader Operations Report';
    applySheetTitleStyle(overview.getCell('A1'));
    overview.getRow(1).height = 30;

    overview.mergeCells('A2:D2');
    overview.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    applyGeneratedStampStyle(overview.getCell('A2'));
    overview.getRow(2).height = 20;

    const summaryHeader = overview.addRow(['Summary Statistics', '', '', '']);
    overview.mergeCells(`A${summaryHeader.number}:D${summaryHeader.number}`);
    applySectionHeaderStyle(overview.getCell(`A${summaryHeader.number}`));
    summaryHeader.height = 24;

    const summaryTableHeader = overview.addRow(['Metric', 'Value', 'Metric', 'Value']);
    applyTableHeaderStyle(summaryTableHeader);

    const summaryRows = [
      [summaryStats.value[0]?.label || 'Total Sales Revenue', summaryStats.value[0]?.value || formatCurrency(0), summaryStats.value[1]?.label || 'Completed Sales', summaryStats.value[1]?.value || '0'],
      [summaryStats.value[2]?.label || 'Total Items Sold', summaryStats.value[2]?.value || '0', summaryStats.value[3]?.label || 'Total Orders', summaryStats.value[3]?.value || '0'],
      [summaryStats.value[4]?.label || 'Average Rating', summaryStats.value[4]?.value || 'N/A', '', ''],
    ];

    summaryRows.forEach((entry, index) => {
      const row = overview.addRow(entry);
      applyTableBodyStyle(row, index % 2 === 0);
    });

    addSpacerRow(overview);

    const topHeader = overview.addRow(['Top Products', '', '', '']);
    overview.mergeCells(`A${topHeader.number}:D${topHeader.number}`);
    applySectionHeaderStyle(overview.getCell(`A${topHeader.number}`));
    topHeader.height = 24;

    const topTableHeader = overview.addRow(['Product', 'Size', 'Quantity', 'Tag']);
    applyTableHeaderStyle(topTableHeader);

    const topRows = topProducts.value.length
      ? topProducts.value.slice(0, 10).map((row, index) => [row.productName, row.size, row.quantity, index < 3 ? 'Trending' : ''])
      : [['No sold products yet', '-', 0, '-']];

    topRows.forEach((entry, index) => {
      const row = overview.addRow(entry);
      applyTableBodyStyle(row, index % 2 === 0);
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    });

    addSpacerRow(overview);

    const kpiHeader = overview.addRow(['Report KPI Cards', '', '', '']);
    overview.mergeCells(`A${kpiHeader.number}:D${kpiHeader.number}`);
    applySectionHeaderStyle(overview.getCell(`A${kpiHeader.number}`));
    kpiHeader.height = 24;

    const kpiTableHeader = overview.addRow(['Title', 'Value', 'Subtitle', 'Details']);
    applyTableHeaderStyle(kpiTableHeader);

    reportCards.value.forEach((card, index) => {
      const row = overview.addRow([
        card.title,
        card.value,
        card.subtitle,
        `${card.footerLeft} | ${card.footerRight}`,
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
      row.height = 24;
    });

    addSpacerRow(overview);

    const stockHeader = overview.addRow(['Stock Analysis', '', '', '']);
    overview.mergeCells(`A${stockHeader.number}:D${stockHeader.number}`);
    applySectionHeaderStyle(overview.getCell(`A${stockHeader.number}`));
    stockHeader.height = 24;

    const stockSummary = overview.addRow([
      'Total Stock', stockAnalysis.value.totalStock,
      'Available Stock', stockAnalysis.value.availableStock,
    ]);
    applyTableBodyStyle(stockSummary, true);
    const reservedSummary = overview.addRow([
      'Reserved Stock', stockAnalysis.value.reservedStock,
      'Low-stock Products', stockAnalysis.value.lowStockProducts,
    ]);
    applyTableBodyStyle(reservedSummary, false);

    const stockTableHeader = overview.addRow(['Product', 'Total Stock', 'Reserved', 'Available / Threshold']);
    applyTableHeaderStyle(stockTableHeader);

    const stockRows = stockAnalysis.value.products.length
      ? stockAnalysis.value.products.map((product) => [
        product.productName,
        product.stock,
        product.reserved,
        `${product.available} / ${product.threshold}`,
      ])
      : [['No products recorded', 0, 0, '0 / 0']];

    stockRows.forEach((entry, index) => {
      const row = overview.addRow(entry);
      applyTableBodyStyle(row, index % 2 === 0);
    });

    autoFitColumns(overview, { min: 14, max: 52, padding: 3 });

    const monthlySheet = workbook.addWorksheet('Monthly Breakdown', { views: [{ showGridLines: false }] });
    monthlySheet.columns = [
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    monthlySheet.mergeCells('A1:D1');
    monthlySheet.getCell('A1').value = 'Monthly Breakdown';
    applySheetTitleStyle(monthlySheet.getCell('A1'));
    monthlySheet.getRow(1).height = 28;

    const monthlyHeader = monthlySheet.addRow(['Month', 'Orders', 'Items Sold', 'Revenue']);
    applyTableHeaderStyle(monthlyHeader);

    const monthlyRows = monthlyBreakdown.value.length
      ? monthlyBreakdown.value
      : [{ label: 'No monthly data yet', orders: 0, itemsSold: 0, revenue: 0 }];

    monthlyRows.forEach((entry, index) => {
      const row = monthlySheet.addRow([
        entry.label,
        Number(entry.orders || 0),
        Number(entry.itemsSold || 0),
        Number(entry.revenue || 0),
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).numFmt = excelCurrencyFormat;
    });

    autoFitColumns(monthlySheet, { min: 12, max: 30, padding: 2 });

    const yearlySheet = workbook.addWorksheet('Yearly Breakdown', { views: [{ showGridLines: false }] });
    yearlySheet.columns = [
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    yearlySheet.mergeCells('A1:D1');
    yearlySheet.getCell('A1').value = 'Yearly Breakdown';
    applySheetTitleStyle(yearlySheet.getCell('A1'));
    yearlySheet.getRow(1).height = 28;

    const yearlyHeader = yearlySheet.addRow(['Year', 'Orders', 'Items Sold', 'Revenue']);
    applyTableHeaderStyle(yearlyHeader);

    const yearlyRows = yearlyBreakdown.value.length
      ? yearlyBreakdown.value
      : [{ year: 'No yearly data yet', orders: 0, itemsSold: 0, revenue: 0 }];

    yearlyRows.forEach((entry, index) => {
      const row = yearlySheet.addRow([
        entry.year,
        Number(entry.orders || 0),
        Number(entry.itemsSold || 0),
        Number(entry.revenue || 0),
      ]);
      applyTableBodyStyle(row, index % 2 === 0);
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).numFmt = excelCurrencyFormat;
    });

    autoFitColumns(yearlySheet, { min: 12, max: 30, padding: 2 });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([
      buffer,
    ], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const fileDate = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cocolytics-operations-report-${fileDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    feedback.value = error?.message || 'Could not export report to Excel.';
  } finally {
    exporting.value = false;
  }
}

async function loadOperationsData() {
  loading.value = true;
  feedback.value = '';
  try {
    const [salesOrdersData, reportData, productionData, productsData] = await Promise.all([
      fetchTraderSalesOrders(),
      fetchTraderOperationsReport(),
      fetchProductionBatches(),
      fetchTraderProducts(),
    ]);

    salesOrders.value = salesOrdersData.orders || [];
    operationsReport.value = reportData || operationsReport.value;
    productionBatches.value = productionData.batches || [];
    traderProducts.value = productsData.products || [];

    if (!traderProducts.value.length) {
      traderProducts.value = presentationProducts;
    }
    if (!salesOrders.value.length) {
      salesOrders.value = presentationOrders;
    }
    if (!operationsReport.value.prices?.length) {
      operationsReport.value = {
        ...operationsReport.value,
        prices: presentationPrices,
      };
    }
    if (!productionBatches.value.length) {
      productionBatches.value = presentationProductionBatches;
    }
    if (!operationsReport.value.stock?.available_stock && !operationsReport.value.stock?.total_stock) {
      operationsReport.value = {
        ...operationsReport.value,
        stock: { total_stock: 265, reserved_stock: 38, available_stock: 227, low_stock_products: 0 },
      };
    }
  } catch (error) {
    feedback.value = error.message || 'Could not load operations data.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadOperationsData);
</script>

<template>
  <section class="page">
    <header class="head">
      <p class="kicker">Trader Operations</p>
      <h1>Operations Hub</h1>
      <p class="sub">Track scanner flow and reports in one page.</p>
    </header>

    <nav class="filters">
      <button type="button" :class="{ active: activeFilter === 'scanner' }" @click="activeFilter = 'scanner'">Scanner</button>
      <button type="button" :class="{ active: activeFilter === 'reports' }" @click="activeFilter = 'reports'">Reports</button>
    </nav>

    <section class="panel">
      <div class="panel-head">
        <h2>{{ filterLabel }}</h2>
        <button
          v-if="activeFilter === 'reports'"
          type="button"
          class="export-btn"
          :disabled="exporting"
          @click="exportReportsToExcel"
        >
          {{ exporting ? 'Exporting...' : 'Export Excel' }}
        </button>
      </div>
      <p v-if="feedback" class="feedback">{{ feedback }}</p>
      <p v-if="loading" class="muted">Loading operations data...</p>

      <div v-if="!loading && activeFilter === 'scanner'" class="cards-grid">
        <article class="metric-card teal">
          <header class="metric-head"><p>Available Stock</p><span class="metric-tag">Live</span></header>
          <p class="metric-value">{{ operationsReport.stock.available_stock || 0 }}</p>
          <p class="metric-sub">Units not reserved for buyers</p>
        </article>
        <article class="metric-card gold">
          <header class="metric-head"><p>Reserved Stock</p><span class="metric-tag">Held</span></header>
          <p class="metric-value">{{ operationsReport.stock.reserved_stock || 0 }}</p>
          <p class="metric-sub">Units covered by reservations</p>
        </article>
        <article class="metric-card blue">
          <header class="metric-head"><p>Made, Not Yet Cut</p><span class="metric-tag">Production</span></header>
          <p class="metric-value">{{ operationsReport.production.uncut_units || 0 }}</p>
          <p class="metric-sub">{{ operationsReport.production.made_units || 0 }} made, {{ operationsReport.production.cut_units || 0 }} cut</p>
        </article>
        <article class="metric-card red">
          <header class="metric-head"><p>Low Stock</p><span class="metric-tag">Threshold</span></header>
          <p class="metric-value">{{ operationsReport.stock.low_stock_products || 0 }}</p>
          <p class="metric-sub">Configured default trigger: 20 units</p>
        </article>
      </div>

      <section v-if="!loading && activeFilter === 'scanner'" class="production-analysis">
        <article class="analysis-summary">
          <header class="metric-head">
            <p>Tree Production Analysis</p>
            <span class="metric-tag">{{ productionAnalysis.batches.length }} batches</span>
          </header>
          <p class="analysis-value">{{ productionAnalysis.uncutUnits }} units</p>
          <p class="metric-sub">Already made but not yet cut</p>
          <div class="analysis-stats">
            <span>Made: <strong>{{ productionAnalysis.madeUnits }}</strong></span>
            <span>Cut: <strong>{{ productionAnalysis.cutUnits }}</strong></span>
          </div>
        </article>

        <article class="table-block production-table">
          <h3>Uncut Units by Tree</h3>
          <p class="table-hint">Shows how many units remain before each tree batch is cut.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Tree</th><th>Made</th><th>Cut</th><th>Not Yet Cut</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr v-for="batch in productionAnalysis.batches" :key="batch.id">
                  <td>{{ batch.tree_name || 'Unnamed tree' }}</td>
                  <td>{{ batch.madeUnits }}</td>
                  <td>{{ batch.cutUnits }}</td>
                  <td><strong>{{ batch.uncutUnits }}</strong></td>
                  <td><span :class="['badge', classForStatus(batch.status)]">{{ formatStatus(batch.status) }}</span></td>
                </tr>
                <tr v-if="!productionAnalysis.batches.length">
                  <td colspan="5">No active production batches yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section v-if="!loading && activeFilter === 'scanner'" class="table-block stock-analysis-block">
        <div class="recommendation-heading">
          <div>
            <h3>Stock Analysis</h3>
            <p class="table-hint">Available stock excludes units reserved for buyers.</p>
          </div>
          <span class="metric-tag">{{ stockAnalysis.lowStockProducts }} low stock</span>
        </div>
        <div class="stock-summary-grid">
          <div><span>Total stock</span><strong>{{ stockAnalysis.totalStock }}</strong></div>
          <div><span>Reserved</span><strong>{{ stockAnalysis.reservedStock }}</strong></div>
          <div><span>Available</span><strong>{{ stockAnalysis.availableStock }}</strong></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Total Stock</th><th>Reserved</th><th>Available</th><th>Threshold</th><th>Analysis</th></tr></thead>
            <tbody>
              <tr v-for="product in stockAnalysis.products" :key="product.id">
                <td>{{ product.productName }}</td>
                <td>{{ product.stock }}</td>
                <td>{{ product.reserved }}</td>
                <td><strong>{{ product.available }}</strong></td>
                <td>{{ product.threshold }}</td>
                <td><span :class="['badge', product.isLowStock ? 'warn' : 'ok']">{{ product.isLowStock ? 'Low stock' : 'Healthy' }}</span></td>
              </tr>
              <tr v-if="!stockAnalysis.products.length"><td colspan="6">No products recorded yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-else-if="!loading" class="reports-grid">
        <article v-for="card in reportCards" :key="card.id" :class="['metric-card', card.accent]">
          <header class="metric-head">
            <p>{{ card.title }}</p>
            <span class="metric-tag">{{ card.tag }}</span>
          </header>
          <p class="metric-value">{{ card.value }}</p>
          <p class="metric-sub">{{ card.subtitle }}</p>
          <div class="metric-divider"></div>
          <footer class="metric-foot">
            <span>{{ card.footerLeft }}</span>
            <span>{{ card.footerRight }}</span>
          </footer>
        </article>

        <article class="metric-card top-products">
          <header class="metric-head">
            <p>Top Products</p>
            <span class="metric-tag">Trending</span>
          </header>
          <p class="metric-sub">Your best selling grades</p>
          <div class="product-rank" v-for="row in topProducts.slice(0, 3)" :key="`${row.productName}-${row.size}`">
            <span>{{ row.productName }} ({{ row.size }})</span>
            <strong>{{ row.quantity }} units</strong>
          </div>
          <p v-if="!topProducts.length" class="muted">No sold products yet.</p>
        </article>

        <article class="table-block report-stock-block">
          <div class="recommendation-heading">
            <div>
              <h3>Stock Overview</h3>
              <p class="table-hint">Current inventory available for operations.</p>
            </div>
            <span class="metric-tag">{{ stockAnalysis.products.length }} products</span>
          </div>
          <div class="stock-summary-grid">
            <div><span>Total stock</span><strong>{{ stockAnalysis.totalStock }}</strong></div>
            <div><span>Reserved</span><strong>{{ stockAnalysis.reservedStock }}</strong></div>
            <div><span>Available</span><strong>{{ stockAnalysis.availableStock }}</strong></div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Stock</th><th>Reserved</th><th>Available</th></tr></thead>
              <tbody>
                <tr v-for="product in stockAnalysis.products" :key="`report-${product.id}`">
                  <td>{{ product.productName }}</td><td>{{ product.stock }}</td><td>{{ product.reserved }}</td><td><strong>{{ product.available }}</strong></td>
                </tr>
                <tr v-if="!stockAnalysis.products.length"><td colspan="4">No products recorded yet.</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <section v-if="!loading && activeFilter === 'reports'" class="report-tables">
        <article class="table-block">
          <div class="recommendation-heading">
            <div>
              <h3>Monthly Breakdown</h3>
              <p class="table-hint">Completed orders are grouped by their order date.</p>
            </div>
            <label class="month-picker">
              <span>Report month</span>
              <select v-model="selectedReportMonth">
                <option v-for="option in reportMonthOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Orders</th>
                  <th>Items Sold</th>
                  <th>Revenue</th>
                  <th>Avg. Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in monthlyBreakdown" :key="row.key">
                  <td>{{ row.label }}</td>
                  <td>{{ row.orders }}</td>
                  <td>{{ row.itemsSold }}</td>
                  <td>{{ formatCurrency(row.revenue) }}</td>
                  <td>{{ formatCurrency(row.averagePrice) }}</td>
                </tr>
                <tr v-if="!monthlyBreakdown.length">
                  <td colspan="5">No monthly data yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="table-block">
          <h3>Yearly Breakdown</h3>
          <p class="table-hint">Swipe left or right to view all columns.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Orders</th>
                  <th>Items Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in yearlyBreakdown" :key="row.year">
                  <td>{{ row.year }}</td>
                  <td>{{ row.orders }}</td>
                  <td>{{ row.itemsSold }}</td>
                  <td>{{ formatCurrency(row.revenue) }}</td>
                </tr>
                <tr v-if="!yearlyBreakdown.length">
                  <td colspan="4">No yearly data yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="table-block summary-block">
          <h3>Summary Statistics</h3>
          <div class="summary-grid">
            <div class="summary-card" v-for="row in summaryStats" :key="row.id">
              <p>{{ row.label }}</p>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </article>

        <article class="table-block">
          <h3>Monthly Price Movement</h3>
          <div class="table-wrap"><table><thead><tr><th>Product</th><th>Month</th><th>Price per unit</th><th>Change</th><th>System indication</th></tr></thead>
            <tbody><tr v-for="row in operationsReport.prices" :key="`${row.productName}-${row.effectiveMonth}`"><td>{{ row.productName }}</td><td>{{ formatMonth(row.effectiveMonth) }}</td><td>{{ formatCurrency(row.unitPrice) }}</td><td>{{ formatPriceChange(row) }}</td><td>{{ priceSystemIndication(row.trend) }}</td></tr><tr v-if="!operationsReport.prices.length"><td colspan="5">No monthly prices recorded.</td></tr></tbody>
          </table></div>
        </article>

        <article class="table-block recommendation-block">
          <div class="recommendation-heading">
            <div>
              <h3>Reservation Recommendations</h3>
              <p class="table-hint">Each recommendation keeps the tree owner and buyer visibly separate.</p>
            </div>
            <span class="metric-tag">{{ reservationRecommendations.length }} eligible</span>
          </div>
          <div v-if="reservationRecommendations.length" class="recommendation-grid">
            <article v-for="reservation in reservationRecommendations" :key="reservation.id" class="recommendation-card">
              <p class="recommendation-product">{{ reservation.product_name || 'Tree product' }}</p>
              <div class="identity-panel owner-panel">
                <span class="identity-label">Tree owner</span>
                <strong>{{ reservation.owner_name }}</strong>
              </div>
              <div class="identity-panel buyer-panel">
                <span class="identity-label">Buyer</span>
                <strong>{{ reservation.buyer_name }}</strong>
              </div>
              <footer class="recommendation-meta">
                <span>{{ reservation.quantity }} units</span>
                <span :class="['badge', classForStatus(reservation.status)]">{{ formatStatus(reservation.status) }}</span>
              </footer>
            </article>
          </div>
          <p v-else class="muted">No eligible recommendations yet. Owner and buyer names must be different.</p>
        </article>
      </section>
    </section>
  </section>
</template>

<style scoped>
.page {
  --ink: #26352f;
  --muted-ink: #6f7d74;
  --surface: #fffdf8;
  --surface-soft: #f6f4ed;
  --line: #e4e4d9;
  --sage: #5d806d;
  --sage-soft: #e5eee7;
  --clay: #b87858;
  color: var(--ink);
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  color: var(--clay);
}

.head h1 {
  margin: 0.45rem 0 0;
}

.sub {
  margin: 0.35rem 0 0;
  color: var(--muted-ink);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.35rem;
}

.filters button {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted-ink);
  padding: 0.58rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(57, 66, 54, 0.04);
}

.filters button.active {
  background: var(--sage);
  border-color: var(--sage);
  color: #ffffff;
}

.panel {
  margin-top: 1.1rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 253, 248, 0.92);
  padding: 1.15rem;
  box-shadow: 0 12px 32px rgba(57, 66, 54, 0.07);
}

.panel h2 {
  margin: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.export-btn {
  border: 1px solid var(--sage);
  border-radius: 8px;
  background: var(--sage);
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.48rem 0.72rem;
  cursor: pointer;
}

.export-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.feedback {
  margin: 0.7rem 0 0;
  color: #a14f4f;
}

.muted {
  margin: 0.75rem 0 0;
  color: var(--muted-ink);
}

.cards-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.operation-card {
  border: 1px solid rgba(123, 225, 191, 0.28);
  border-radius: 12px;
  background: rgba(5, 26, 36, 0.65);
  padding: 0.7rem;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.card-head h3 {
  margin: 0;
  font-size: 0.95rem;
}

.line {
  margin: 0.35rem 0 0;
  color: #d2ffef;
  font-size: 0.84rem;
}

.badge {
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  border: 1px solid rgba(137, 224, 197, 0.45);
}

.badge.ok {
  background: rgba(25, 123, 87, 0.86);
  color: #dcffee;
}

.badge.warn {
  background: rgba(163, 104, 34, 0.86);
  border-color: rgba(255, 196, 122, 0.5);
  color: #fff2df;
}

.badge.danger {
  background: rgba(145, 45, 63, 0.86);
  border-color: rgba(255, 165, 178, 0.5);
  color: #ffe3e8;
}

.badge.neutral {
  background: rgba(45, 97, 131, 0.85);
  color: #e7f6ff;
}

.reports-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.metric-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  padding: 0.9rem;
  box-shadow: 0 4px 14px rgba(57, 66, 54, 0.04);
}

.metric-card.green { border-color: #c7ddce; }
.metric-card.blue { border-color: #c8d9df; }
.metric-card.purple { border-color: #d9d1df; }
.metric-card.gold { border-color: #e3d5be; }
.metric-card.teal { border-color: #c6dcd6; }
.metric-card.red { border-color: #e3caca; }

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.metric-head p {
  margin: 0;
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 700;
}

.metric-tag {
  border: 1px solid #d5ddd3;
  border-radius: 999px;
  padding: 0.08rem 0.35rem;
  color: var(--muted-ink);
  font-size: 0.6rem;
  text-transform: uppercase;
}

.metric-value {
  margin: 0.4rem 0 0;
  color: var(--ink);
  font-size: 1.55rem;
  font-weight: 900;
}

.metric-sub {
  margin: 0.38rem 0 0;
  color: var(--muted-ink);
  font-size: 0.75rem;
}

.metric-divider {
  margin-top: 0.5rem;
  height: 10px;
  border-radius: 8px;
  background: #edf1eb;
}

.metric-foot {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  margin-top: 0.48rem;
  color: var(--muted-ink);
  font-size: 0.72rem;
}

.top-products .metric-sub { margin-bottom: 0.45rem; }

.product-rank {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-top: 1px solid #e8e9e1;
  color: var(--ink);
  font-size: 0.78rem;
}

.product-rank:first-of-type { border-top: 0; }

.badge {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.12rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.badge.ok { background: #e5f0e6; border-color: #c6ddc9; color: #4c7457; }
.badge.warn { background: #f7ecdb; border-color: #ead4ad; color: #916a35; }
.badge.danger { background: #f6e3e1; border-color: #e6c3bf; color: #9d5d58; }
.badge.neutral { background: #edf0ed; border-color: #d9dfda; color: #68756c; }

.production-analysis {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) minmax(0, 2fr);
  gap: 0.65rem;
}
.analysis-summary {
  border: 1px solid #c9dacd;
  border-radius: 12px;
  background: var(--sage-soft);
  padding: 0.9rem;
}

.analysis-value {
  margin: 0.75rem 0 0;
  color: var(--sage);
  font-size: 2rem;
  font-weight: 900;
}

.analysis-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 0.8rem;
  color: var(--muted-ink);
  font-size: 0.78rem;
}

.analysis-stats strong {
  color: var(--ink);
}

.production-table {
  margin: 0;
}

.stock-analysis-block {
  margin-top: 0.8rem;
  border-color: #d2ddd8;
}

.stock-summary-grid {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.stock-summary-grid div {
  border: 1px solid #dbe3dc;
  border-radius: 8px;
  background: #f4f7f1;
  padding: 0.5rem 0.6rem;
}

.stock-summary-grid span {
  display: block;
  color: var(--muted-ink);
  font-size: 0.72rem;
}

.stock-summary-grid strong {
  display: block;
  margin-top: 0.2rem;
  color: var(--ink);
  font-size: 1.2rem;
}

.recommendation-block {
  border-color: #e4d4c6;
}

.recommendation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.recommendation-heading .table-hint {
  margin-bottom: 0;
}

.month-picker {
  display: grid;
  gap: 0.25rem;
  min-width: 10rem;
  color: var(--muted-ink);
  font-size: 0.72rem;
  font-weight: 700;
}

.month-picker select {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  padding: 0.45rem 0.55rem;
  font: inherit;
}

.recommendation-grid {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.recommendation-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  padding: 0.85rem;
}

.recommendation-product {
  margin: 0 0 0.55rem;
  color: var(--clay);
  font-weight: 800;
}

.identity-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  border-left: 3px solid;
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
}

.identity-panel + .identity-panel {
  margin-top: 0.45rem;
}

.owner-panel {
  border-color: #7e9eaa;
  background: #edf3f2;
}

.buyer-panel {
  border-color: #91a980;
  background: #eef4e9;
}

.identity-label {
  color: var(--muted-ink);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.identity-panel strong {
  color: var(--ink);
  text-align: right;
}

.recommendation-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.6rem;
  color: var(--muted-ink);
  font-size: 0.75rem;
}

.report-tables {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.8rem;
  min-width: 0;
}

.table-block {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding: 0.9rem;
  min-width: 0;
  overflow: hidden;
}

.table-block h3 {
  margin: 0;
  color: var(--ink);
  font-size: 1rem;
}

.table-wrap {
  margin-top: 0.6rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  padding-bottom: 0.24rem;
  scrollbar-width: thin;
  scrollbar-color: #b8c7bc #f0f1eb;
  max-width: 100%;
  min-width: 0;
}

.table-wrap::-webkit-scrollbar {
  height: 9px;
}

.table-wrap::-webkit-scrollbar-track {
  background: #f0f1eb;
  border-radius: 99px;
}

.table-wrap::-webkit-scrollbar-thumb {
  background: #b8c7bc;
  border-radius: 99px;
}

.table-hint {
  margin: 0.42rem 0 0;
  color: #9fdfca;
  font-size: 0.75rem;
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  min-width: 620px;
}

th,
td {
  padding: 0.5rem 0.55rem;
  border-bottom: 1px solid #ecece4;
  text-align: left;
  font-size: 0.8rem;
}

th {
  color: var(--sage);
  background: #f2f4ee;
  font-weight: 800;
}

.summary-grid {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.summary-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  padding: 0.55rem;
}

.summary-card p {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted-ink);
}

.summary-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.1rem;
  color: var(--ink);
}

@media (max-width: 900px) {
  .reports-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .production-analysis {
    grid-template-columns: 1fr;
  }
}

  .recommendation-grid {
    grid-template-columns: 1fr;
  }

  .recommendation-heading {
    flex-direction: column;
  }

@media (max-width: 620px) {
  .cards-grid,
  .reports-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stock-summary-grid {
    grid-template-columns: 1fr;
  }

  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .export-btn {
    width: 100%;
  }
}
</style>
