import { Site } from '../types';
import plus from '../images/Plus@2x.png';

interface CriticalErrorProps {
  site: Site;
}

export default function CriticalError({ site }: CriticalErrorProps) {
  return (
    <div className="interstitial">
      <div className="interstitial-content">
        <img className="img-plus" src={plus} alt="" />
        <div>
          <p className="interstitial-title">Add your website</p>
          <p>
            Next, let’s add your site to the Google Search Console.
            <br />
            Verify via the HTML tag.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          window.open(
            `https://search.google.com/search-console/inspect?resource_id=${site.url}`,
            '_blank',
          );
        }}
      >
        Open Dashboard
      </button>
    </div>
  );
}
