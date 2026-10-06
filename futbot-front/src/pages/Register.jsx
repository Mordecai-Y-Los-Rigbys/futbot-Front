import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/authService';

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    clubName: '',
    avatar: 1,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'avatar' ? parseInt(value, 10) : value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateClient = () => {
    const errors = {};
    if (!formData.username.trim()) errors.username = 'El nombre de usuario es obligatorio.';
    if (formData.username.length > 20) errors.username = 'Máximo 20 caracteres permitidos.';

    if (!formData.email.trim()) {
      errors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'El formato de correo no es válido.';
    } else if (formData.email.length > 255) {
      errors.email = 'Máximo 255 caracteres permitidos.';
    }

    if (!formData.password) {
      errors.password = 'La contraseña es obligatoria.';
    } else if (formData.password.length > 72) {
      errors.password = 'Máximo 72 caracteres permitidos.';
    }

    if (!formData.clubName.trim()) errors.clubName = 'El nombre del club es obligatorio.';
    if (formData.clubName.length > 20) errors.clubName = 'Máximo 20 caracteres permitidos.';

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setSuccessMessage('');

    const errors = validateClient();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      await registerUser(formData);
      setSuccessMessage('¡Usuario registrado con éxito! Redirigiendo...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      if (err.response) {
        const { status, data } = err.response;

        if (status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            email: data.message || 'El email ya está asociado a otro usuario.',
          }));
        } else if (status === 400 || status === 422) {
          const backendErrors = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((item) => {
              backendErrors[item.field] = `Campo inválido (${item.reason})`;
            });
          }
          setFieldErrors(backendErrors);
          setGeneralError(data.message || 'Por favor revise los campos señalados.');
        } else {
          setGeneralError('Error en el servidor. Intente nuevamente.');
        }
      } else {
        setGeneralError('No se pudo establecer conexión con el servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Registro de Club - FutBot</h2>

      {generalError && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', marginBottom: '15px', borderRadius: '4px' }}>
          {generalError}
        </div>
      )}

      {successMessage && (
        <div style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px', marginBottom: '15px', borderRadius: '4px' }}>
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="username" style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            maxLength={20}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          {fieldErrors.username && <div style={{ color: 'red', fontSize: '13px', marginTop: '3px' }}>{fieldErrors.username}</div>}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="email" style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            maxLength={255}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          {fieldErrors.email && <div style={{ color: 'red', fontSize: '13px', marginTop: '3px' }}>{fieldErrors.email}</div>}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="password" style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            maxLength={72}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          {fieldErrors.password && <div style={{ color: 'red', fontSize: '13px', marginTop: '3px' }}>{fieldErrors.password}</div>}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="clubName" style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Nombre del Club</label>
          <input
            id="clubName"
            name="clubName"
            type="text"
            value={formData.clubName}
            onChange={handleChange}
            maxLength={20}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          {fieldErrors.clubName && <div style={{ color: 'red', fontSize: '13px', marginTop: '3px' }}>{fieldErrors.clubName}</div>}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="avatar" style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Avatar</label>
          <select
            id="avatar"
            name="avatar"
            value={formData.avatar}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            <option value={1}>Belgrano</option>
            <option value={2}>Boca</option>
            <option value={3}>Instituto</option>
            <option value={4}>River</option>
            <option value={5}>Talleres</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isLoading ? '#9e9e9e' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '15px',
          }}
        >
          {isLoading ? 'Registrando...' : 'Crear Cuenta'}
        </button>
      </form>

      <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px' }}>
        ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#5fbf49' }}>Inicia sesión</Link>
      </div>
    </div>
  );
}
