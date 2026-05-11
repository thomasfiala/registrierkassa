'use client';
import { useState, useEffect } from 'react';

type Item = { name: string; price: number; taxRate: string; id: number };
type Template = { name: string; price: number; taxRate: string };

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState('final');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customTax, setCustomTax] = useState('20%');

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => {
      if (data.itemTemplates) setTemplates(data.itemTemplates);
    });
  }, []);

  const addItem = (item: Omit<Item, 'id'>) => {
    setItems([...items, { ...item, id: Date.now() + Math.random() }]);
  };

  const addCustomItem = () => {
    if (!customName || !customPrice) return;
    addItem({ name: customName, price: parseFloat(customPrice), taxRate: customTax });
    setCustomName('');
    setCustomPrice('');
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
      body: JSON.stringify({ items, type })
    });
    
    const data = await res.json();
    if (data.success) {
      setStatus(`Success! Created ${data.receipt.receiptNumber}`);
      setItems([]);
    } else {
      setStatus(`Error: ${data.error}`);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Registrierkassa POS</h1>
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        {/* Left Side: Adding Items */}
        <div style={{ flex: 1 }}>
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
        </div>

        {/* Right Side: Cart */}
        <div style={{ flex: 1, background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
          <h3>Current Cart</h3>
          {items.length === 0 ? <p>Empty</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map(item => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #ddd' }}>
                  <span>{item.name} ({item.taxRate})</span>
                  <span>
                    € {item.price.toFixed(2)}
                    <button onClick={() => removeItem(item.id)} style={{ marginLeft: '1rem', color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}>X</button>
                  </span>
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

            <button onClick={handleCreate} style={{ width: '100%', padding: '1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1.1rem', cursor: 'pointer' }}>
              Create Invoice & PDF
            </button>
          </div>
          {status && <p style={{ marginTop: '1rem', color: status.startsWith('Error') ? 'red' : 'green' }}>{status}</p>}
        </div>
      </div>
    </main>
  );
}
