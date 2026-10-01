import { Link } from "react-router-dom";
import { useState } from 'react';

function LoginScreen() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
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
            <p>¿Aún no tienes cuenta? <Link to="/registro">Registrate aquí</Link></p>
        </>
    )
}

export default LoginScreen