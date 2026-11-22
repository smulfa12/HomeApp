/**
 * 3. Data Pengeluaran dalam periode tertentu
 */
import { createReportPage } from '../shared/transaction-report.js';

export default createReportPage({
  path: '/finance/laporan-pengeluaran',
  type: 'expense',
  title: 'Expense Report',
  emoji: '📉',
  tone: 'peach',
  addHref: '#/finance/expense',
});
