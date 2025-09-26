// Reusable amount formatting component
import { formatAmount } from '@/lib/utils';

export default function Amount({ value, currency='EUR', className='', title }) {
  if (value == null || value === '') return <span className={className}>—</span>;
  let str = typeof value === 'string' ? value : value.toString?.() ?? String(value);
  return <span className={className} title={title}>{formatAmount(str, currency)}</span>;
}