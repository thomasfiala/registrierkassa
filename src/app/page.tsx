'use client';
import { useState, useEffect, useMemo } from 'react';

type Item = { name: string; price: number; taxRate: string; id: number; quantity: number };
type Template = { name: string; price: number; taxRate: string };
type Receipt = { id: string; receiptNumber: string; date: string; type: string; totalAmount: number; customerNameAndAddress?: string; customerEmail?: string; isStorno?: boolean; stornoed?: boolean; stornoRef?: string; convertedToFinal?: boolean; items: any[]; paymentMethod?: string; customMessage?: string; depositName?: string; depositAmount?: number; subtotalAmount?: number };

type CashEntry = {
  id: string;
  type: 'Einzahlung' | 'Auszahlung';
  amount: number;
  date: string;
  comment: string;
  createdAt?: string;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'pos' | 'kassabuch'>('pos');

  // Kassabuch State
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [entryType, setEntryType] = useState<'Einzahlung' | 'Auszahlung'>('Einzahlung');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [entryComment, setEntryComment] = useState('');
  const [cashStatus, setCashStatus] = useState('');
  const [cashFilter, setCashFilter] = useState<'all' | 'manual' | 'receipts'>('all');
  const [cashSearch, setCashSearch] = useState('');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState('final');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customTax, setCustomTax] = useState('20%');
  const [depositName, setDepositName] = useState('Anzahlung');
  const [depositAmount, setDepositAmount] = useState('');
  const [customerInfo, setCustomerInfo] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bar');
  const [paymentMethodsData, setPaymentMethodsData] = useState<{name: string, feePercentage?: number, feeTaxRate?: string}[]>([
    { name: 'bar' },
    { name: 'SumUp' },
    { name: 'Überweisung' },
    { name: 'PayPal' }
  ]);
  const [appHeader, setAppHeader] = useState('Registrierkassa POS');
  const [emailTexts, setEmailTexts] = useState({ subject: '', body: '' });
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date'|'receiptNumber'>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [fromProformaId, setFromProformaId] = useState<string | undefined>(undefined);

  const [emailModal, setEmailModal] = useState<{ open: boolean; receiptNumber: string; to: string; subject: string; text: string; status: string }>({ open: false, receiptNumber: '', to: '', subject: '', text: '', status: '' });

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => {
      if (data.appHeader) setAppHeader(data.appHeader);
      if (data.itemTemplates) setTemplates(data.itemTemplates);
      if (data.invoiceTexts?.customMessageDefault) setCustomMessage(data.invoiceTexts.customMessageDefault);
      if (data.emailTexts) setEmailTexts(data.emailTexts);
      if (data.paymentMethods && data.paymentMethods.length > 0) {
        setPaymentMethodsData(data.paymentMethods);
        setPaymentMethod(data.paymentMethods[0].name);
      }
    });
    loadReceipts();
    loadCashEntries();
  }, []);

  const loadReceipts = async () => {
    const res = await fetch('/api/invoice');
    const data = await res.json();
    if (data.success) {
      setReceipts(data.receipts);
    }
  };

  const loadCashEntries = async () => {
    try {
      const res = await fetch('/api/cashbook');
      const data = await res.json();
      if (data.success) {
        setCashEntries(data.entries || []);
      }
    } catch (e) {
      console.error('Failed to load cashbook entries', e);
    }
  };

  const addItem = (item: Omit<Item, 'id' | 'quantity'>) => {
    setItems([...items, { ...item, id: Date.now() + Math.random(), quantity: 1 }]);
  };

  const addCustomItem = () => {
    if (!customName || !customPrice) return;
    addItem({ name: customName, price: parseFloat(customPrice), taxRate: customTax });
    setCustomName('');
    setCustomPrice('');
  };

  const updateItemQty = (id: number, qty: number) => {
    setItems(items.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };
  
  const updateItemPrice = (id: number, price: number) => {
    setItems(items.map(i => i.id === id ? { ...i, price: price } : i));
  };
  
  const updateItemName = (id: number, name: string) => {
    setItems(items.map(i => i.id === id ? { ...i, name: name } : i));
  };

  const updateItemTax = (id: number, taxRate: string) => {
    setItems(items.map(i => i.id === id ? { ...i, taxRate: taxRate } : i));
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleCreate = async () => {
    if (items.length === 0) {
      setStatus('Cart is empty.');
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const depositVal = parseFloat(depositAmount) || 0;
    const isDepositSet = Math.abs(depositVal) > 0.0001;
    const remainingBase = isDepositSet ? (subtotal - depositVal) : subtotal;

    const selectedMethod = paymentMethodsData.find(m => m.name === paymentMethod);
    const feeAmount = (selectedMethod?.feePercentage && selectedMethod.feePercentage > 0 && remainingBase > 0) 
      ? remainingBase * (selectedMethod.feePercentage / 100) 
      : 0;

    const finalItems = [...items];
    if (feeAmount > 0) {
      finalItems.push({
        id: Date.now() + Math.random(),
        name: `Gebühr ${selectedMethod!.name}`,
        price: feeAmount,
        quantity: 1,
        taxRate: selectedMethod!.feeTaxRate || '0%'
      });
    }

    setStatus('Creating...');
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: finalItems,
        type,
        customerNameAndAddress: customerInfo,
        customerEmail,
        customMessage,
        paymentMethod,
        depositName: isDepositSet ? (depositName || 'Anzahlung') : undefined,
        depositAmount: isDepositSet ? depositVal : undefined,
        fromProformaId
      })
    });
    
    const data = await res.json();
    if (data.success) {
      setStatus(`Success! Created ${data.receipt.receiptNumber}`);
      setItems([]);
      setCustomerInfo('');
      setCustomerEmail('');
      setDepositName('Anzahlung');
      setDepositAmount('');
      setFromProformaId(undefined);
      loadReceipts();
      loadCashEntries();
    } else {
      setStatus(`Error: ${data.error}`);
    }
  };

  const handlePreview = async () => {
    if (items.length === 0) {
      setStatus('Cart is empty.');
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const depositVal = parseFloat(depositAmount) || 0;
    const isDepositSet = Math.abs(depositVal) > 0.0001;
    const remainingBase = isDepositSet ? (subtotal - depositVal) : subtotal;

    const selectedMethod = paymentMethodsData.find(m => m.name === paymentMethod);
    const feeAmount = (selectedMethod?.feePercentage && selectedMethod.feePercentage > 0 && remainingBase > 0) 
      ? remainingBase * (selectedMethod.feePercentage / 100) 
      : 0;

    const finalItems = [...items];
    if (feeAmount > 0) {
      finalItems.push({
        id: Date.now() + Math.random(),
        name: `Gebühr ${selectedMethod!.name}`,
        price: feeAmount,
        quantity: 1,
        taxRate: selectedMethod!.feeTaxRate || '0%'
      });
    }

    setStatus('Loading preview...');
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: finalItems,
        type,
        customerNameAndAddress: customerInfo,
        customerEmail,
        customMessage,
        paymentMethod,
        depositName: isDepositSet ? (depositName || 'Anzahlung') : undefined,
        depositAmount: isDepositSet ? depositVal : undefined,
        isPreview: true
      })
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setStatus('');
    } else {
      setStatus('Preview failed');
    }
  };

  const handleLoadProforma = (r: Receipt) => {
    setItems(r.items.map((i: any) => ({...i, id: Date.now() + Math.random()})));
    setCustomerInfo(r.customerNameAndAddress || '');
    setCustomerEmail(r.customerEmail || '');
    if (r.customMessage !== undefined) setCustomMessage(r.customMessage);
    if (r.paymentMethod) setPaymentMethod(r.paymentMethod);
    if (r.depositAmount && Math.abs(r.depositAmount) > 0.0001) {
      setDepositName(r.depositName || 'Anzahlung');
      setDepositAmount(String(Math.abs(r.depositAmount)));
    } else {
      setDepositName('Anzahlung');
      setDepositAmount('');
    }
    setType('final');
    setFromProformaId(r.id);
    setStatus(`Loaded Proforma ${r.receiptNumber}. You can now save it as a final invoice.`);
  };

  const handleLoadCancelled = (r: Receipt) => {
    const sourceReceipt = (r.isStorno && r.stornoRef)
      ? receipts.find(x => x.receiptNumber === r.stornoRef) || r
      : r;
    const isSourceStorno = sourceReceipt.isStorno;

    setItems(sourceReceipt.items.map((i: any) => ({
      ...i,
      id: Date.now() + Math.random(),
      price: isSourceStorno ? Math.abs(i.price) : i.price
    })));
    setCustomerInfo(sourceReceipt.customerNameAndAddress || '');
    setCustomerEmail(sourceReceipt.customerEmail || '');
    if (sourceReceipt.customMessage !== undefined) setCustomMessage(sourceReceipt.customMessage);
    if (sourceReceipt.paymentMethod) setPaymentMethod(sourceReceipt.paymentMethod);
    if (sourceReceipt.depositAmount && Math.abs(sourceReceipt.depositAmount) > 0.0001) {
      setDepositName(sourceReceipt.depositName || 'Anzahlung');
      setDepositAmount(String(Math.abs(sourceReceipt.depositAmount)));
    } else {
      setDepositName('Anzahlung');
      setDepositAmount('');
    }
    setType('final');
    setFromProformaId(undefined);
    setStatus(`Rechnung ${r.receiptNumber} geladen. Sie können diese bearbeiten und neu erstellen.`);
  };

  const handleDeleteProforma = async (id: string) => {
    if (!confirm('Delete proforma?')) return;
    await fetch(`/api/invoice?id=${id}`, { method: 'DELETE' });
    loadReceipts();
  };

  const handleStorno = async (r: Receipt) => {
    if (!confirm(`Storno invoice ${r.receiptNumber}?`)) return;
    setStatus('Creating Storno...');
    const inverseItems = r.items.map((i: any) => ({ ...i, price: -Math.abs(i.price) }));
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: inverseItems,
        type: 'final',
        customerNameAndAddress: r.customerNameAndAddress,
        customerEmail: r.customerEmail,
        customMessage: r.customMessage,
        paymentMethod: r.paymentMethod,
        depositName: r.depositName,
        depositAmount: r.depositAmount ? -Math.abs(r.depositAmount) : undefined,
        isStorno: true,
        stornoRef: r.receiptNumber
      })
    });
    if (res.ok) {
      setStatus(`Storno created.`);
      loadReceipts();
      loadCashEntries();
    } else {
      setStatus('Storno failed.');
    }
  };

  const handleNullbeleg = async () => {
    setStatus('Creating Nullbeleg...');
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ name: 'Nullbeleg', price: 0, quantity: 1, taxRate: '0%' }], type: 'final', isSystemBeleg: true, systemType: 'Nullbeleg' })
    });
    if (res.ok) {
      setStatus(`Nullbeleg created.`);
      loadReceipts();
    }
  };

  const openEmailModal = (r: Receipt) => {
    const origReceipt = (r.isStorno && r.stornoRef)
      ? receipts.find(x => x.receiptNumber === r.stornoRef)
      : undefined;

    const customerInfoStr = r.customerNameAndAddress || origReceipt?.customerNameAndAddress || '';
    const salutation = customerInfoStr ? customerInfoStr.split('\n')[0] : 'Kunde';
    const toEmail = r.customerEmail || origReceipt?.customerEmail || '';

    let defaultSubject = '';
    let defaultBody = '';

    if (r.isStorno) {
      defaultSubject = `Storno ${r.receiptNumber} (${new Date(r.date).toLocaleDateString('de-AT')})`;
      defaultBody = `Hallo ${salutation},\n\nanbei finden Sie Ihren Stornobeleg.`;
    } else {
      defaultSubject = emailTexts.subject
        ? `${emailTexts.subject} ${r.receiptNumber} (${new Date(r.date).toLocaleDateString('de-AT')})`
        : `Rechnung ${r.receiptNumber}`;
      defaultBody = `Hallo ${salutation},\n\n${emailTexts.body || 'anbei finden Sie Ihre Rechnung.'}`;
    }

    setEmailModal({
      open: true,
      receiptNumber: r.receiptNumber,
      to: toEmail,
      subject: defaultSubject,
      text: defaultBody,
      status: ''
    });
  };

  const sendEmail = async () => {
    setEmailModal({ ...emailModal, status: 'Sending...' });
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiptNumber: emailModal.receiptNumber,
        to: emailModal.to,
        subject: emailModal.subject,
        text: emailModal.text
      })
    });
    const data = await res.json();
    if (data.success) {
      setEmailModal({ ...emailModal, status: 'Sent successfully!', open: false });
    } else {
      setEmailModal({ ...emailModal, status: `Error: ${data.error}` });
    }
  };

  const subtotalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const depositVal = parseFloat(depositAmount) || 0;
  const isDepositSet = Math.abs(depositVal) > 0.0001;
  const remainingBase = isDepositSet ? (subtotalAmount - depositVal) : subtotalAmount;

  const selectedMethodForTotal = paymentMethodsData.find(m => m.name === paymentMethod);
  const currentFeeAmount = (selectedMethodForTotal?.feePercentage && selectedMethodForTotal.feePercentage > 0 && remainingBase > 0)
    ? remainingBase * (selectedMethodForTotal.feePercentage / 100)
    : 0;
  const totalAmount = remainingBase + currentFeeAmount;

  const filteredReceipts = receipts.filter(r => 
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) || 
      (r.customerNameAndAddress || '').toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortDesc ? 1 : -1;
      if (valA > valB) return sortDesc ? -1 : 1;
      return 0;
  });

  // --- Kassabuch Functions ---
  const handleCreateCashEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(entryAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setCashStatus('Fehler: Bitte einen Betrag größer als 0 eingeben.');
      return;
    }

    setCashStatus('Speichere Buchung...');
    try {
      const res = await fetch('/api/cashbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entryType,
          amount: parsed,
          date: entryDate || new Date().toISOString().substring(0, 10),
          comment: entryComment
        })
      });
      const data = await res.json();
      if (data.success) {
        setCashStatus(`Erfolgreich gebucht: ${entryType} € ${parsed.toFixed(2)}`);
        setEntryAmount('');
        setEntryComment('');
        loadCashEntries();
      } else {
        setCashStatus(`Fehler: ${data.error}`);
      }
    } catch (err: any) {
      setCashStatus(`Fehler: ${err.message}`);
    }
  };

  const handleUpdateCashEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const parsed = typeof editingEntry.amount === 'number' ? editingEntry.amount : parseFloat(String(editingEntry.amount));
    if (isNaN(parsed) || parsed <= 0) {
      alert('Bitte einen Betrag größer als 0 eingeben.');
      return;
    }

    try {
      const res = await fetch('/api/cashbook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEntry.id,
          type: editingEntry.type,
          amount: parsed,
          date: editingEntry.date,
          comment: editingEntry.comment
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingEntry(null);
        loadCashEntries();
        setCashStatus('Eintrag aktualisiert.');
      } else {
        alert(`Fehler: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    }
  };

  const handleDeleteCashEntry = async (id: string) => {
    if (!confirm('Diesen Kassabucheintrag wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/cashbook?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadCashEntries();
        setCashStatus('Eintrag gelöscht.');
      } else {
        alert(`Fehler: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    }
  };

  // --- Calculations for Cash Balance and Dynamic Diagram ---
  const cashCalculations = useMemo(() => {
    // 1. All final invoices paid in cash ('bar')
    const barReceipts = receipts.filter(r => r.type === 'final' && r.paymentMethod?.toLowerCase() === 'bar');
    const totalCashFromReceipts = barReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // 2. Sum of manual deposits and withdrawals
    const totalEinzahlungen = cashEntries
      .filter(e => e.type === 'Einzahlung')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalAuszahlungen = cashEntries
      .filter(e => e.type === 'Auszahlung')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 3. Current cash present in register
    const currentCashBalance = totalCashFromReceipts + totalEinzahlungen - totalAuszahlungen;

    // 4. Generate 12 months data
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const fullMonthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const months12: { key: string; label: string; fullLabel: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = `${monthNames[m]} '${String(y).slice(-2)}`;
      const fullLabel = `${fullMonthNames[m]} ${y}`;
      months12.push({ key, label, fullLabel, year: y, month: m });
    }

    const firstMonthKey = months12[0].key;

    // Combined movements list
    type MovementItem = {
      id: string;
      date: string;
      monthKey: string;
      type: 'Einzahlung' | 'Auszahlung' | 'Bar-Beleg';
      amount: number;
      comment: string;
      source: 'receipt' | 'manual';
      receiptNumber?: string;
      rawEntry?: CashEntry;
    };

    const allMovements: MovementItem[] = [
      ...barReceipts.map(r => {
        const dStr = (r.date || '').substring(0, 10);
        const mKey = dStr.substring(0, 7);
        const amt = r.totalAmount || 0;
        const isStorno = r.isStorno || amt < 0;
        const desc = `${isStorno ? 'Storno-Beleg' : 'Rechnung'} ${r.receiptNumber}${r.customerNameAndAddress ? ' (' + r.customerNameAndAddress.split('\n')[0] + ')' : ''}`;
        return {
          id: `rec-${r.id || r.receiptNumber}`,
          date: dStr,
          monthKey: mKey,
          type: 'Bar-Beleg' as const,
          amount: amt,
          comment: desc,
          source: 'receipt' as const,
          receiptNumber: r.receiptNumber
        };
      }),
      ...cashEntries.map(e => {
        const dStr = (e.date || '').substring(0, 10);
        const mKey = dStr.substring(0, 7);
        const amt = e.type === 'Einzahlung' ? e.amount : -e.amount;
        return {
          id: `man-${e.id}`,
          date: dStr,
          monthKey: mKey,
          type: e.type,
          amount: amt,
          comment: e.comment || (e.type === 'Einzahlung' ? 'Bareinzahlung' : 'Barauszahlung'),
          source: 'manual' as const,
          rawEntry: e
        };
      })
    ].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate prior balance before the 12 month window
    const priorBalance = allMovements
      .filter(m => m.monthKey < firstMonthKey)
      .reduce((sum, m) => sum + m.amount, 0);

    let rollingBalance = priorBalance;
    const monthlyStats = months12.map(m => {
      const monthItems = allMovements.filter(item => item.monthKey === m.key);
      const inflow = monthItems.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
      const outflow = monthItems.filter(item => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const net = inflow - outflow;
      rollingBalance += net;

      return {
        ...m,
        inflow,
        outflow,
        net,
        balance: rollingBalance,
        count: monthItems.length
      };
    });

    // Compute running balance for all movements (for journal view)
    let journalRunning = 0;
    const journalEntries = allMovements.map(m => {
      journalRunning += m.amount;
      return {
        ...m,
        balanceAfter: journalRunning
      };
    }).reverse(); // newest first

    return {
      barReceiptsCount: barReceipts.length,
      totalCashFromReceipts,
      totalEinzahlungen,
      totalAuszahlungen,
      currentCashBalance,
      monthlyStats,
      journalEntries
    };
  }, [receipts, cashEntries]);

  // Diagram coordinates and scaling
  const chartConfig = useMemo(() => {
    const stats = cashCalculations.monthlyStats;
    if (stats.length === 0) return null;

    const balances = stats.map(s => s.balance);
    const flows = stats.flatMap(s => [s.inflow, s.outflow]);
    
    let minVal = Math.min(0, ...balances);
    let maxVal = Math.max(100, ...balances, ...flows);
    
    // Add 15% top padding to chart for aesthetic headroom
    const range = maxVal - minVal || 100;
    maxVal = maxVal + range * 0.15;
    if (minVal < 0) minVal = minVal - range * 0.05;

    const svgWidth = 840;
    const svgHeight = 280;
    const padLeft = 70;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 45;

    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    const getX = (index: number) => padLeft + (index / (stats.length - 1)) * plotWidth;
    const getY = (val: number) => padTop + plotHeight - ((val - minVal) / (maxVal - minVal)) * plotHeight;
    const zeroY = getY(0);

    const points = stats.map((s, i) => ({
      x: getX(i),
      y: getY(s.balance),
      barX: getX(i) - 14,
      inflowY: getY(s.inflow),
      inflowHeight: zeroY - getY(s.inflow),
      outflowY: zeroY,
      outflowHeight: getY(-s.outflow) - zeroY,
      stat: s
    }));

    // Generate SVG path for line
    const linePath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // Generate area path under the line down to bottom
    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`
      : '';

    // 4 Y-axis ticks
    const yTicks = [0, 0.33, 0.66, 1].map(fraction => {
      const val = minVal + fraction * (maxVal - minVal);
      return {
        val,
        y: getY(val)
      };
    });

    return {
      svgWidth,
      svgHeight,
      padLeft,
      padTop,
      plotWidth,
      plotHeight,
      zeroY,
      points,
      linePath,
      areaPath,
      yTicks,
      minVal,
      maxVal
    };
  }, [cashCalculations.monthlyStats]);

  const filteredJournalEntries = cashCalculations.journalEntries.filter(entry => {
    if (cashFilter === 'manual' && entry.source !== 'manual') return false;
    if (cashFilter === 'receipts' && entry.source !== 'receipt') return false;
    if (cashSearch) {
      const q = cashSearch.toLowerCase();
      const matchComment = entry.comment.toLowerCase().includes(q);
      const matchType = entry.type.toLowerCase().includes(q);
      const matchRef = entry.receiptNumber?.toLowerCase().includes(q) || false;
      return matchComment || matchType || matchRef;
    }
    return true;
  });

  const activeStat = hoveredMonthIndex !== null 
    ? cashCalculations.monthlyStats[hoveredMonthIndex] 
    : cashCalculations.monthlyStats[cashCalculations.monthlyStats.length - 1];

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eaeaea', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2.4rem', margin: 0, fontWeight: 700, color: '#1a202c' }}>{appHeader}</h1>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px', gap: '0.3rem' }}>
          <button
            onClick={() => setActiveTab('pos')}
            style={{
              padding: '0.6rem 1.4rem',
              fontSize: '1rem',
              fontWeight: 600,
              background: activeTab === 'pos' ? '#ffffff' : 'transparent',
              color: activeTab === 'pos' ? '#0070f3' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: activeTab === 'pos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Registrierkassa POS
          </button>
          <button
            onClick={() => setActiveTab('kassabuch')}
            style={{
              padding: '0.6rem 1.4rem',
              fontSize: '1rem',
              fontWeight: 600,
              background: activeTab === 'kassabuch' ? '#ffffff' : 'transparent',
              color: activeTab === 'kassabuch' ? '#0070f3' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: activeTab === 'kassabuch' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Kassabuch
            <span style={{
              fontSize: '0.85rem',
              padding: '0.15rem 0.6rem',
              borderRadius: '20px',
              background: cashCalculations.currentCashBalance >= 0 ? '#dcfce7' : '#fee2e2',
              color: cashCalculations.currentCashBalance >= 0 ? '#166534' : '#991b1b',
              fontWeight: 700
            }}>
              € {cashCalculations.currentCashBalance.toFixed(2)}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'pos' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1rem' }}>
        <div style={{ flex: '1 1 350px' }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Vorlagen</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            {templates.map((tpl, i) => (
              <button key={i} onClick={() => addItem(tpl)} style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                + {tpl.name} (€{tpl.price.toFixed(2)} / {tpl.taxRate})
              </button>
            ))}
          </div>

          <h3 style={{ marginTop: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Manuelle Position</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
            <input placeholder="Name" value={customName} onChange={e => setCustomName(e.target.value)} style={{ flex: 2, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="number" step="0.01" placeholder="Preis" value={customPrice} onChange={e => setCustomPrice(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
            <select value={customTax} onChange={e => setCustomTax(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
              <option value="20%">20%</option>
              <option value="13%">13%</option>
              <option value="10%">10%</option>
              <option value="0%">0%</option>
            </select>
            <button onClick={addCustomItem} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#e0e0e0', border: '1px solid #ccc', borderRadius: '4px' }}>Hinzufügen</button>
          </div>

          <h3 style={{ marginTop: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Anzahlung / Kaution</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
            <input placeholder="Bezeichnung (z.B. Anzahlung)" value={depositName} onChange={e => setDepositName(e.target.value)} style={{ flex: 2, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="number" step="0.01" placeholder="Betrag (z.B. 0.00)" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>

          <h3 style={{ marginTop: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Kunde & Einstellungen</h3>
          <div style={{ marginTop: '1rem' }}>
            <textarea placeholder="Kundenname und Adresse" value={customerInfo} onChange={e => setCustomerInfo(e.target.value)} style={{ width: '100%', height: '80px', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="email" placeholder="Kunden E-Mail" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }} />
            <textarea placeholder="Eigene Nachricht (unter Tabelle)" value={customMessage} onChange={e => setCustomMessage(e.target.value)} style={{ width: '100%', height: '60px', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', background: '#eee', borderRadius: '8px', padding: '0.25rem', marginBottom: '1rem' }}>
            {paymentMethodsData.map(method => (
              <label 
                key={method.name} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  padding: '0.5rem', 
                  cursor: 'pointer',
                  background: paymentMethod === method.name ? 'white' : 'transparent',
                  boxShadow: paymentMethod === method.name ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value={method.name} 
                  checked={paymentMethod === method.name} 
                  onChange={() => setPaymentMethod(method.name)} 
                  style={{ display: 'none' }} 
                />
                {method.name} {method.feePercentage ? `(+${method.feePercentage}%)` : ''}
              </label>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 350px', background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginTop: 0 }}>Aktueller Warenkorb</h3>
          {items.length === 0 ? <p style={{ color: '#777', fontStyle: 'italic', marginTop: '1rem' }}>Leer</p> : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
              {items.map(item => (
                <li key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #ddd' }}>
                  <input type="number" value={item.quantity} onChange={e => updateItemQty(item.id, parseFloat(e.target.value))} style={{ width: '50px', padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <input type="text" value={item.name} onChange={e => updateItemName(item.id, e.target.value)} style={{ flex: 1, padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <input type="number" step="0.01" value={item.price} onChange={e => updateItemPrice(item.id, parseFloat(e.target.value))} style={{ width: '80px', padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <select value={item.taxRate} onChange={e => updateItemTax(item.id, e.target.value)} style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                    <option value="20%">20%</option>
                    <option value="13%">13%</option>
                    <option value="10%">10%</option>
                    <option value="0%">0%</option>
                  </select>
                  <span style={{ width: '80px', textAlign: 'right', fontWeight: 'bold' }}>€ {(item.quantity * item.price).toFixed(2)}</span>
                  <button onClick={() => removeItem(item.id)} style={{ color: '#d9534f', cursor: 'pointer', border: 'none', background: 'none', marginLeft: '0.5rem', fontWeight: 'bold' }} title="Entfernen">X</button>
                </li>
              ))}
            </ul>
          )}
          
          <div style={{ textAlign: 'right', marginTop: '1rem', borderTop: '2px solid #ccc', paddingTop: '1rem' }}>
            {isDepositSet && (
              <h4 style={{ margin: '0.2rem 0', color: '#555' }}>
                Gesamtsumme: € {subtotalAmount.toFixed(2)}
              </h4>
            )}
            {isDepositSet && (
              <h4 style={{ margin: '0.2rem 0', color: '#27ae60' }}>
                abzgl. {depositName || 'Anzahlung'}: -€ {depositVal.toFixed(2)}
              </h4>
            )}
            {isDepositSet && currentFeeAmount > 0 && (
              <h4 style={{ margin: '0.2rem 0', color: '#555' }}>
                Restbetrag (vor Gebühr): € {remainingBase.toFixed(2)}
              </h4>
            )}
            {!isDepositSet && currentFeeAmount > 0 && (
              <h4 style={{ margin: '0.2rem 0', color: '#555' }}>
                Zwischensumme: € {subtotalAmount.toFixed(2)}
              </h4>
            )}
            {currentFeeAmount > 0 && (
              <h4 style={{ margin: '0.2rem 0', color: '#555' }}>
                Gebühr {paymentMethod}: € {currentFeeAmount.toFixed(2)}
              </h4>
            )}
            <h2 style={{ margin: '0.5rem 0', fontSize: '1.8rem', color: '#2c3e50' }}>
              {isDepositSet ? `Restbetrag: € ${totalAmount.toFixed(2)}` : `Gesamt: € ${totalAmount.toFixed(2)}`}
            </h2>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', background: '#eee', borderRadius: '8px', padding: '0.25rem', marginBottom: '1rem' }}>
              <label 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  padding: '0.5rem', 
                  cursor: 'pointer',
                  background: type === 'final' ? 'white' : 'transparent',
                  boxShadow: type === 'final' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="radio" 
                  name="invoiceType" 
                  value="final" 
                  checked={type === 'final'} 
                  onChange={e => setType(e.target.value)} 
                  style={{ display: 'none' }} 
                />
                Rechnung (Final)
              </label>
              <label 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  padding: '0.5rem', 
                  cursor: 'pointer',
                  background: type === 'proforma' ? 'white' : 'transparent',
                  boxShadow: type === 'proforma' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="radio" 
                  name="invoiceType" 
                  value="proforma" 
                  checked={type === 'proforma'} 
                  onChange={e => setType(e.target.value)} 
                  style={{ display: 'none' }} 
                />
                Proforma
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
               <button onClick={handlePreview} style={{ flex: 1, padding: '1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Vorschau</button>
               <button onClick={handleCreate} style={{ flex: 2, padding: '1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Erstellen</button>
            </div>
            
            <button onClick={handleNullbeleg} style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Nullbeleg erstellen</button>
          </div>
          {status && <p style={{ marginTop: '1rem', color: status.startsWith('Error') ? '#d9534f' : '#5cb85c', fontWeight: 'bold', padding: '0.5rem', background: status.startsWith('Error') ? '#f2dede' : '#dff0d8', borderRadius: '4px' }}>{status}</p>}
        </div>
      </div>

      <div style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eaeaea', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Belege</h2>
            <a href="/api/export" target="_blank" rel="noreferrer" style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>CSV Export</a>
        </div>
        <input type="text" placeholder="Belege durchsuchen..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f4f4f4', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => { setSortField('receiptNumber'); setSortDesc(!sortDesc) }}>Nummer {sortField === 'receiptNumber' ? (sortDesc ? '↓' : '↑') : ''}</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => { setSortField('date'); setSortDesc(!sortDesc) }}>Datum {sortField === 'date' ? (sortDesc ? '↓' : '↑') : ''}</th>
              <th style={{ padding: '1rem' }}>Typ</th>
              <th style={{ padding: '1rem' }}>Kunde</th>
              <th style={{ padding: '1rem' }}>Gesamt</th>
              <th style={{ padding: '1rem' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: r.isStorno || r.stornoed ? '#fff0f0' : (r.convertedToFinal ? '#e6f7ff' : 'transparent'), transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = r.isStorno || r.stornoed ? '#fee2e2' : (r.convertedToFinal ? '#d0edff' : '#f9f9f9')} 
                  onMouseOut={e => e.currentTarget.style.background = r.isStorno || r.stornoed ? '#fff0f0' : (r.convertedToFinal ? '#e6f7ff' : 'transparent')}>
                <td style={{ padding: '1rem' }}>{r.receiptNumber} {r.isStorno && `(Storno: ${r.stornoRef})`} {r.stornoed && `(Storniert)`} {r.convertedToFinal && `(Abgeschlossen)`}</td>
                <td style={{ padding: '1rem' }}>{new Date(r.date).toLocaleString('de-AT')}</td>
                <td style={{ padding: '1rem' }}>{r.type}</td>
                <td style={{ padding: '1rem' }}>{r.customerNameAndAddress?.split('\n')[0] || '-'}</td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>€ {r.totalAmount.toFixed(2)}</td>
                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a href={`/api/pdf?file=${r.receiptNumber}.pdf`} target="_blank" rel="noreferrer" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', padding: '0.25rem 0.5rem', border: '1px solid #0070f3', borderRadius: '4px' }}>PDF</a>
                  {r.type === 'proforma' && <button onClick={() => handleLoadProforma(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>Laden</button>}
                  {(r.stornoed || r.isStorno) && <button onClick={() => handleLoadCancelled(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>Laden</button>}
                  {r.type === 'proforma' && <button onClick={() => handleDeleteProforma(r.id)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #d9534f', color: '#d9534f', borderRadius: '4px' }}>Löschen</button>}
                  {r.type === 'final' && !r.isStorno && !r.stornoed && <button onClick={() => handleStorno(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #d9534f', color: '#d9534f', borderRadius: '4px' }}>Storno</button>}
                  <button onClick={() => openEmailModal(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>E-Mail senden</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}

  {/* --- TAB 2: KASSABUCH --- */}
  {activeTab === 'kassabuch' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktueller Kassenstand (Bar)</span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, marginTop: '0.4rem', color: cashCalculations.currentCashBalance >= 0 ? '#16a34a' : '#dc2626' }}>
            € {cashCalculations.currentCashBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>
            Vorhandener Bargeldbestand
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bar-Umsatz (Belege)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.4rem', color: '#0284c7' }}>
            € {cashCalculations.totalCashFromReceipts.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>
            Aus {cashCalculations.barReceiptsCount} Bar-Belegen
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summe Einzahlungen</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.4rem', color: '#16a34a' }}>
            +€ {cashCalculations.totalEinzahlungen.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>
            Manuelle Bareinlagen
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summe Auszahlungen</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.4rem', color: '#ea580c' }}>
            -€ {cashCalculations.totalAuszahlungen.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>
            Manuelle Barausgaben
          </div>
        </div>
      </div>

      {/* Dynamic 12-Month Diagram */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              Kassenstand-Entwicklung (Letzte 12 Monate)
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              Verlauf des Bargeldbestands und monatliche Bar-Flüsse
            </p>
          </div>

          {activeStat && (
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 1rem', display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Monat: </span>
                <strong style={{ color: '#0f172a' }}>{activeStat.fullLabel}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Kassenstand: </span>
                <strong style={{ color: activeStat.balance >= 0 ? '#16a34a' : '#dc2626' }}>€ {activeStat.balance.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Zufluss: </span>
                <strong style={{ color: '#16a34a' }}>+€ {activeStat.inflow.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Abfluss: </span>
                <strong style={{ color: '#ea580c' }}>-€ {activeStat.outflow.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Saldo: </span>
                <strong style={{ color: activeStat.net >= 0 ? '#16a34a' : '#dc2626' }}>€ {activeStat.net.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        {chartConfig && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${chartConfig.svgWidth} ${chartConfig.svgHeight}`}
              style={{ width: '100%', minWidth: '700px', height: 'auto', display: 'block' }}
            >
              <defs>
                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0070f3" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y Labels */}
              {chartConfig.yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={chartConfig.padLeft}
                    y1={tick.y}
                    x2={chartConfig.svgWidth - 30}
                    y2={tick.y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={chartConfig.padLeft - 10}
                    y={tick.y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#94a3b8"
                    fontFamily="sans-serif"
                  >
                    € {Math.round(tick.val)}
                  </text>
                </g>
              ))}

              {/* Zero Line if visible */}
              {chartConfig.zeroY >= chartConfig.padTop && chartConfig.zeroY <= chartConfig.padTop + chartConfig.plotHeight && (
                <line
                  x1={chartConfig.padLeft}
                  y1={chartConfig.zeroY}
                  x2={chartConfig.svgWidth - 30}
                  y2={chartConfig.zeroY}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
              )}

              {/* Area fill under the line */}
              {chartConfig.areaPath && (
                <path d={chartConfig.areaPath} fill="url(#cashGradient)" />
              )}

              {/* Balance Line */}
              {chartConfig.linePath && (
                <path
                  d={chartConfig.linePath}
                  fill="none"
                  stroke="#0070f3"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive columns & points */}
              {chartConfig.points.map((pt, i) => {
                const isHovered = hoveredMonthIndex === i;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredMonthIndex(i)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover vertical bar */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={chartConfig.padTop}
                        x2={pt.x}
                        y2={chartConfig.padTop + chartConfig.plotHeight}
                        stroke="#0070f3"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Interactive invisible hit box for hovering */}
                    <rect
                      x={pt.x - 25}
                      y={chartConfig.padTop}
                      width={50}
                      height={chartConfig.plotHeight + 35}
                      fill="transparent"
                    />

                    {/* Point on the line */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 4}
                      fill={isHovered ? '#0070f3' : '#ffffff'}
                      stroke="#0070f3"
                      strokeWidth={isHovered ? 3 : 2}
                      style={{ transition: 'all 0.15s ease' }}
                    />

                    {/* Month X label */}
                    <text
                      x={pt.x}
                      y={chartConfig.svgHeight - 15}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      fill={isHovered ? '#0070f3' : '#64748b'}
                      fontFamily="sans-serif"
                    >
                      {pt.stat.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Form: Einzahlung & Auszahlung erfassen */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          Neue Kassenbewegung erfassen
        </h3>

        <form onSubmit={handleCreateCashEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            
            {/* Type Selection */}
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                Buchungstyp
              </label>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setEntryType('Einzahlung')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: entryType === 'Einzahlung' ? '#16a34a' : 'transparent',
                    color: entryType === 'Einzahlung' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  + Einzahlung
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('Auszahlung')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: entryType === 'Auszahlung' ? '#ea580c' : 'transparent',
                    color: entryType === 'Auszahlung' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  - Auszahlung
                </button>
              </div>
            </div>

            {/* Amount */}
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                Betrag (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={entryAmount}
                onChange={e => setEntryAmount(e.target.value)}
                required
                style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Date */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                Datum
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                required
                style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Comment */}
            <div style={{ flex: '2 1 280px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                Bemerkung / Verwendungszweck
              </label>
              <input
                type="text"
                placeholder="z.B. Wechselgeld-Einlage, Büromaterial, Bankeinzahlung..."
                value={entryComment}
                onChange={e => setEntryComment(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {cashStatus && (
              <span style={{ fontSize: '0.9rem', color: cashStatus.startsWith('Fehler') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {cashStatus}
              </span>
            )}
            <button
              type="submit"
              style={{
                padding: '0.65rem 1.75rem',
                background: entryType === 'Einzahlung' ? '#16a34a' : '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              Buchung speichern
            </button>
          </div>
        </form>
      </div>

      {/* Kassabuch Journal Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              Kassenjournal (Alle Bewegungen)
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Chronologische Übersicht aller Bar-Belege, Einzahlungen und Auszahlungen
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Suchen..."
              value={cashSearch}
              onChange={e => setCashSearch(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
            />
            <button
              onClick={() => setCashFilter('all')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: cashFilter === 'all' ? '#0070f3' : '#fff',
                color: cashFilter === 'all' ? '#fff' : '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Alle ({cashCalculations.journalEntries.length})
            </button>
            <button
              onClick={() => setCashFilter('manual')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: cashFilter === 'manual' ? '#0070f3' : '#fff',
                color: cashFilter === 'manual' ? '#fff' : '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Nur Ein-/Auszahlungen ({cashEntries.length})
            </button>
            <button
              onClick={() => setCashFilter('receipts')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: cashFilter === 'receipts' ? '#0070f3' : '#fff',
                color: cashFilter === 'receipts' ? '#fff' : '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Nur Bar-Belege ({cashCalculations.barReceiptsCount})
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Datum</th>
              <th style={{ padding: '0.75rem 1rem' }}>Typ</th>
              <th style={{ padding: '0.75rem 1rem' }}>Bemerkung / Beleg</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Betrag</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Kassenstand</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredJournalEntries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : (
              filteredJournalEntries.map(entry => (
                <tr
                  key={entry.id}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#334155' }}>
                    {entry.date}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: entry.type === 'Einzahlung' ? '#dcfce7' : (entry.type === 'Auszahlung' ? '#ffedd5' : '#e0f2fe'),
                      color: entry.type === 'Einzahlung' ? '#166534' : (entry.type === 'Auszahlung' ? '#9a3412' : '#0369a1')
                    }}>
                      {entry.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#1e293b' }}>
                    {entry.comment}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: entry.amount >= 0 ? '#16a34a' : '#ea580c' }}>
                    {entry.amount >= 0 ? '+' : ''}€ {entry.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.95rem', color: entry.balanceAfter >= 0 ? '#0f172a' : '#dc2626' }}>
                    € {entry.balanceAfter.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    {entry.source === 'manual' && entry.rawEntry && (
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => setEditingEntry(entry.rawEntry!)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#334155'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDeleteCashEntry(entry.rawEntry!.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#b91c1c'
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                    {entry.source === 'receipt' && entry.receiptNumber && (
                      <a
                        href={`/api/pdf?file=${entry.receiptNumber}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#0070f3',
                          textDecoration: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #0070f3',
                          borderRadius: '4px'
                        }}
                      >
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )}

  {/* --- MODAL: EDIT CASH ENTRY --- */}
  {editingEntry && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#1e293b' }}>
          Kassenbewegung bearbeiten
        </h3>

        <form onSubmit={handleUpdateCashEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Buchungstyp
            </label>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setEditingEntry({ ...editingEntry, type: 'Einzahlung' })}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: editingEntry.type === 'Einzahlung' ? '#16a34a' : 'transparent',
                  color: editingEntry.type === 'Einzahlung' ? '#ffffff' : '#475569'
                }}
              >
                + Einzahlung
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry({ ...editingEntry, type: 'Auszahlung' })}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: editingEntry.type === 'Auszahlung' ? '#ea580c' : 'transparent',
                  color: editingEntry.type === 'Auszahlung' ? '#ffffff' : '#475569'
                }}
              >
                - Auszahlung
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Betrag (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={editingEntry.amount}
              onChange={e => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })}
              required
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Datum
            </label>
            <input
              type="date"
              value={editingEntry.date}
              onChange={e => setEditingEntry({ ...editingEntry, date: e.target.value })}
              required
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Bemerkung / Kommentar
            </label>
            <input
              type="text"
              value={editingEntry.comment}
              onChange={e => setEditingEntry({ ...editingEntry, comment: e.target.value })}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setEditingEntry(null)}
              style={{ padding: '0.55rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{ padding: '0.55rem 1.25rem', background: '#0070f3', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {emailModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #eaeaea', paddingBottom: '0.5rem' }}>E-Mail senden: {emailModal.receiptNumber}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input type="email" placeholder="An" value={emailModal.to} onChange={e => setEmailModal({ ...emailModal, to: e.target.value })} style={{ padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
              <input type="text" placeholder="Betreff" value={emailModal.subject} onChange={e => setEmailModal({ ...emailModal, subject: e.target.value })} style={{ padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
              <textarea placeholder="Nachricht" value={emailModal.text} onChange={e => setEmailModal({ ...emailModal, text: e.target.value })} style={{ padding: '0.75rem', height: '150px', border: '1px solid #ccc', borderRadius: '4px' }} />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={() => setEmailModal({ ...emailModal, open: false })} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#e0e0e0', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Abbrechen</button>
                <button onClick={sendEmail} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Senden</button>
              </div>
              {emailModal.status && <p style={{ color: emailModal.status.startsWith('Error') ? '#d9534f' : '#5cb85c', fontWeight: 'bold' }}>{emailModal.status}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
