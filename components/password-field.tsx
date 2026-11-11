'use client';

import {useId, useState, type InputHTMLAttributes} from 'react';
import {Eye, EyeOff} from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {label: string};

export function PasswordField({label, className = '', ...props}: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="text-sm">
    <label htmlFor={id}>{label}</label>
    <div className="relative mt-1">
      <input {...props} id={id} type={visible ? 'text' : 'password'} className={'min-h-11 w-full rounded-md border border-cu-border bg-cu-panel py-2 pl-3 pr-12 text-cu-text focus:outline-2 focus:outline-cu-purple ' + className}/>
      <button type="button" aria-label={(visible ? 'Ocultar contraseña: ' : 'Mostrar contraseña: ') + label} aria-pressed={visible} aria-controls={id}
        className="absolute inset-y-0 right-0 flex min-h-11 w-11 items-center justify-center rounded-md text-cu-text-secondary hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple"
        onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
      </button>
    </div>
  </div>;
}
