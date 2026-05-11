'use client';
import { useState, useEffect } from 'react';

type Item = { name: string; price: number; taxRate: string; id: number; quantity: number };
type Template = { name: string; price: number; taxRate: string };
type Receipt = { id: string; receiptNumber: string; date: string; type: string; totalAmount: number; customerNameAndAddress?: string; isStorno?: boolean; stornoed?: boolean; stornoRef?: string; items: any[] };

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState('final');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customTax, setCustomTax] = useState('20%');
  const [customerInfo, setCustomerInfo] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bar');
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date'|'receiptNumber'>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [fromProformaId, setFromProformaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => {
      if (data.itemTemplates) setTemplates(data.itemTemplates);
      if (data.invoiceTexts?.customMessageDefault) setCustomMessage(data.invoiceTexts.customMessageDefault);
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

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleCreate = async () => {
    if (items.length === 0) {
      setStatus('Cart is empty.');
      return;
    }
    setStatus('Creating...');
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, type, customerNameAndAddress: customerInfo, customMessage, paymentMethod, fromProformaId })
    });
    
    const data = await res.json();
    if (data.success) {
      setStatus(`Success! Created ${data.receipt.receiptNumber}`);
      setItems([]);
      setCustomerInfo('');
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
    setStatus('Loading preview...');
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, type, customerNameAndAddress: customerInfo, customMessage, paymentMethod, isPreview: true })
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

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Registrierkassa POS</h1>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: '1 1 350px' }}>
          <h3>Add Templates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {templates.map((tpl, i) => (
              <button key={i} onClick={() => addItem(tpl)} style={{ padding: '0.5rem', textAlign: 'left', cursor: 'pointer' }}>
                + {tpl.name} (€{tpl.price.toFixed(2)} / {tpl.taxRate})
              </button>
            ))}
          </div>

          <h3 style={{ marginTop: '2rem' }}>Add Custom Item</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input placeholder="Name" value={customName} onChange={e => setCustomName(e.target.value)} style={{ flex: 2, padding: '0.5rem' }} />
            <input type="number" step="0.01" placeholder="Price" value={customPrice} onChange={e => setCustomPrice(e.target.value)} style={{ flex: 1, padding: '0.5rem' }} />
            <select value={customTax} onChange={e => setCustomTax(e.target.value)} style={{ padding: '0.5rem' }}>
              <option value="20%">20%</option>
              <option value="13%">13%</option>
              <option value="10%">10%</option>
              <option value="0%">0%</option>
            </select>
            <button onClick={addCustomItem} style={{ padding: '0.5rem', cursor: 'pointer' }}>Add</button>
          </div>

          <h3 style={{ marginTop: '2rem' }}>Customer & Settings</h3>
          <textarea placeholder="Customer Name and Address" value={customerInfo} onChange={e => setCustomerInfo(e.target.value)} style={{ width: '100%', height: '80px', padding: '0.5rem', marginBottom: '1rem' }} />
          <textarea placeholder="Custom message (below table)" value={customMessage} onChange={e => setCustomMessage(e.target.value)} style={{ width: '100%', height: '60px', padding: '0.5rem', marginBottom: '1rem' }} />
          <div>
            <strong>Zahlungsmittel: </strong>
            {['bar', 'SumUp', 'Überweisung', 'PayPal'].map(method => (
              <label key={method} style={{ marginRight: '1rem', cursor: 'pointer' }}>
                <input type="radio" name="paymentMethod" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} style={{ marginRight: '0.2rem' }} />
                {method}
              </label>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 350px', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
          <h3>Current Cart</h3>
          {items.length === 0 ? <p>Empty</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map(item => (
                <li key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #ddd' }}>
                  <input type="number" value={item.quantity} onChange={e => updateItemQty(item.id, parseFloat(e.target.value))} style={{ width: '50px' }} />
                  <input type="text" value={item.name} onChange={e => updateItemName(item.id, e.target.value)} style={{ flex: 1 }} />
                  <input type="number" step="0.01" value={item.price} onChange={e => updateItemPrice(item.id, parseFloat(e.target.value))} style={{ width: '80px' }} />
                  <span>({item.taxRate})</span>
                  <button onClick={() => removeItem(item.id)} style={{ color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}>X</button>
                </li>
              ))}
            </ul>
          )}
          
          <h3 style={{ textAlign: 'right' }}>Total: € {totalAmount.toFixed(2)}</h3>

          <div style={{ marginTop: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Invoice Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}>
              <option value="final">Final Invoice</option>
              <option value="proforma">Proforma</option>
            </select>

            <div style={{ display: 'flex', gap: '1rem' }}>
               <button onClick={handlePreview} style={{ flex: 1, padding: '1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Preview</button>
               <button onClick={handleCreate} style={{ flex: 2, padding: '1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
            </div>
            
            <button onClick={handleNullbeleg} style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create Nullbeleg</button>
          </div>
          {status && <p style={{ marginTop: '1rem', color: status.startsWith('Error') ? 'red' : 'green' }}>{status}</p>}
        </div>
      </div>

      <div style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Invoices</h2>
            <a href="/api/export" target="_blank" rel="noreferrer" style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>Export CSV</a>
        </div>
        <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#eee' }}>
              <th style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={() => { setSortField('receiptNumber'); setSortDesc(!sortDesc) }}>Number</th>
              <th style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={() => { setSortField('date'); setSortDesc(!sortDesc) }}>Date</th>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem' }}>Customer</th>
              <th style={{ padding: '0.5rem' }}>Total</th>
              <th style={{ padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #ddd', background: r.isStorno || r.stornoed ? '#fee2e2' : 'transparent' }}>
                <td style={{ padding: '0.5rem' }}>{r.receiptNumber} {r.isStorno && `(Storno: ${r.stornoRef})`} {r.stornoed && `(Storniert)`}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(r.date).toLocaleString('de-AT')}</td>
                <td style={{ padding: '0.5rem' }}>{r.type}</td>
                <td style={{ padding: '0.5rem' }}>{r.customerNameAndAddress?.split('\n')[0] || '-'}</td>
                <td style={{ padding: '0.5rem' }}>€ {r.totalAmount.toFixed(2)}</td>
                <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <a href={`/api/pdf?file=${r.receiptNumber}.pdf`} target="_blank" rel="noreferrer" style={{ color: 'blue' }}>PDF</a>
                  {r.type === 'proforma' && <button onClick={() => handleLoadProforma(r)}>Load</button>}
                  {r.type === 'proforma' && <button onClick={() => handleDeleteProforma(r.id)}>Del</button>}
                  {r.type === 'final' && !r.isStorno && !r.stornoed && <button onClick={() => handleStorno(r)}>Storno</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
