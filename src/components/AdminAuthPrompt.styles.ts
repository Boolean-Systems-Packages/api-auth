export const adminAuthPromptStyles = `
.api-auth-prompt__overlay,
.api-auth-prompt__overlay * {
  box-sizing: border-box;
}

.api-auth-prompt__overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.api-auth-prompt__dialog {
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
  padding: 24px;
}

.api-auth-prompt__title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.api-auth-prompt__description {
  margin: 0 0 16px;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.4;
}

.api-auth-prompt__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.api-auth-prompt__field label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #334155;
}

.api-auth-prompt__field input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.9375rem;
}

.api-auth-prompt__field input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

.api-auth-prompt__error {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: #b91c1c;
}

.api-auth-prompt__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.api-auth-prompt__actions button {
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.875rem;
  cursor: pointer;
}

.api-auth-prompt__cancel {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}

.api-auth-prompt__confirm {
  border: 0;
  background: #2563eb;
  color: #fff;
}

.api-auth-prompt__confirm:disabled,
.api-auth-prompt__cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;
