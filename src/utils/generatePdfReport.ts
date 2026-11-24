import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import type { CurrencyCode, MonthlyReportResponse } from '../types';
import { formatCurrency, formatDisplayDate, MONTH_OPTIONS } from './formatCurrency';

export async function downloadMonthlyPdfReport(
  month: number,
  year: number,
  currencyOverride?: CurrencyCode
): Promise<string> {
  const res = await api.get<MonthlyReportResponse>('/analytics/report', {
    params: { month, year },
  });

  const data = res.data;
  const currency: CurrencyCode = currencyOverride || data.user?.currency || 'PKR';
  const monthLabel =
    MONTH_OPTIONS.find((m) => m.value === month)?.label || `Month ${month}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 96, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Multi-Wallet Financial Report', 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Period: ${monthLabel} ${year}   |   Account: ${data.user?.name || 'User'} (${data.user?.email || ''})`,
    40,
    62
  );
  doc.text(
    `Generated: ${new Date(data.generatedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}   |   Currency: ${currency}`,
    40,
    78
  );

  let cursorY = 122;

  // Section 1: Executive Summary
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. Monthly Financial Summary', 40, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9.5, textColor: [30, 41, 59] },
    head: [['Metric', 'Value', 'Notes']],
    body: [
      [
        'Total Net Worth',
        formatCurrency(data.summary.totalNetWorth, currency),
        `Across ${data.accounts.length} active wallet(s)`,
      ],
      [
        'Monthly Income',
        formatCurrency(data.summary.totalIncome, currency, true),
        'Total inflows recorded in period',
      ],
      [
        'Monthly Expenses',
        formatCurrency(data.summary.totalExpense, currency),
        `${data.categoryBreakdown.length} spending categories`,
      ],
      [
        'Net Savings',
        formatCurrency(data.summary.netSavings, currency),
        `${data.summary.savingsRate}% savings rate`,
      ],
      [
        'Internal Transfers',
        formatCurrency(data.summary.totalTransfers, currency),
        `${data.summary.transactionCount} total ledger entries`,
      ],
    ],
    margin: { left: 40, right: 40 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Section 2: Expense Breakdown by Category
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Expense Breakdown by Category', 40, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    head: [['Category', 'Transactions', 'Share (%)', 'Total Spent']],
    body:
      data.categoryBreakdown.length > 0
        ? data.categoryBreakdown.map((c) => [
            c.name,
            String(c.count),
            `${c.percentage}%`,
            formatCurrency(c.total, currency),
          ])
        : [['No expenses recorded for this period', '-', '-', '-']],
    margin: { left: 40, right: 40 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Section 3: Budgets & Savings Goals Progress
  if (cursorY > 650) {
    doc.addPage();
    cursorY = 48;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Monthly Budgets & Savings Progress', 40, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    head: [['Budget Category', 'Limit', 'Spent', 'Remaining', 'Usage']],
    body:
      data.budgetSummary.length > 0
        ? data.budgetSummary.map((b) => [
            b.categoryName,
            formatCurrency(b.limit, currency),
            formatCurrency(b.spent, currency),
            formatCurrency(b.remaining, currency),
            `${b.percentage}% (${b.status.replace('_', ' ')})`,
          ])
        : [['No monthly budgets configured', '-', '-', '-', '-']],
    margin: { left: 40, right: 40 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  autoTable(doc, {
    startY: cursorY,
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    head: [['Savings Goal', 'Saved', 'Target', 'Progress', 'Target Date']],
    body:
      data.goals.length > 0
        ? data.goals.map((g) => {
            const pct =
              g.targetAmount > 0
                ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 1000) / 10)
                : 0;
            return [
              g.title,
              formatCurrency(g.currentAmount, currency),
              formatCurrency(g.targetAmount, currency),
              `${pct}%`,
              g.deadline ? formatDisplayDate(g.deadline) : 'Open-ended',
            ];
          })
        : [['No active savings goals', '-', '-', '-', '-']],
    margin: { left: 40, right: 40 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Section 4: Wallet Balances & Detailed Transactions
  if (cursorY > 650) {
    doc.addPage();
    cursorY = 48;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Wallet Balances & Period Transactions', 40, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    head: [['Wallet Name', 'Type', 'Current Balance']],
    body: data.accounts.map((a) => [
      a.name,
      a.type.replace('_', ' '),
      formatCurrency(a.balance, currency),
    ]),
    margin: { left: 40, right: 40 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  autoTable(doc, {
    startY: cursorY,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    head: [['Date', 'Title', 'Category / Flow', 'Wallet', 'Type', 'Amount']],
    body:
      data.transactions.length > 0
        ? data.transactions.map((tx) => [
            formatDisplayDate(tx.date),
            tx.title,
            tx.type === 'TRANSFER'
              ? `${tx.account.name} -> ${tx.toAccount?.name || ''}`
              : tx.category?.name || 'Uncategorized',
            tx.account.name,
            tx.type,
            formatCurrency(tx.amount, currency, tx.type === 'INCOME'),
          ])
        : [['-', 'No transactions recorded in this month', '-', '-', '-', '-']],
    margin: { left: 40, right: 40 },
  });

  const filename = `Multi-Wallet-Report-${year}-${String(month).padStart(2, '0')}.pdf`;
  doc.save(filename);
  return filename;
}
