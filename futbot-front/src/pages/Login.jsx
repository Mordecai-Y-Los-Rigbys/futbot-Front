import { Link } from "react-router-dom";
import { useState } from "react";
import { loginUser } from "../services/authService";


function LoginScreen({ form, setForm }) {

    const [errorMessage, setErrorMessage] = useState(null);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault(); // evita que el navegador recargue y mande los datos por la URL
        setErrorMessage(null);

        // Validación en cliente: el ticket pide no enviar campos vacíos
        if (!form.email.trim() || !form.password) {
            setErrorMessage("Completá el email y la contraseña.");
            return;
        }
        
        loginUser()
    };


    return (
        <>
            <h1 className="title">FutBot</h1>
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <label>
                    <p>Email:</p>
                    <input type="email" name="email" value={form.email} onChange={handleChange} />
                </label>
                <label>
                    <p>Contraseña:</p>
                    <input type="password" name="password" value={form.password} onChange={handleChange} />
                </label>
                {errorMessage && <p role="alert">{errorMessage}</p>}
                <button
                type="submit"
                disabled={isLoading}
                style={{
                    display: 'block',
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
                {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
            </form>
            <p>¿Aún no tienes cuenta? <Link to="/registro">Regístrate aquí</Link></p>
        </>
    );
}

export default LoginScreen;