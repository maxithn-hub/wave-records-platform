'use client';

import React from 'react';
import { useLogin } from '../hooks/useLogin.hook';

export function LoginFormView(): React.JSX.Element {
  const {
    email,
    setEmail,
    password,
    setPassword,
    isSubmitting,
    errorMessage,
    submitLogin,
  } = useLogin();

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-ok">AUTENTICACIÓN JWT + COOKIE HTTPONLY</span>
        <span className="wave-code-tag">module: auth-login</span>
      </div>
      <h2 className="wave-card-title">Iniciar Sesión en Wave Records</h2>
      <p className="wave-card-subtitle">
        El Refresh Token viaja en una cookie <code>httpOnly; SameSite=Strict</code> con rotación
        automática y detección de robo.
      </p>

      <form onSubmit={submitLogin} className="wave-form-grid">
        <label className="wave-label">
          Correo Electrónico
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@waverecords.local"
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="wave-input"
          />
        </label>

        {errorMessage && <div className="wave-inline-error">{errorMessage}</div>}

        <button type="submit" disabled={isSubmitting} className="wave-btn-active">
          {isSubmitting ? 'Verificando...' : 'Ingresar al Panel'}
        </button>
      </form>
    </article>
  );
}
