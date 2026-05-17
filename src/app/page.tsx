'use client';
import { useState, useEffect } from 'react';

type Item = { name: string; price: number; taxRate: string; id: number; quantity: number };
type Template = { name: string; price: number; taxRate: string };
type Receipt = { id: string; receiptNumber: string; date: string; type: string; totalAmount: number; customerNameAndAddress?: string; customerEmail?: string; isStorno?: boolean; stornoed?: boolean; stornoRef?: string; convertedToFinal?: boolean; items: any[] };

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState('final');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customTax, setCustomTax] = useState('20%');
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
  }, []);

  const loadReceipts = async () => {
    const res = await fetch('/api/invoice');
    const data = await res.json();
    if (data.success) {
      setReceipts(data.receipts);
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
    const selectedMethod = paymentMethodsData.find(m => m.name === paymentMethod);
    const feeAmount = (selectedMethod?.feePercentage && selectedMethod.feePercentage > 0) 
      ? subtotal * (selectedMethod.feePercentage / 100) 
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
      body: JSON.stringify({ items: finalItems, type, customerNameAndAddress: customerInfo, customerEmail, customMessage, paymentMethod, fromProformaId })
    });
    
    const data = await res.json();
    if (data.success) {
      setStatus(`Success! Created ${data.receipt.receiptNumber}`);
      setItems([]);
      setCustomerInfo('');
      setCustomerEmail('');
      setFromProformaId(undefined);
      loadReceipts();
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
    const selectedMethod = paymentMethodsData.find(m => m.name === paymentMethod);
    const feeAmount = (selectedMethod?.feePercentage && selectedMethod.feePercentage > 0) 
      ? subtotal * (selectedMethod.feePercentage / 100) 
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
      body: JSON.stringify({ items: finalItems, type, customerNameAndAddress: customerInfo, customerEmail, customMessage, paymentMethod, isPreview: true })
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
    setType('final');
    setFromProformaId(r.id);
    setStatus(`Loaded Proforma ${r.receiptNumber}. You can now save it as a final invoice.`);
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
      body: JSON.stringify({ items: inverseItems, type: 'final', customerNameAndAddress: r.customerNameAndAddress, customMessage, paymentMethod, isStorno: true, stornoRef: r.receiptNumber })
    });
    if (res.ok) {
      setStatus(`Storno created.`);
      loadReceipts();
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
    const salutation = r.customerNameAndAddress ? r.customerNameAndAddress.split('\n')[0] : 'Kunde';
    const defaultSubject = emailTexts.subject ? `${emailTexts.subject} ${r.receiptNumber} (${new Date(r.date).toLocaleDateString('de-AT')})` : `Rechnung ${r.receiptNumber}`;
    const defaultBody = `Hallo ${salutation},\n\n${emailTexts.body || 'anbei finden Sie Ihre Rechnung.'}`;
    setEmailModal({
      open: true,
      receiptNumber: r.receiptNumber,
      to: r.customerEmail || '',
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
  const selectedMethodForTotal = paymentMethodsData.find(m => m.name === paymentMethod);
  const currentFeeAmount = (selectedMethodForTotal?.feePercentage && selectedMethodForTotal.feePercentage > 0)
    ? subtotalAmount * (selectedMethodForTotal.feePercentage / 100)
    : 0;
  const totalAmount = subtotalAmount + currentFeeAmount;

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

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 600, borderBottom: '2px solid #eaeaea', paddingBottom: '0.5rem' }}>{appHeader}</h1>
      
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
            {currentFeeAmount > 0 && <h4 style={{ margin: '0.2rem 0', color: '#555' }}>Zwischensumme: € {subtotalAmount.toFixed(2)}</h4>}
            {currentFeeAmount > 0 && <h4 style={{ margin: '0.2rem 0', color: '#555' }}>Gebühr {paymentMethod}: € {currentFeeAmount.toFixed(2)}</h4>}
            <h2 style={{ margin: '0.5rem 0', fontSize: '1.8rem', color: '#2c3e50' }}>Gesamt: € {totalAmount.toFixed(2)}</h2>
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
                  {r.type === 'proforma' && <button onClick={() => handleDeleteProforma(r.id)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #d9534f', color: '#d9534f', borderRadius: '4px' }}>Löschen</button>}
                  {r.type === 'final' && !r.isStorno && !r.stornoed && <button onClick={() => handleStorno(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #d9534f', color: '#d9534f', borderRadius: '4px' }}>Storno</button>}
                  {!r.isStorno && <button onClick={() => openEmailModal(r)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>E-Mail senden</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
