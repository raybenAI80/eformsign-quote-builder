import React from 'react';
import { parseNum } from '../../utils/helpers';

interface FieldProps {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'date';
    helper?: string;
    span?: boolean;
    placeholder?: string;
    className?: string;
}

export const Field: React.FC<FieldProps> = ({
    label,
    value,
    onChange,
    type = 'text',
    helper,
    span,
    placeholder,
    className = '',
}) => (
    <label className={`block ${span ? 'lg:col-span-2' : ''} ${className}`}>
        <span className='mb-1 block text-xs font-medium text-[color:var(--forcs-text-muted)]'>{label}</span>
        <input
            type={type}
            className='input-field w-full'
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
        />
        {helper && <p className='mt-1 text-xs text-[color:var(--forcs-text-muted)]'>{helper}</p>}
    </label>
);
