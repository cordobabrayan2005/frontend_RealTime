import React from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return <div className="rt-toast show">{message}</div>;
};
