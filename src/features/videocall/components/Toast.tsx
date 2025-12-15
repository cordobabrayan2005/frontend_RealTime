import React from 'react';

/**
 * Props for the Toast component.
 *
 * @interface ToastProps
 * @property {string} message - The message text to display inside the toast.
 * @property {boolean} isVisible - Whether the toast is currently visible.
 */
interface ToastProps {
  message: string;
  isVisible: boolean;
}

/**
 * Toast component.
 *
 * Displays a temporary notification message (toast) on the screen.
 * - If `isVisible` is `false`, the component renders nothing.
 * - If `isVisible` is `true`, the toast message is displayed.
 *
 * @component
 * @param {ToastProps} props - Component props.
 * @returns {JSX.Element | null} A toast message if visible, otherwise `null`.
 *
 * @example
 * <Toast message="Message sent successfully!" isVisible={true} />
 */
export const Toast: React.FC<ToastProps> = ({ message, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return <div className="rt-toast show">{message}</div>;
};
