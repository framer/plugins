import { Check, Loader } from 'react-feather';
import { requestIndexing } from '../api';
import { useContext, useState } from 'react';
import { AuthContext } from '../auth';
import { GoogleToken } from '../types';

interface ReIndexButtonProps {
  urls: string[] | null;
}

export default function ReIndexButton({ urls = [] }: ReIndexButtonProps) {
  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const [reindexAllStatus, setReindexAllStatus] = useState({
    loading: false,
    success: false,
  });

  return (
    <div>
      <button
        className="reindex-button"
        type="button"
        disabled={reindexAllStatus.loading || reindexAllStatus.success}
        onClickCapture={(e) => {
          e.preventDefault();

          setReindexAllStatus({ loading: true, success: false });

          const promises = (urls || []).map((url) =>
            requestIndexing(url, authContext.access_token),
          );

          Promise.all(promises).then(() => {
            setReindexAllStatus({ loading: false, success: true });
          });
        }}
      >
        {reindexAllStatus.loading ? (
          <>
            <Loader className="loading-svg" />
            <span>Loading...</span>
          </>
        ) : reindexAllStatus.success ? (
          <>
            <Check />
            <span>Re-index requested</span>
          </>
        ) : (
          'Re-index all'
        )}
      </button>
    </div>
  );
}
