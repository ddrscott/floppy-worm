import { useParams } from '@remix-run/react';
import { ClientOnly } from '~/components/ClientOnly';
import { TestGame } from '~/components/TestGame';

export default function TestMap() {
  const { filename } = useParams();

  if (!filename) {
    return <div>No filename provided</div>;
  }
  
  return (
    <ClientOnly
      fallback={
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#232333',
          color: 'white'
        }}>
          Loading test map: {filename}...
        </div>
      }
    >
      <TestGame filename={filename!} />
    </ClientOnly>
  );
}