import { useContext } from 'react';
import { AuthContext } from '../auth';

interface GoogleLoginProps {
  login: () => void;
  hasError?: boolean;
}

export default function GoogleLogin({ login, hasError }: GoogleLoginProps) {
  const authContext = useContext(AuthContext);

  return (
    <div>
      {hasError && authContext?.access_token ? (
        <div>
          Sorry, there was an error connecting to your Google account. Please
          try logging back in.
        </div>
      ) : null}
      <button type="button" onClick={login}>
        Login with Google
      </button>
    </div>
  );
}
