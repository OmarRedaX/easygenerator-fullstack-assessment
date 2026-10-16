import { useState, type ComponentPropsWithRef } from 'react';
import { Field } from './Field';

type PasswordFieldProps = Omit<ComponentPropsWithRef<typeof Field>, 'type' | 'trailing'>;

export function PasswordField({ disabled, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  // A read-only field (form is submitting) keeps focus but must not be revealed or hidden mid-request.
  const locked = disabled === true || rest.readOnly === true;

  return (
    <Field
      {...rest}
      disabled={disabled}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          disabled={locked}
          aria-pressed={visible}
          onClick={() => {
            setVisible((current) => !current);
          }}
          className="absolute top-0.5 right-1 h-11 rounded-lg px-3 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span aria-hidden="true">{visible ? 'Hide' : 'Show'}</span>
          <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
        </button>
      }
    />
  );
}
