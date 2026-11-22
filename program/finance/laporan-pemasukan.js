/**
 * 4. Data Pemasukan dalam periode tertentu
 */
import { createReportPage } from '../shared/transaction-report.js';

export default createReportPage({
  path: '/finance/laporan-pemasukan',
  type: 'income',
  title: 'Income Report',
  emoji: '📈',
  tone: 'mint',
  addHref: '#/finance/income',
});
