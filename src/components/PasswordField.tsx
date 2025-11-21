/**
 * PasswordField component that renders a password input with a visibility toggle.
 *
 * This component provides a labeled password field with an eye-icon button
 * allowing the user to show or hide the password text. It supports customization
 * through props such as name, placeholder, class names, and autocomplete options.
 *
 * @component
 * @param {Object} props - Props for the PasswordField component.
 * @param {string} [props.id="password"] - The HTML `id` for the input element.
 * @param {string} [props.name="password"] - The input `name` attribute.
 * @param {string} [props.label="Contraseña"] - Label text displayed above the field.
 * @param {string} [props.placeholder="••••••••"] - Placeholder displayed inside the input.
 * @param {string} [props.value] - Current value of the password input.
 * @param {(e: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange] - Change handler for the input.
 * @param {boolean} [props.required] - Whether the input is required.
 * @param {string} [props.className="login-input"] - Custom CSS class for the input element.
 * @param {string} [props.autoComplete="current-password"] - Autocomplete attribute for browser autofill.
 *
 * @returns {JSX.Element} A password input field with a show/hide toggle button.
 *
 * @example
 * <PasswordField
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 *   required
 * />
 */
import { useState } from "react";

type Props = {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  autoComplete?: string;
};

export default function PasswordField({
  id = "password",
  name = "password",
  label = "Contraseña",
  placeholder = "••••••••",
  value,
  onChange,
  required,
  className = "login-input",
  autoComplete = "current-password",
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-field">
      {label && <label htmlFor={id} className="password-label">{label}</label>}
      <div className="password-wrap">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          className={className}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="eye-btn"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          onClick={() => setShow(s => !s)}
        >
          {show ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M2 12s3.8-7 10-7c2.4 0 4.4.7 6 1.7" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M22 12s-3.8 7-10 7c-2.4 0-4.4-.7-6-1.7" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
