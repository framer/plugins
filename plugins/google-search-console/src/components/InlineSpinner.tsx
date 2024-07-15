import spinner from '../images/Spinner@2x.png';

export default function InlineSpinner() {
  return (
    <img
      className="inline-spinner"
      src={spinner}
      width={16}
      height={16}
      alt="Loading..."
    />
  );
}
