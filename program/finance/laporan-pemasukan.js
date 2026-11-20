/**
 * 4. Data Pemasukan dalam periode tertentu
 */
import { createReportPage } from '../shared/transaction-report.js';

export default createReportPage({
  path: '/finance/laporan-pemasukan',
  type: 'income',
  title: 'Data Pemasukan',
  emoji: '📈',
  tone: 'mint',
  addHref: '#/finance/income',
});
