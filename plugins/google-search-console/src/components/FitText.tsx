import { ReactNode, useState } from 'react';
import { Textfit } from 'react-textfit';

interface FitTextProps {
  children: ReactNode;
}

export default function FitText({ children }: FitTextProps) {
  const [ready, setReady] = useState(false);

  return (
    <div style={{ opacity: ready ? 1 : 0 }}>
      <Textfit mode="single" onReady={() => setReady(true)}>
        {children}
      </Textfit>
    </div>
  );
}
