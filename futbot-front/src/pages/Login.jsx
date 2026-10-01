import { Link } from "react-router-dom";
function LoginScreen() {

    return(
        <>
            <h2>Login</h2>
            <form>
                <label>
                    Username:
                    <input type="text" name="username" />
                </label>
                <label>
                    Password:
                    <input type="password" name="password" />
                </label>
                <input type="submit" value="Login" />
            </form>
            <p>¿Aún no tienes cuenta? <Link to="/registro">Registrate aquí</Link></p>
        </>
    )
}

export default LoginScreen