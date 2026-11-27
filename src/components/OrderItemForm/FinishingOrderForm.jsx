import { useEffect, useState } from 'react';
import Input from '../Input/Input';
import Select from '../Select/Select';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import { getCachedFinishings } from '../../services/apiCache';
import { formatRupiah } from '../../services/helpers';

export default function FinishingOrderForm({ initialData, onChange, onSubmit, isSubmitting, submitText, submitIcon, submitVariant, showCancel, onCancel, children }) {
    const [finishings, setFinishings] = useState([]);
    const [error, setError] = useState('');
    const [discountOpen, setDiscountOpen] = useState(Boolean(Number(initialData.diskon)));
    useEffect(() => {
        let active = true;
        const apply = rows => { if (active && Array.isArray(rows)) setFinishings(rows); };
        getCachedFinishings(apply).then(rows => {
            if (rows) apply(rows);
            else if (active) setError('Data finishing belum tersedia. Perbarui cache lalu coba lagi.');
        }).catch(() => { if (active) setError('Gagal mengambil finishing.'); });
        return () => { active = false; };
    }, []);
    const selected = finishings.find(row => String(row.finishing_id) === String(initialData.finishing_id));
    const unit = String(selected?.unit_type || '').toUpperCase();
    const length = Boolean(initialData.order_item_id) && initialData.finishing_measure === 'length'
        && String(initialData.finishing_id) === String(initialData.original_finishing_id || initialData.finishing_id);
    const area = !length && ['M', 'M2', 'CM', 'CM2'].includes(unit);
    const centimeters = ['CM', 'CM2'].includes(unit);
    const update = patch => {
        const value = { ...initialData, ...patch, item_type: 'finishing', product_id: '', category_id: '' };
        const finishing = finishings.find(row => String(row.finishing_id) === String(value.finishing_id));
        onChange({ ...value, finishings: value.finishing_id ? [String(value.finishing_id)] : [], selectedProductName: finishing?.name || '' });
    };
    return <form onSubmit={event => { event.preventDefault(); if (selected) onSubmit(initialData); }}>
        {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Select label="Finishing" name="finishing_id" labelPosition="left" labelWidth={110} required
            value={String(initialData.finishing_id || '')} placeholder="Pilih finishing"
            options={finishings.map(row => ({ value: String(row.finishing_id), label: `${row.name} (${row.unit_type})` }))}
            onChange={event => update({ finishing_id: event.target.value, panjang: '', lebar: '', size: '' })} disabled={isSubmitting} />
        {area ? <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: 14 }}>Ukuran (P x L)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <Input name="panjang" placeholder={`Panjang (${centimeters ? 'cm' : 'm'})`} type="number" min="0.0001" step="any" required
                        value={initialData.panjang || ''} onChange={event => update({ panjang: event.target.value })} disabled={isSubmitting} />
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--text)', marginBottom: 12 }}>X</span>
                <div style={{ flex: 1 }}>
                    <Input name="lebar" placeholder={`Lebar (${centimeters ? 'cm' : 'm'})`} type="number" min="0.0001" step="any" required
                        value={initialData.lebar || ''} onChange={event => update({ lebar: event.target.value })} disabled={isSubmitting} />
                </div>
            </div>
        </div> : length && <Input label={`Panjang (${centimeters ? 'cm' : 'm'})`} name="panjang"
            type="number" min="0.0001" step="any" required value={initialData.panjang || ''} onChange={event => update({ panjang: event.target.value })} disabled={isSubmitting} />}
        <Input label="Quantity" name="qty" type="number" min="1" max="1000000" step="1" required
            value={initialData.qty || ''} onChange={event => update({ qty: event.target.value })} disabled={isSubmitting} />
        <div style={{ marginBottom: 12 }}>
            <button type="button" aria-expanded={discountOpen} onClick={() => setDiscountOpen(open => !open)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 38, padding: '8px 12px',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--background)', color: 'var(--text)',
                    font: 'inherit', fontSize: 13, fontWeight: 600, lineHeight: 1.4, textAlign: 'left', cursor: 'pointer', transition: 'background var(--transition)' }}>
                <span style={{ flexShrink: 0, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
                    borderLeft: '6px solid currentColor', transform: discountOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform var(--transition)' }} aria-hidden="true" />
                <span>Diskon</span>
                {Number(initialData.diskon) > 0 && <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontWeight: 400 }}>{formatRupiah(initialData.diskon)}</span>}
            </button>
            {discountOpen && <Input label="Diskon" name="diskon" labelPosition="left" labelWidth={110} type="number" min="0" step="0.01" style={{ marginTop: 12 }}
                value={initialData.diskon || ''} onChange={event => update({ diskon: event.target.value })} disabled={isSubmitting} />}
        </div>
        {selected && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>Harga dasar finishing</span>
                <strong style={{ color: 'var(--text)' }}>{formatRupiah(selected.price)}</strong>
            </div>
        </div>}
        {children}
        <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" size="full-lg" variant={submitVariant} disabled={isSubmitting || !selected} icon={<Icon name={isSubmitting ? 'hourglass_empty' : submitIcon} />}>{isSubmitting ? 'Loading...' : submitText}</Button>
            {showCancel && <Button type="button" size="full-lg" variant="secondary" onClick={onCancel}>Batal</Button>}
        </div>
    </form>;
}
