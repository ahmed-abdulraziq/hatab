import { useId } from 'react';

/**
 * A labelled form field. `children` is a function that gets the props the input needs
 * (id and the accessibility attributes that link it to the hint or error).
 */
export default function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;
  return (
    <div className={`field${error ? ' field--error' : ''} ${className}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {message}
        </p>
      )}
    </div>
  );
}
