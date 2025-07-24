import { ClientOnly } from './components/ClientOnly';
import { MainGame } from './components/MainGame';

function App() {
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
                    Loading Floppy Worm...
                </div>
            }
        >
            <MainGame />
        </ClientOnly>
    )
}

export default App