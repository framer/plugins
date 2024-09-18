import spinner from '../images/Spinner@2x.png';

export default function Loading({ inline }: { inline?: boolean }) {
  return (
    <div
      className={[
        'loading-container',
        inline ? 'loading-container--inline' : '',
      ].join(' ')}
    >
      <img src={spinner} width={20} height={20} alt="" />
      <p>Loading...</p>
    </div>
  );
}
