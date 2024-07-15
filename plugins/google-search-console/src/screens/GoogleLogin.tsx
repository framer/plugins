import bigG from '../images/BigG@2x.png';

interface GoogleLoginProps {
  login: () => void;
  hasError?: boolean;
  errorMessage?: string;
}

export default function GoogleLogin({
  login,
  hasError,
  errorMessage,
}: GoogleLoginProps) {
  return (
    <div className="interstitial">
      <div className="interstitial-content interstitial-content--start">
        <img className="big-g" src={bigG} alt="" />
        <div>
          <p className="interstitial-title">Connect to Google</p>
          <p>
            {hasError
              ? errorMessage ||
                'Sorry, there was an error connecting to your Google account. Please try again.'
              : 'Improve your performance on Google Search. Make sure your site is published first, then log in.'}
          </p>
        </div>
      </div>
      <button type="button" onClick={login}>
        Log In
      </button>
    </div>
  );
}
