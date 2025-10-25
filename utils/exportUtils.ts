import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Entry } from '../types';

interface EntryWithBalance extends Entry {
  balance: number;
}

interface Totals {
    totalIn: number;
    totalOut: number;
    balance: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

export const exportToPDF = (entries: EntryWithBalance[], title: string, totals: Totals) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  // Summary
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Total In: ${formatCurrency(totals.totalIn)}`, 14, 32);
  doc.text(`Total Out: ${formatCurrency(totals.totalOut)}`, 70, 32);
  doc.text(`Net Balance: ${formatCurrency(totals.balance)}`, 120, 32);


  const tableColumn = ["Date", "Remark", "Cash In", "Cash Out", "Balance"];
  const tableRows: (string | number)[][] = [];

  entries.forEach(entry => {
    const entryData = [
      new Date(entry.date.seconds * 1000).toLocaleDateString(),
      entry.remark,
      entry.type === 'in' ? formatCurrency(entry.amount) : '-',
      entry.type === 'out' ? formatCurrency(entry.amount) : '-',
      formatCurrency(entry.balance)
    ];
    tableRows.push(entryData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    headStyles: { fillColor: [22, 160, 133] },
    theme: 'grid',
  });
  
  doc.save(`${title.replace(/ /g,"_")}.pdf`);
};

export const exportToExcel = (entries: EntryWithBalance[], title: string) => {
  const worksheetData = entries.map(entry => ({
    'Date': new Date(entry.date.seconds * 1000).toLocaleDateString(),
    'Remark': entry.remark,
    'Cash In': entry.type === 'in' ? entry.amount : '',
    'Cash Out': entry.type === 'out' ? entry.amount : '',
    'Balance': entry.balance
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");

  // Adjust column widths
  const columnWidths = [
      { wch: 12 }, // Date
      { wch: 30 }, // Remark
      { wch: 15 }, // Cash In
      { wch: 15 }, // Cash Out
      { wch: 18 }  // Balance
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.writeFile(workbook, `${title.replace(/ /g,"_")}.xlsx`);
};
