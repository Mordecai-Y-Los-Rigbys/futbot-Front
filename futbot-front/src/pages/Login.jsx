import { Link } from "react-router-dom";
import { useState } from 'react';

function LoginScreen() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
    setErrorMessage('Ingresá un email válido.');
    return;
    }

    if (!password) {
    setErrorMessage('Ingresá una contraseña válida.');
    return;
    }

    setErrorMessage('');
    console.log('Formulario válido', { email, password }); //creo que aca despues se llama al endpoint
    }

    return(
        <>
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <label>
                    Email:
                    <input type="email" name="email" value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label>
                    Password:
                    <input type="password" name="password" value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                <input type="submit" value="Login" />
            </form>
            {errorMessage && <p role="alert">{errorMessage}</p>}
            <p>¿Aún no tienes cuenta? <Link to="/registro">Registrate aquí</Link></p>
        </>
    )
}

export default LoginScreen